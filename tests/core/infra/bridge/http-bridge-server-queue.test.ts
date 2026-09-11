import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpBridgeServer } from "../../../../src/core/infra/bridge/http-bridge-server.js";
import { AsyncQueue } from "../../../../src/core/utils/async/async-queue.js";
import { EventBuffer } from "../../../../src/core/infra/bridge/event-buffer.js";
import type { BridgeStatus } from "../../../../src/core/ports/bridge-port.js";

function createStatus(overrides?: Partial<BridgeStatus>): BridgeStatus {
  return {
    running: true,
    connected: true,
    pollingActive: true,
    packetTracerRunning: true,
    lastPollAgoSeconds: 0.5,
    queueDepth: 0,
    polls: 10,
    queued: 4,
    resultsReceived: 3,
    lastEvent: "listening",
    ...overrides,
  };
}

function createQueueServer(options?: {
  resultWaitTimeoutMs?: number;
  commandSpacingMs?: number;
  isWedgeSuppressed?: () => boolean;
  getWedgeBackoffUntil?: () => number;
  clockNow?: number;
  onGetStatus?: () => BridgeStatus;
  onResultReceived?: (body: string) => void;
}) {
  const commandQueue = new AsyncQueue<string>();
  const resultQueue = new AsyncQueue<string>();
  const events = new EventBuffer(400);
  let clockTime = options?.clockNow ?? 1_700_000_000_000;
  const hooks = {
    getStatus: vi.fn(options?.onGetStatus ?? (() => createStatus({ queueDepth: commandQueue.length }))),
    onPoll: vi.fn(),
    onCommandQueued: vi.fn(),
    onResultReceived: vi.fn(
      options?.onResultReceived ??
        ((body: string) => {
          resultQueue.enqueue(body);
        })
    ),
    isWedgeSuppressed: options?.isWedgeSuppressed,
    getWedgeBackoffUntil: options?.getWedgeBackoffUntil,
  };
  const server = new HttpBridgeServer({
    host: "127.0.0.1",
    port: 0,
    commandQueue,
    resultQueue,
    events,
    hooks,
    resultWaitTimeoutMs: options?.resultWaitTimeoutMs ?? 9000,
    commandSpacingMs: options?.commandSpacingMs ?? 0,
    clock: () => clockTime,
    logger: () => {},
  });
  return {
    server,
    commandQueue,
    resultQueue,
    events,
    hooks,
    getClockTime: () => clockTime,
    setClockTime: (t: number) => {
      clockTime = t;
    },
    advanceClock: (ms: number) => {
      clockTime += ms;
    },
  };
}

async function waitForListening(server: HttpBridgeServer): Promise<void> {
  const start = Date.now();
  while (!server.isListening()) {
    if (Date.now() - start > 2000) throw new Error("timed out waiting for listening");
    await new Promise((r) => setTimeout(r, 10));
  }
}

const live: HttpBridgeServer[] = [];
afterEach(() => {
  for (const s of live.splice(0)) {
    try {
      s.stop();
    } catch {
      // safe teardown
    }
  }
});

