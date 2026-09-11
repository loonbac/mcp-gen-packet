import type { BridgePort, BridgeStatus } from "../../ports/bridge-port.js";
import type { ProcessDetectorPort } from "../../ports/process-detector-port.js";
import type { EventBufferPort } from "../../ports/event-buffer-port.js";
import type { ExecutionMode } from "../../types/bridge.js";
import type { ToolResult } from "../../types/tools.js";
import { AsyncQueue } from "../../utils/async/async-queue.js";
import { EventBuffer } from "./event-buffer.js";
import { PowerShellProcessDetector } from "./powershell-detector.js";
import {
  HttpBridgeServer,
  type HttpBridgeServerOptions,
} from "./http-bridge-server.js";
import { buildScript } from "../../../bridge/script-builder.js";
import { getBootstrapScript } from "../../utils/pt/bootstrap-script.js";

export interface LiveBridgeServerPort {
  start(): void;
  stop(): void;
  isListening(): boolean;
}

export interface LiveBridgeOptions {
  readonly host?: string;
  readonly port?: number;
  readonly detector?: ProcessDetectorPort;
  readonly events?: EventBufferPort;
  readonly commandQueue?: AsyncQueue<string>;
  readonly resultQueue?: AsyncQueue<string>;
  readonly serverFactory?: (options: HttpBridgeServerOptions) => LiveBridgeServerPort;
  readonly clock?: () => number;
  readonly scriptBuilder?: (method: string, params: Record<string, unknown>) => string;
  readonly bootstrapScriptGenerator?: (opts?: { host?: string; port?: number }) => string;
  readonly executionTimeoutMs?: number;
  readonly pollingActiveThresholdMs?: number;
  readonly connectedGraceMs?: number;
  readonly logger?: (message: string) => void;
  readonly debugEnabled?: boolean;
}

/**
 * Decoupled LiveBridge coordinator orchestrating lifecycle, connection heuristics,
 * automatic queue cleanup on Packet Tracer process exit, and command execution.
 */
export class LiveBridge implements BridgePort {
  private static readonly DEFAULT_POLLING_ACTIVE_THRESHOLD_MS = 5000;
  private static readonly DEFAULT_CONNECTED_GRACE_MS = 900000;
  private static readonly DEFAULT_EXECUTION_TIMEOUT_MS = 20000;

  private readonly host: string;
  private readonly port: number;
  private readonly detector: ProcessDetectorPort;
  private readonly events: EventBufferPort;
  private readonly commandQueue: AsyncQueue<string>;
  private readonly resultQueue: AsyncQueue<string>;
  private readonly server: LiveBridgeServerPort;
  private readonly clock: () => number;
  private readonly scriptBuilder: (method: string, params: Record<string, unknown>) => string;
  private readonly bootstrapScriptGenerator: (opts?: { host?: string; port?: number }) => string;
  private readonly executionTimeoutMs: number;
  private readonly pollingActiveThresholdMs: number;
  private readonly connectedGraceMs: number;
  private readonly logger: (message: string) => void;
  private readonly debugEnabled: boolean;

  private lastPollAt = 0;
  private pollCount = 0;
  private queuedCount = 0;
  private resultCount = 0;
  private hasSeenPolling = false;
  private lastPacketTracerRunning: boolean | null = null;

  constructor(
    hostOrOptions: string | LiveBridgeOptions = "127.0.0.1",
    port = 54321,
    options?: LiveBridgeOptions,
  ) {
    let host = "127.0.0.1";
    let resolvedPort = port;
    let resolvedOpts: LiveBridgeOptions = {};

    if (typeof hostOrOptions === "object" && hostOrOptions !== null) {
      resolvedOpts = hostOrOptions;
      host = hostOrOptions.host ?? "127.0.0.1";
      resolvedPort = hostOrOptions.port ?? 54321;
    } else {
      host = hostOrOptions;
      resolvedPort = port;
      resolvedOpts = options ?? {};
    }

    this.host = host;
    this.port = resolvedPort;
    this.detector = resolvedOpts.detector ?? new PowerShellProcessDetector();
    this.events = resolvedOpts.events ?? new EventBuffer(400);
    this.commandQueue = resolvedOpts.commandQueue ?? new AsyncQueue<string>();
    this.resultQueue = resolvedOpts.resultQueue ?? new AsyncQueue<string>();
    this.clock = resolvedOpts.clock ?? Date.now;
    this.scriptBuilder = resolvedOpts.scriptBuilder ?? buildScript;
    this.bootstrapScriptGenerator = resolvedOpts.bootstrapScriptGenerator ?? getBootstrapScript;
    this.executionTimeoutMs = resolvedOpts.executionTimeoutMs ?? LiveBridge.DEFAULT_EXECUTION_TIMEOUT_MS;
    this.pollingActiveThresholdMs =
      resolvedOpts.pollingActiveThresholdMs ?? LiveBridge.DEFAULT_POLLING_ACTIVE_THRESHOLD_MS;
    this.connectedGraceMs = resolvedOpts.connectedGraceMs ?? LiveBridge.DEFAULT_CONNECTED_GRACE_MS;
    this.debugEnabled =
      resolvedOpts.debugEnabled ??
      (process.env.MCP_BRIDGE_DEBUG === "1" || process.env.MCP_BRIDGE_DEBUG === "true");
    this.logger =
      resolvedOpts.logger ??
      ((message: string) => {
        console.error(`[bridge ${new Date().toISOString()}] ${message}`);
      });

    const serverFactory =
      resolvedOpts.serverFactory ??
      ((opts: HttpBridgeServerOptions) => new HttpBridgeServer(opts));

    this.server = serverFactory({
      host: this.host,
      port: this.port,
      commandQueue: this.commandQueue,
      resultQueue: this.resultQueue,
      events: this.events,
      hooks: {
        getStatus: () => this.getStatus(),
        onPoll: (at: number) => this.handlePoll(at),
        onCommandQueued: () => {
          this.queuedCount += 1;
        },
        onResultReceived: () => {
          this.resultCount += 1;
        },
      },
      logger: this.logger,
    });
  }

