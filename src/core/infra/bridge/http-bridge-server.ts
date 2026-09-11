import http, { type IncomingMessage, type ServerResponse } from "node:http";
import type { BridgeStatus } from "../../ports/bridge-port.js";
import type { EventBufferPort } from "../../ports/event-buffer-port.js";
import type { AsyncQueue } from "../../utils/async/async-queue.js";
import { getMonitorHtml } from "./monitor-template.js";

export interface HttpBridgeServerHooks {
  readonly getStatus: () => BridgeStatus;
  readonly onPoll: (at: number) => void;
  readonly onCommandQueued: () => void;
  readonly onResultReceived: () => void;
}

export type BridgeServerClock = () => number;
export type BridgeServerLogger = (message: string) => void;

export interface HttpBridgeServerOptions {
  readonly host: string;
  readonly port: number;
  readonly commandQueue: AsyncQueue<string>;
  readonly resultQueue: AsyncQueue<string>;
  readonly events: EventBufferPort;
  readonly hooks: HttpBridgeServerHooks;
  readonly resultWaitTimeoutMs?: number;
  readonly clock?: BridgeServerClock;
  readonly monitorHtml?: () => string;
  readonly logger?: BridgeServerLogger;
}

/**
 * Dedicated HTTP transport server owning only its node:http handle
 * and listening/starting flags. S4c.1 covers lifecycle, CORS, and
 * read-only routes (/ping, /monitor, /status); S4c.2 covers command
 * and result queueing routes (/next, /logs, /result, /queue).
 */
export class HttpBridgeServer {
  private readonly host: string;
  private readonly port: number;
  private readonly commandQueue: AsyncQueue<string>;
  private readonly resultQueue: AsyncQueue<string>;
  private readonly events: EventBufferPort;
  private readonly hooks: HttpBridgeServerHooks;
  private readonly resultWaitTimeoutMs: number;
  private readonly clock: BridgeServerClock;
  private readonly monitorHtml: () => string;
  private readonly logger: BridgeServerLogger;

  private server: http.Server | null = null;
  private listening = false;
  private starting = false;

  constructor(options: HttpBridgeServerOptions) {
    this.host = options.host;
    this.port = options.port;
    this.commandQueue = options.commandQueue;
    this.resultQueue = options.resultQueue;
    this.events = options.events;
    this.hooks = options.hooks;
    this.resultWaitTimeoutMs = options.resultWaitTimeoutMs ?? 9000;
    this.clock = options.clock ?? Date.now;
    this.monitorHtml = options.monitorHtml ?? getMonitorHtml;
    this.logger =
      options.logger ??
      ((message: string) => {
        console.error(`[bridge ${new Date().toISOString()}] ${message}`);
      });
  }