describe("HttpBridgeServer queue & result routes (S4c.2)", () => {
  describe("GET /next", () => {
    it("returns empty body and records poll-idle when command queue is empty", async () => {
      const { server, hooks, events } = createQueueServer({ clockNow: 1_700_000_005_000 });
      live.push(server);
      server.start();
      await waitForListening(server);

      const res = await fetch(`http://127.0.0.1:${server.getPort()}/next`);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("");
      expect(hooks.onPoll).toHaveBeenCalledWith(1_700_000_005_000);
      expect(events.getLastEvent()).toBe("poll-idle");
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
    });

    it("returns command and records poll-dispatch when command queue has items", async () => {
      const { server, commandQueue, hooks, events } = createQueueServer();
      live.push(server);
      commandQueue.enqueue("ipc.call('ping');");
      server.start();
      await waitForListening(server);

      const res = await fetch(`http://127.0.0.1:${server.getPort()}/next`);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("ipc.call('ping');");
      expect(hooks.onPoll).toHaveBeenCalled();
      expect(events.getLastEvent()).toBe("poll-dispatch");
      expect(commandQueue.length).toBe(0);
    });

    it("dequeues in FIFO order across consecutive polls", async () => {
      const { server, commandQueue } = createQueueServer();
      live.push(server);
      commandQueue.enqueue("first");
      commandQueue.enqueue("second");
      server.start();
      await waitForListening(server);

      const res1 = await fetch(`http://127.0.0.1:${server.getPort()}/next`);
      expect(await res1.text()).toBe("first");
      const res2 = await fetch(`http://127.0.0.1:${server.getPort()}/next`);
      expect(await res2.text()).toBe("second");
      const res3 = await fetch(`http://127.0.0.1:${server.getPort()}/next`);
      expect(await res3.text()).toBe("");
    });

    it("enforces rate gating (commandSpacingMs) between dispatches", async () => {
      const { server, commandQueue, advanceClock } = createQueueServer({
        commandSpacingMs: 500,
        clockNow: 1_000_000,
      });
      live.push(server);
      commandQueue.enqueue("first");
      commandQueue.enqueue("second");
      server.start();
      await waitForListening(server);

      // First poll dispatches immediately
      const res1 = await fetch(`http://127.0.0.1:${server.getPort()}/next`);
      expect(await res1.text()).toBe("first");

      // Second poll 200ms later (< 500ms) gets rate-gated (empty body), command remains queued
      advanceClock(200);
      const res2 = await fetch(`http://127.0.0.1:${server.getPort()}/next`);
      expect(await res2.text()).toBe("");
      expect(commandQueue.length).toBe(1);

      // Third poll after 300ms more (500ms total elapsed) dispatches "second"
      advanceClock(300);
      const res3 = await fetch(`http://127.0.0.1:${server.getPort()}/next`);
      expect(await res3.text()).toBe("second");
      expect(commandQueue.length).toBe(0);
    });

    it("suppresses dispatch during wedge backoff window", async () => {
      let wedgeSuppressed = true;
      const { server, commandQueue } = createQueueServer({
        isWedgeSuppressed: () => wedgeSuppressed,
      });
      live.push(server);
      commandQueue.enqueue("cmd-during-wedge");
      server.start();
      await waitForListening(server);

      // While wedge suppressed, dispatch returns empty
      const res1 = await fetch(`http://127.0.0.1:${server.getPort()}/next`);
      expect(await res1.text()).toBe("");
      expect(commandQueue.length).toBe(1);

      // Once wedge ends, next poll dispatches
      wedgeSuppressed = false;
      const res2 = await fetch(`http://127.0.0.1:${server.getPort()}/next`);
      expect(await res2.text()).toBe("cmd-during-wedge");
      expect(commandQueue.length).toBe(0);
    });

    it("suppresses dispatch when getWedgeBackoffUntil is in the future", async () => {
      const { server, commandQueue, advanceClock } = createQueueServer({
        clockNow: 1_000_000,
        getWedgeBackoffUntil: () => 1_010_000, // 10s in the future
      });
      live.push(server);
      commandQueue.enqueue("cmd-backoff-time");
      server.start();
      await waitForListening(server);

      const res1 = await fetch(`http://127.0.0.1:${server.getPort()}/next`);
      expect(await res1.text()).toBe("");
      expect(commandQueue.length).toBe(1);

      // Advance past backoff window
      advanceClock(10_001);
      const res2 = await fetch(`http://127.0.0.1:${server.getPort()}/next`);
      expect(await res2.text()).toBe("cmd-backoff-time");
      expect(commandQueue.length).toBe(0);
    });
  });

  describe("GET /logs", () => {
    it("returns status object and recent events list", async () => {
      const { server, events } = createQueueServer();
      live.push(server);
      events.push("custom-event", "sample telemetry detail");
      server.start();
      await waitForListening(server);

      const res = await fetch(`http://127.0.0.1:${server.getPort()}/logs`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/json");

      const body = (await res.json()) as { status: BridgeStatus; events: Array<{ kind: string }> };
      expect(body.status.connected).toBe(true);
      expect(Array.isArray(body.events)).toBe(true);
      expect(body.events.some((e) => e.kind === "custom-event")).toBe(true);
    });
  });

  describe("GET /result and POST /result", () => {
    it("POST /result enqueues payload, calls onResultReceived, and responds ok", async () => {
      const { server, resultQueue, hooks, events } = createQueueServer();
      live.push(server);
      server.start();
      await waitForListening(server);

      const res = await fetch(`http://127.0.0.1:${server.getPort()}/result`, {
        method: "POST",
        body: JSON.stringify({ success: true, count: 42 }),
      });
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("ok");
      expect(hooks.onResultReceived).toHaveBeenCalledTimes(1);
      expect(resultQueue.length).toBe(1);
      expect(resultQueue.tryDequeue()).toBe(JSON.stringify({ success: true, count: 42 }));
      expect(events.getLastEvent()).toBe("result-post");
    });

    it("POST /result enqueues even empty body", async () => {
      const { server, resultQueue, hooks, events } = createQueueServer();
      live.push(server);
      server.start();
      await waitForListening(server);

      const res = await fetch(`http://127.0.0.1:${server.getPort()}/result`, { method: "POST", body: "" });
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("ok");
      expect(hooks.onResultReceived).toHaveBeenCalledTimes(1);
      expect(resultQueue.length).toBe(1);
      expect(resultQueue.tryDequeue()).toBe("");
      expect(events.getLastEvent()).toBe("result-post");
    });

    it("GET /result returns 200 with result payload when available", async () => {
      const { server, resultQueue, events } = createQueueServer();
      live.push(server);
      resultQueue.enqueue("output-data-42");
      server.start();
      await waitForListening(server);

      const res = await fetch(`http://127.0.0.1:${server.getPort()}/result`);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("output-data-42");
      expect(events.getLastEvent()).toBe("result-read");
    });

    it("GET /result supports rapid consecutive dequeues in FIFO order", async () => {
      const { server, resultQueue } = createQueueServer();
      live.push(server);
      resultQueue.enqueue("res-alpha");
      resultQueue.enqueue("res-beta");
      server.start();
      await waitForListening(server);

      const res1 = await fetch(`http://127.0.0.1:${server.getPort()}/result`);
      expect(await res1.text()).toBe("res-alpha");
      const res2 = await fetch(`http://127.0.0.1:${server.getPort()}/result`);
      expect(await res2.text()).toBe("res-beta");
    });

    it("GET /result returns 204 No Content on timeout", async () => {
      const { server, events } = createQueueServer({ resultWaitTimeoutMs: 50 });
      live.push(server);
      server.start();
      await waitForListening(server);

      const res = await fetch(`http://127.0.0.1:${server.getPort()}/result`);
      expect(res.status).toBe(204);
      expect(await res.text()).toBe("");
      expect(events.getLastEvent()).toBe("result-timeout");
    });
  });

  describe("POST /queue", () => {
    it("enqueues non-empty script and calls onCommandQueued", async () => {
      const { server, commandQueue, hooks, events } = createQueueServer();
      live.push(server);
      server.start();
      await waitForListening(server);

      const res = await fetch(`http://127.0.0.1:${server.getPort()}/queue`, {
        method: "POST",
        body: "device.setName('SW1');",
      });
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("queued");
      expect(hooks.onCommandQueued).toHaveBeenCalledTimes(1);
      expect(commandQueue.length).toBe(1);
      expect(commandQueue.tryDequeue()).toBe("device.setName('SW1');");
      expect(events.getLastEvent()).toBe("queue-post");
    });

    it("ignores whitespace-only payload without enqueuing but still responds queued", async () => {
      const { server, commandQueue, hooks } = createQueueServer();
      live.push(server);
      server.start();
      await waitForListening(server);

      const res = await fetch(`http://127.0.0.1:${server.getPort()}/queue`, {
        method: "POST",
        body: "   \n\t  ",
      });
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("queued");
      expect(hooks.onCommandQueued).not.toHaveBeenCalled();
      expect(commandQueue.length).toBe(0);
    });

    it("ignores empty body without enqueuing", async () => {
      const { server, commandQueue, hooks } = createQueueServer();
      live.push(server);
      server.start();
      await waitForListening(server);

      const res = await fetch(`http://127.0.0.1:${server.getPort()}/queue`, { method: "POST", body: "" });
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("queued");
      expect(hooks.onCommandQueued).not.toHaveBeenCalled();
      expect(commandQueue.length).toBe(0);
    });
  });

  describe("Unmatched and edge containment", () => {
    it("returns 404 for unknown routes", async () => {
      const { server } = createQueueServer();
      live.push(server);
      server.start();
      await waitForListening(server);

      const res = await fetch(`http://127.0.0.1:${server.getPort()}/unknown-route`);
      expect(res.status).toBe(404);
      expect(await res.text()).toBe("");
    });

    it("contains unhandled route errors with 500 status and internal-error event", async () => {
      const { server, events } = createQueueServer({
        onGetStatus: () => {
          throw new Error("Simulated hook breakdown");
        },
      });
      live.push(server);
      server.start();
      await waitForListening(server);

      const res = await fetch(`http://127.0.0.1:${server.getPort()}/logs`);
      expect(res.status).toBe(500);
      expect(await res.text()).toBe("internal-error");
      expect(events.getLastEvent()).toBe("internal-error");
    });
  });
});
