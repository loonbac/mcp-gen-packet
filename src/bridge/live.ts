import http, { IncomingMessage, ServerResponse } from "node:http";
import { spawnSync } from "node:child_process";
import type { BridgeAdapter } from "./adapter.js";
import type { BridgeRequest, BridgeResponse, ExecutionMode, ToolResult } from "../types/protocol.js";
import { randomUUID } from "node:crypto";
import { buildScript } from "./script-builder.js";

function uuid(): string {
  return randomUUID();
}

class AsyncQueue {
  private items: string[] = [];
  private resolvers: Array<(value: string) => void> = [];

  enqueue(value: string) {
    const resolver = this.resolvers.shift();
    if (resolver) {
      resolver(value);
      return;
    }
    this.items.push(value);
  }

  tryDequeue(): string | null {
    if (this.items.length === 0) {
      return null;
    }
    return this.items.shift() ?? null;
  }

  async dequeueWithTimeout(timeoutMs: number): Promise<string | null> {
    const existing = this.tryDequeue();
    if (existing !== null) {
      return existing;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.resolvers = this.resolvers.filter((r) => r !== resolver);
        resolve(null);
      }, timeoutMs);

      const resolver = (value: string) => {
        clearTimeout(timeout);
        resolve(value);
      };

      this.resolvers.push(resolver);
    });
  }

  get length() {
    return this.items.length;
  }

  clear() {
    const count = this.items.length;
    this.items = [];
    return count;
  }
}

export type BridgeStatus = {
  running: boolean;
  connected: boolean;
  pollingActive: boolean;
  packetTracerRunning: boolean;
  lastPollAgoSeconds: number | null;
  queueDepth: number;
  polls: number;
  queued: number;
  resultsReceived: number;
  lastEvent: string;
};

type BridgeEvent = {
  ts: string;
  kind: string;
  detail: string;
};

export class LiveBridge implements BridgeAdapter {
  private static readonly POLLING_ACTIVE_THRESHOLD_MS = 5000;
  private static readonly CONNECTED_GRACE_MS = 900000;
  private static readonly PROCESS_CHECK_INTERVAL_MS = 2000;
  private readonly host: string;
  private readonly port: number;
  private server: http.Server | null = null;
  private readonly commandQueue = new AsyncQueue();
  private readonly resultQueue = new AsyncQueue();
  private lastPollAt = 0;
  private listening = false;
  private pollCount = 0;
  private queuedCount = 0;
  private resultCount = 0;
  private lastEvent = "idle";
  private readonly events: BridgeEvent[] = [];
  private readonly maxEvents = 400;
  private readonly debugEnabled: boolean;
  private hasSeenPolling = false;
  private packetTracerRunningCache = false;
  private packetTracerRunningLastCheckAt = 0;
  private lastPacketTracerRunning: boolean | null = null;

  constructor(host = "127.0.0.1", port = 54321) {
    this.host = host;
    this.port = port;
    this.debugEnabled = process.env.MCP_BRIDGE_DEBUG === "1" || process.env.MCP_BRIDGE_DEBUG === "true";
  }

  private log(message: string) {
    const stamp = new Date().toISOString();
    console.error(`[bridge ${stamp}] ${message}`);
  }

  private debug(message: string) {
    if (this.debugEnabled) {
      this.log(message);
    }
  }

  private pushEvent(kind: string, detail: string) {
    const event: BridgeEvent = {
      ts: new Date().toISOString(),
      kind,
      detail
    };

    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
  }

  private setEvent(kind: string, detail: string) {
    this.lastEvent = kind;
    this.pushEvent(kind, detail);
  }