  start(): void {
    if (this.server !== null || this.starting || this.listening) {
      return;
    }
    this.starting = true;
    const server = http.createServer((req, res) => {
      this.handleRequest(req, res).catch(() => {
        this.events.setEvent("internal-error", "Error no controlado en handleRequest");
        if (!res.headersSent) {
          this.respond(res, 500, "internal-error");
        }
      });
    });
    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        this.events.setEvent("port-in-use", `Puerto ${this.port} ya en uso`);
        this.listening = false;
        this.starting = false;
        this.server = null;
        this.logger(`port ${this.port} en uso; se asume bridge externo activo`);
        return;
      }
      this.events.setEvent("listen-error", error.message);
      this.listening = false;
      this.starting = false;
      this.server = null;
      this.logger(`error iniciando bridge: ${error.message}`);
    });
    this.server = server;
    server.listen(this.port, this.host, () => {
      this.listening = true;
      this.starting = false;
      this.events.setEvent("listening", `Escuchando en http://${this.host}:${this.getPort()}`);
      this.logger(`listening http://${this.host}:${this.getPort()}`);
    });
  }

  stop(): void {
    if (this.server === null) {
      return;
    }
    try {
      this.server.close();
    } catch {
      // close on a failed listen handle must stay safe
    }
    this.server = null;
    this.listening = false;
    this.starting = false;
    this.events.setEvent("stopped", "Bridge detenido");
    this.logger("stopped");
  }

  isListening(): boolean {
    return this.listening;
  }

  getPort(): number {
    if (this.server !== null && this.listening) {
      const address = this.server.address();
      if (address !== null && typeof address === "object" && "port" in address) {
        return (address as { port: number }).port;
      }
    }
    return this.port;
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = req.url ?? "/";
    const method = req.method ?? "GET";

    if (method === "OPTIONS") {
      this.cors(res);
      res.writeHead(200);
      res.end();
      return;
    }

    if (method === "GET" && url === "/next") {
      const cmd = this.commandQueue.tryDequeue() ?? "";
      this.hooks.onPoll(this.clock());
      const status = this.hooks.getStatus();
      this.events.setEvent(
        cmd.length > 0 ? "poll-dispatch" : "poll-idle",
        `dispatchBytes=${cmd.length} queueDepth=${this.commandQueue.length} polls=${status.polls}`
      );
      this.respond(res, 200, cmd);
      return;
    }

    if (method === "GET" && url === "/ping") {
      this.events.setEvent("ping", "Health check solicitado");
      this.respond(res, 200, "pong");
      return;
    }

    if (method === "GET" && url === "/logs") {
      this.respondJson(res, 200, {
        status: this.hooks.getStatus(),
        events: this.events.getRecent(300),
      });
      return;
    }

    if (method === "GET" && url === "/monitor") {
      this.respondHtml(res, 200, this.monitorHtml());
      return;
    }

    if (method === "GET" && url === "/status") {
      const status = this.hooks.getStatus();
      this.respondJson(res, 200, {
        connected: status.connected,
        polling_active: status.pollingActive,
        packet_tracer_running: status.packetTracerRunning,
        running: status.running,
        queueDepth: status.queueDepth,
        last_poll_ago: status.lastPollAgoSeconds,
        polls: status.polls,
        queued: status.queued,
        results_received: status.resultsReceived,
        last_event: status.lastEvent,
      });
      return;
    }

    if (method === "GET" && url === "/result") {
      const result = await this.resultQueue.dequeueWithTimeout(this.resultWaitTimeoutMs);
      if (result === null) {
        this.events.setEvent(
          "result-timeout",
          `GET /result sin respuesta en ${Math.round(this.resultWaitTimeoutMs / 1000)}s`
        );
        this.respond(res, 204, "");
        return;
      }
      this.events.setEvent("result-read", `GET /result bytes=${result.length}`);
      this.respond(res, 200, result);
      return;
    }

    if (method === "POST" && url === "/result") {
      const body = await this.readBody(req);
      this.resultQueue.enqueue(body);
      this.hooks.onResultReceived();
      this.events.setEvent(
        "result-post",
        `POST /result bytes=${body.length} pendingResults=${this.resultQueue.length}`
      );
      this.respond(res, 200, "ok");
      return;
    }

    if (method === "POST" && url === "/queue") {
      const body = await this.readBody(req);
      if (body.trim().length > 0) {
        this.commandQueue.enqueue(body);
        this.hooks.onCommandQueued();
        this.events.setEvent(
          "queue-post",
          `POST /queue bytes=${body.length} queueDepth=${this.commandQueue.length}`
        );
      }
      this.respond(res, 200, "queued");
      return;
    }

    this.respond(res, 404, "");
  }

  private readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = "";
      req.setEncoding("utf-8");
      req.on("data", (chunk: string) => {
        body += chunk;
      });
      req.on("end", () => resolve(body));
      req.on("error", (err) => reject(err));
    });
  }

  private cors(res: ServerResponse): void {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  private respond(res: ServerResponse, statusCode: number, body: string): void {
    this.cors(res);
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(body);
  }

  private respondJson(res: ServerResponse, statusCode: number, data: unknown): void {
    this.cors(res);
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(data));
  }

  private respondHtml(res: ServerResponse, statusCode: number, body: string): void {
    this.cors(res);
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(body);
  }
}