  private log(message: string): void {
    this.logger(message);
  }

  private debug(message: string): void {
    if (this.debugEnabled) {
      this.log(message);
    }
  }

  private handlePoll(at: number): void {
    const wasConnected = this.isConnected();
    this.lastPollAt = at;
    this.hasSeenPolling = true;
    this.pollCount += 1;
    if (!wasConnected && this.isConnected()) {
      this.log("Packet Tracer polling detectado (connected=true)");
    }
  }

  start(): void {
    this.server.start();
  }

  stop(): void {
    this.server.stop();
  }

  enqueue(jsCode: string): void {
    this.commandQueue.enqueue(jsCode);
    this.queuedCount += 1;
    this.events.setEvent("enqueue", `Comando encolado (${jsCode.length} bytes)`);
    this.debug(`enqueue queueDepth=${this.commandQueue.length}`);
  }

  clearPendingResults(): number {
    const dropped = this.resultQueue.clear();
    if (dropped > 0) {
      this.events.setEvent("result-clear", `Resultados pendientes descartados=${dropped}`);
      this.debug(`resultQueue cleared dropped=${dropped}`);
    }
    return dropped;
  }

  async sendAndWait(jsCode: string, timeoutMs = 10000): Promise<string | null> {
    this.enqueue(jsCode);
    return this.resultQueue.dequeueWithTimeout(timeoutMs);
  }

  bootstrapScript(): string {
    return this.bootstrapScriptGenerator({ host: this.host, port: this.port });
  }

  getStatus(): BridgeStatus {
    const now = this.clock();
    const packetTracerRunning = this.detector.isPacketTracerRunning();

    if (this.lastPacketTracerRunning === true && !packetTracerRunning) {
      const droppedCommands = this.commandQueue.clear();
      const droppedResults = this.resultQueue.clear();
      this.hasSeenPolling = false;
      this.lastPollAt = 0;
      this.events.setEvent(
        "queue-auto-cleared",
        `Packet Tracer cerrado: queued=${droppedCommands}, results=${droppedResults}`,
      );
      this.log(
        `auto-clear on Packet Tracer close queued=${droppedCommands} results=${droppedResults}`,
      );
    }
    this.lastPacketTracerRunning = packetTracerRunning;

    const ago = this.lastPollAt === 0 ? null : (now - this.lastPollAt) / 1000;
    const pollingActive = ago !== null && ago * 1000 < this.pollingActiveThresholdMs;
    const recentGrace = ago !== null && ago * 1000 < this.connectedGraceMs;
    const connected = this.hasSeenPolling && packetTracerRunning && (pollingActive || recentGrace);

    return {
      running: this.server.isListening(),
      connected,
      pollingActive,
      packetTracerRunning,
      lastPollAgoSeconds: ago,
      queueDepth: this.commandQueue.length,
      polls: this.pollCount,
      queued: this.queuedCount,
      resultsReceived: this.resultCount,
      lastEvent: this.events.getLastEvent(),
    };
  }

  isConnected(): boolean {
    return this.getStatus().connected;
  }

  getMode(): ExecutionMode {
    return "live";
  }

  async execute(method: string, params: Record<string, unknown>): Promise<ToolResult> {
    const code = this.scriptBuilder(method, params);
    this.debug(`execute: ${method} -> ${code}`);

    if (!this.isConnected()) {
      return { mode: "script", data: { method, params }, code };
    }

    this.enqueue(code);
    const result = await this.resultQueue.dequeueWithTimeout(this.executionTimeoutMs);

    if (result === null) {
      return {
        mode: "live",
        data: { method, params, status: "queued_no_confirmation", code },
      };
    }

    if (result.toUpperCase().startsWith("ERROR")) {
      throw new Error(result);
    }

    return { mode: "live", data: { method, params, result, code } };
  }
}