  start() {
    if (this.server) {
      this.debug("start() ignorado: ya estaba iniciado");
      this.pushEvent("start-ignored", "Bridge ya estaba iniciado en este proceso");
      return;
    }

    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res).catch(() => {
        this.setEvent("internal-error", "Error no controlado en handleRequest");
        this.respond(res, 500, "internal-error");
      });
    });

    this.server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        this.setEvent("port-in-use", `Puerto ${this.port} ya en uso`);
        this.listening = false;
        this.log(`port ${this.port} en uso; se asume bridge externo activo`);
        return;
      }

      this.setEvent("listen-error", error.message);
      this.listening = false;
      this.log(`error iniciando bridge: ${error.message}`);
    });

    this.server.listen(this.port, this.host, () => {
      this.listening = true;
      this.setEvent("listening", `Escuchando en http://${this.host}:${this.port}`);
      this.log(`listening http://${this.host}:${this.port}`);
    });
  }

  stop() {
    if (!this.server) {
      return;
    }

    this.server.close();
    this.server = null;
    this.listening = false;
    this.setEvent("stopped", "Bridge detenido");
    this.log("stopped");
  }

  enqueue(jsCode: string) {
    this.commandQueue.enqueue(jsCode);
    this.queuedCount += 1;
    this.setEvent("enqueue", `Comando encolado (${jsCode.length} bytes)`);
    this.debug(`enqueue queueDepth=${this.commandQueue.length}`);
  }

  clearPendingResults() {
    const dropped = this.resultQueue.clear();
    if (dropped > 0) {
      this.setEvent("result-clear", `Resultados pendientes descartados=${dropped}`);
      this.debug(`resultQueue cleared dropped=${dropped}`);
    }
    return dropped;
  }

  async sendAndWait(jsCode: string, timeoutMs = 10000): Promise<string | null> {
    this.enqueue(jsCode);
    return this.resultQueue.dequeueWithTimeout(timeoutMs);
  }

  bootstrapScript() {
    const base = `http://${this.host}:${this.port}`;
    const inner =
      "(function(){var w=window;if(w.__MCP_PTB_TIMER){clearInterval(w.__MCP_PTB_TIMER);}w.__MCP_PTB_ERRORS=0;w.__MCP_PTB_TIMER=setInterval(function(){" +
      "var x=new XMLHttpRequest();" +
      `x.open('GET','${base}/next',true);` +
      "x.timeout=1500;" +
      "x.onload=function(){if(x.status===200){w.__MCP_PTB_ERRORS=0;if(x.responseText){" +
      "$se('runCode',x.responseText);" +
      "return;} }" +
      "w.__MCP_PTB_ERRORS=(w.__MCP_PTB_ERRORS||0)+1;" +
      "if(w.__MCP_PTB_ERRORS>=6&&w.__MCP_PTB_TIMER){clearInterval(w.__MCP_PTB_TIMER);w.__MCP_PTB_TIMER=null;}};" +
      "x.onerror=function(){w.__MCP_PTB_ERRORS=(w.__MCP_PTB_ERRORS||0)+1;if(w.__MCP_PTB_ERRORS>=6&&w.__MCP_PTB_TIMER){clearInterval(w.__MCP_PTB_TIMER);w.__MCP_PTB_TIMER=null;}};" +
      "x.ontimeout=x.onerror;" +
      "x.send()" +
      "},500);})();";

    return inner;
  }

  private isPacketTracerRunning(): boolean {
    const now = Date.now();
    if (now - this.packetTracerRunningLastCheckAt < LiveBridge.PROCESS_CHECK_INTERVAL_MS) {
      return this.packetTracerRunningCache;
    }

    this.packetTracerRunningLastCheckAt = now;

    const command = "$p = Get-Process -Name PacketTracer -ErrorAction SilentlyContinue; if ($p) { '1' } else { '0' }";
    const result = spawnSync("powershell", ["-NoProfile", "-Command", command], {
      encoding: "utf-8",
      timeout: 3000
    });

    if (result.error) {
      return this.packetTracerRunningCache;
    }

    this.packetTracerRunningCache = (result.stdout ?? "").trim() === "1";
    return this.packetTracerRunningCache;
  }

  getStatus(): BridgeStatus {
    const now = Date.now();
    const ago = this.lastPollAt === 0 ? null : (now - this.lastPollAt) / 1000;
    const pollingActive = ago !== null && ago * 1000 < LiveBridge.POLLING_ACTIVE_THRESHOLD_MS;
    const packetTracerRunning = this.isPacketTracerRunning();

    if (this.lastPacketTracerRunning === true && !packetTracerRunning) {
      const droppedCommands = this.commandQueue.clear();
      const droppedResults = this.resultQueue.clear();
      this.hasSeenPolling = false;
      this.lastPollAt = 0;
      this.setEvent("queue-auto-cleared", `Packet Tracer cerrado: queued=${droppedCommands}, results=${droppedResults}`);
      this.log(`auto-clear on Packet Tracer close queued=${droppedCommands} results=${droppedResults}`);
    }
    this.lastPacketTracerRunning = packetTracerRunning;

    const recentGrace = ago !== null && ago * 1000 < LiveBridge.CONNECTED_GRACE_MS;
    const connected = this.hasSeenPolling && packetTracerRunning && (pollingActive || recentGrace);
    return {
      running: this.listening,
      connected,
      pollingActive,
      packetTracerRunning,
      lastPollAgoSeconds: ago,
      queueDepth: this.commandQueue.length,
      polls: this.pollCount,
      queued: this.queuedCount,
      resultsReceived: this.resultCount,
      lastEvent: this.lastEvent
    };
  }

  private getRecentEvents(limit = 200): BridgeEvent[] {
    return this.events.slice(-limit);
  }

  private monitorHtml() {
    return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Bridge Monitor</title>
    <style>
      body { margin: 0; padding: 20px; background-color: #008080; font-family: 'Tahoma', 'Verdana', sans-serif; color: #000; }
      .window { background: #c0c0c0; border: 2px solid; border-top-color: #dfdfdf; border-left-color: #dfdfdf; border-bottom-color: #000; border-right-color: #000; box-shadow: inset 1px 1px #fff, inset -1px 1px #808080; padding: 2px; max-width: 900px; margin: 0 auto; }
      .title-bar { background: #000080; color: #fff; padding: 2px 4px 2px 6px; display: flex; justify-content: space-between; align-items: center; font-weight: bold; font-size: 13px; }
      .title-controls { display: flex; gap: 2px; }
      .title-btn { background: #c0c0c0; border: 2px solid; border-top-color: #dfdfdf; border-left-color: #dfdfdf; border-bottom-color: #000; border-right-color: #000; box-shadow: inset 1px 1px #fff, inset -1px 1px #808080; width: 16px; height: 14px; font-weight: bold; display: flex; align-items: center; justify-content: center; font-size: 10px; cursor: default; }
      .window-body { padding: 8px; }
      .grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-bottom: 12px; }
      .sunken { background: #fff; border: 2px solid; border-top-color: #808080; border-left-color: #808080; border-bottom-color: #dfdfdf; border-right-color: #dfdfdf; box-shadow: inset 1px 1px #000, inset -1px 1px #fff, -1px 1px #dfdfdf, 1px 1px #808080; }
      .card { padding: 4px 6px; display: flex; justify-content: space-between; align-items: center; }
      .k { font-size: 11px; color: #000; text-transform: capitalize; }
      .v { font-size: 12px; font-weight: bold; font-family: 'Courier New', monospace; color: #000; }
      .ok { color: #008000 !important; }
      .bad { color: #ff0000 !important; }
      .panel { padding: 6px; margin-bottom: 10px; }
      .panel-title { font-size: 11px; margin-bottom: 4px; font-weight: bold; }
      .flow { font-family: 'Courier New', monospace; font-size: 12px; padding: 4px; }
      .flow b { color: #000; border-bottom: 1px dotted #808080; }
      .flow .arrow { color: #000080; }
      .table-container { background: #fff; max-height: 180px; overflow-y: auto; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; font-family: 'Courier New', monospace; }
      th { background: #c0c0c0; border: 2px solid; border-top-color: #dfdfdf; border-left-color: #dfdfdf; border-bottom-color: #000; border-right-color: #000; box-shadow: inset 1px 1px #fff, inset -1px 1px #808080; padding: 4px; text-align: left; position: sticky; top: 0; }
      td { padding: 2px 4px; border-bottom: 1px dotted #c0c0c0; }
      tr.row-fail td { color: #ff0000; font-weight: bold; }
      tr.row-warn td { color: #808000; font-weight: bold; }
      tr.row-ok td { color: #000; }
      .pager { display: flex; justify-content: space-between; align-items: center; margin-top: 6px; }
      .pager-info { font-size: 11px; }
      .pager-btns { display: flex; gap: 4px; }
      .pager-btns button { background: #c0c0c0; border: 2px solid; border-top-color: #dfdfdf; border-left-color: #dfdfdf; border-bottom-color: #000; border-right-color: #000; box-shadow: inset 1px 1px #fff, inset -1px 1px #808080; font-family: 'Tahoma', sans-serif; font-size: 11px; padding: 2px 8px; cursor: pointer; }
      .pager-btns button:active:not(:disabled) { border-top-color: #000; border-left-color: #000; border-bottom-color: #dfdfdf; border-right-color: #dfdfdf; box-shadow: inset 1px 1px #808080, inset -1px 1px #fff; padding: 3px 7px 1px 9px; }
      .pager-btns button:disabled { color: #808080; text-shadow: 1px 1px #fff; }
      .status-bar { display: flex; gap: 2px; margin-top: 8px; }
      .status-pane { padding: 2px 4px; font-size: 11px; border: 2px solid; border-top-color: #808080; border-left-color: #808080; border-bottom-color: #dfdfdf; border-right-color: #dfdfdf; box-shadow: inset 1px 1px #000, inset -1px 1px #fff; flex: 1; }
    </style>
  </head>
  <body>
    <div class="window">
      <div class="title-bar"><span>Bridge Monitor</span><div class="title-controls"><div class="title-btn" style="line-height:8px">_</div><div class="title-btn" style="font-size:14px;line-height:14px;padding-bottom:2px">□</div><div class="title-btn" style="font-weight:900">X</div></div></div>
      <div class="window-body">
        <div class="grid">
          <div class="card sunken"><div class="k">Running</div><div id="running" class="v">-</div></div>
          <div class="card sunken"><div class="k">Connected</div><div id="connected" class="v">-</div></div>
          <div class="card sunken"><div class="k">Polling</div><div id="pollingActive" class="v">-</div></div>
          <div class="card sunken"><div class="k">PT Node</div><div id="packetTracerRunning" class="v">-</div></div>
          <div class="card sunken"><div class="k">Last Evnt</div><div id="lastEvent" class="v">-</div></div>
          <div class="card sunken"><div class="k">Queue</div><div id="queueDepth" class="v">-</div></div>
          <div class="card sunken"><div class="k">Polls</div><div id="polls" class="v">-</div></div>
          <div class="card sunken"><div class="k">Total Q'd</div><div id="queued" class="v">-</div></div>
          <div class="card sunken"><div class="k">Results</div><div id="results" class="v">-</div></div>
          <div class="card sunken"><div class="k">Last Poll</div><div id="lastPollAgo" class="v">-</div></div>
        </div>
        <div class="panel-title">Transport Pipeline</div>
        <div class="panel sunken"><div class="flow"><b>Gemini/Tools</b> <span class="arrow">--></span> <b>MCP Server</b> <span class="arrow">--></span> <b>HTTP /queue</b> <span class="arrow">--></span> <b>Bridge /next</b> <span class="arrow">--></span> <b>BridgeBuilder $se('runCode')</b> <span class="arrow">--></span> <b>Engine</b></div></div>
        <div class="panel-title">Event Log</div>
        <div class="table-container sunken"><table><thead><tr><th>Timestamp</th><th>Kind</th><th>Detail</th></tr></thead><tbody id="events"></tbody></table></div>
        <div class="pager"><div class="pager-info" id="pagerInfo">Page -- of --</div><div class="pager-btns"><button id="btnFirst" onclick="goPage(0)">&lt;&lt;</button><button id="btnPrev" onclick="goPage(currentPage-1)">&lt;</button><button id="btnNext" onclick="goPage(currentPage+1)">&gt;</button><button id="btnLast" onclick="goPage(totalPages-1)">&gt;&gt;</button></div></div>
        <div class="status-bar"><div class="status-pane" id="clock">--:--:--</div><div class="status-pane">Port: 54321</div><div class="status-pane" id="bridgeHealth">Ready</div></div>
      </div>
    </div>
    <script>
      function updateClock(){const n=new Date(),p=s=>String(s).padStart(2,'0');document.getElementById('clock').textContent=p(n.getHours())+':'+p(n.getMinutes())+':'+p(n.getSeconds())}updateClock();setInterval(updateClock,1000);
      const PAGE_SIZE=12;let allEvents=[];let currentPage=0;let totalPages=1;let autoSlide=true;
      function setText(id,value,cls){const el=document.getElementById(id);if(el){el.textContent=String(value);el.className='v '+(cls||'');}}
      function esc(v){return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')}
      function eventClass(kind,detail){const s=(String(kind)+' '+String(detail)).toLowerCase();if(s.includes('error')||s.includes('fail')||s.includes('timeout')||s.includes('fallback')||s.includes('port-in-use'))return 'row-fail';if(s.includes('warning')||s.includes('warn')||s.includes('idle'))return 'row-warn';return 'row-ok'}
      function renderPage(){const start=currentPage*PAGE_SIZE;const page=allEvents.slice(start,start+PAGE_SIZE);const rows=page.map(ev=>'<tr class="'+eventClass(ev.kind,ev.detail)+'"><td>'+esc(ev.ts)+'</td><td>'+esc(ev.kind)+'</td><td>'+esc(ev.detail)+'</td></tr>').join('');document.getElementById('events').innerHTML=rows;document.getElementById('pagerInfo').textContent='Page '+(currentPage+1)+' of '+totalPages;document.getElementById('btnFirst').disabled=currentPage===0;document.getElementById('btnPrev').disabled=currentPage===0;document.getElementById('btnNext').disabled=currentPage>=totalPages-1;document.getElementById('btnLast').disabled=currentPage>=totalPages-1;if(autoSlide){const container=document.querySelector('.table-container');if(container){container.scrollTop=container.scrollHeight;}}}
      function goPage(p){currentPage=Math.max(0,Math.min(p,totalPages-1));renderPage()}
      async function tick(){try{const sR=await fetch('/status',{cache:'no-store'});const s=await sR.json();setText('running',s.running,s.running?'ok':'bad');setText('connected',s.connected,s.connected?'ok':'bad');setText('pollingActive',s.polling_active,s.polling_active?'ok':'bad');setText('packetTracerRunning',s.packet_tracer_running,s.packet_tracer_running?'ok':'bad');setText('queueDepth',s.queueDepth??'-');setText('lastEvent',s.last_event??'-');setText('polls',s.polls??0);setText('queued',s.queued??0);setText('results',s.results_received??0);setText('lastPollAgo',s.last_poll_ago!==null?Number(s.last_poll_ago).toFixed(1)+'s':'--');const health=document.getElementById('bridgeHealth');if(health){if(s.connected&&s.polling_active){health.textContent='Connected';}else if(s.running&&s.packet_tracer_running){health.textContent='Waiting Poll';}else if(s.running){health.textContent='Waiting PT';}else{health.textContent='Stopped';}}const lR=await fetch('/logs',{cache:'no-store'});const l=await lR.json();allEvents=(l.events||[]).slice(-240);totalPages=Math.max(1,Math.ceil(allEvents.length/PAGE_SIZE));if(autoSlide){currentPage=totalPages-1;}else if(currentPage>=totalPages){currentPage=totalPages-1;}renderPage()}catch(e){setText('connected','ERR','bad');const health=document.getElementById('bridgeHealth');if(health){health.textContent='Error';}}}
      tick();setInterval(tick,1000)
    </script>
  </body>
</html>`;
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse) {
    const url = req.url ?? "/";
    const method = req.method ?? "GET";

    if (method === "OPTIONS") {
      this.cors(res);
      res.writeHead(200);
      res.end();
      return;
    }

    if (method === "GET" && url === "/next") {
      const wasConnected = this.getStatus().connected;
      const cmd = this.commandQueue.tryDequeue() ?? "";
      this.lastPollAt = Date.now();
      this.hasSeenPolling = true;
      this.pollCount += 1;
      this.setEvent(cmd.length > 0 ? "poll-dispatch" : "poll-idle", `dispatchBytes=${cmd.length} queueDepth=${this.commandQueue.length} polls=${this.pollCount}`);
      if (!wasConnected) {
        this.log("Packet Tracer polling detectado (connected=true)");
      }
      this.debug(`GET /next dispatchBytes=${cmd.length} queueDepth=${this.commandQueue.length}`);
      this.respond(res, 200, cmd);
      return;
    }

    if (method === "GET" && url === "/ping") {
      this.setEvent("ping", "Health check solicitado");
      this.respond(res, 200, "pong");
      return;
    }

    if (method === "GET" && url === "/logs") {
      this.respondJson(res, 200, {
        status: this.getStatus(),
        events: this.getRecentEvents(300)
      });
      return;
    }

    if (method === "GET" && url === "/monitor") {
      this.respondHtml(res, 200, this.monitorHtml());
      return;
    }

    if (method === "GET" && url === "/status") {
      const status = this.getStatus();
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
        last_event: status.lastEvent
      });
      return;
    }

    if (method === "GET" && url === "/result") {
      const result = await this.resultQueue.dequeueWithTimeout(9000);
      if (result === null) {
        this.setEvent("result-timeout", "GET /result sin respuesta en 9s");
        this.respond(res, 204, "");
        return;
      }
      this.setEvent("result-read", `GET /result bytes=${result.length}`);
      this.respond(res, 200, result);
      return;
    }

    if (method === "POST" && url === "/result") {
      const body = await this.readBody(req);
      this.resultQueue.enqueue(body);
      this.resultCount += 1;
      this.setEvent("result-post", `POST /result bytes=${body.length} pendingResults=${this.resultQueue.length}`);
      this.debug(`POST /result bytes=${body.length}`);
      this.respond(res, 200, "ok");
      return;
    }

    if (method === "POST" && url === "/queue") {
      const body = await this.readBody(req);
      if (body.trim().length > 0) {
        this.commandQueue.enqueue(body);
        this.queuedCount += 1;
        this.setEvent("queue-post", `POST /queue bytes=${body.length} queueDepth=${this.commandQueue.length}`);
        this.debug(`POST /queue bytes=${body.length} queueDepth=${this.commandQueue.length}`);
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
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => resolve(body));
      req.on("error", (err) => reject(err));
    });
  }

  private cors(res: ServerResponse) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  private respond(res: ServerResponse, statusCode: number, body: string) {
    this.cors(res);
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(body);
  }

  private respondJson(res: ServerResponse, statusCode: number, data: unknown) {
    this.cors(res);
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(data));
  }

  private respondHtml(res: ServerResponse, statusCode: number, body: string) {
    this.cors(res);
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(body);
  }

  // BridgeAdapter implementation
  isConnected(): boolean {
    return this.getStatus().connected;
  }

  getMode(): ExecutionMode {
    return "live";
  }

  async execute(method: string, params: Record<string, unknown>): Promise<ToolResult> {
    // Build the PTBuilder JS code for this command
    const code = buildScript(method, params);
    this.debug(`execute: ${method} -> ${code}`);

    // If not connected, return script mode for manual execution
    if (!this.isConnected()) {
      return { mode: "script", data: { method, params }, code };
    }

    // Enqueue the command — PT will pick it up via GET /next
    this.enqueue(code);

    // Wait for result from PT via POST /result (timeout 20s)
    const result = await this.resultQueue.dequeueWithTimeout(20000);

    if (result === null) {
      // Timeout — command was sent but no confirmation
      return {
        mode: "live",
        data: { method, params, status: "queued_no_confirmation", code },
      };
    }

    const isError = result.toUpperCase().startsWith("ERROR");
    if (isError) {
      throw new Error(result);
    }

    return { mode: "live", data: { method, params, result, code } };
  }
}