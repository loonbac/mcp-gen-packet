import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveBridge } from "../../../../src/core/infra/bridge/live-bridge.js";
import {
  HttpBridgeServer,
  type HttpBridgeServerHooks,
} from "../../../../src/core/infra/bridge/http-bridge-server.js";
import { AsyncQueue } from "../../../../src/core/utils/async/async-queue.js";
import { EventBuffer } from "../../../../src/core/infra/bridge/event-buffer.js";
import type { BridgeResult } from "../../../../src/core/types/bridge.js";

interface CircuitHarness {
  bridge: LiveBridge;
  server: HttpBridgeServer;
  commandQueue: AsyncQueue<string>;
  resultQueue: AsyncQueue<string>;
  events: EventBuffer;
  detector: { running: boolean; isPacketTracerRunning: () => boolean };
  clock: {
    now: number;
    advance: (ms: number) => void;
  };
  uuidGen: {
    nextId: string;
    set: (id: string) => void;
  };
}

function createCircuitHarness(options?: {
  executionTimeoutMs?: number;
  commandSpacingMs?: number;
}): CircuitHarness {
  let currentTime = 1_000_000;
  let currentUuid = "req-001";
  const clock = {
    get now() {
      return currentTime;
    },
    advance: (ms: number) => {
      currentTime += ms;
    },
  };
  const uuidGen = {
    get nextId() {
      return currentUuid;
    },
    set: (id: string) => {
      currentUuid = id;
    },
  };

  const detector = {
    running: true,
    isPacketTracerRunning: () => detector.running,
  };
  const events = new EventBuffer(200);
  const commandQueue = new AsyncQueue<string>();
  const resultQueue = new AsyncQueue<string>();

  let capturedServerHooks: HttpBridgeServerHooks | null = null;
  let serverInstance: HttpBridgeServer | null = null;

  const bridge = new LiveBridge("127.0.0.1", 54321, {
    detector,
    events,
    commandQueue,
    resultQueue,
    clock: () => clock.now,
    uuidGenerator: () => uuidGen.nextId,
    executionTimeoutMs: options?.executionTimeoutMs ?? 20000,
    commandSpacingMs: options?.commandSpacingMs ?? 500,
    logger: () => {},
    serverFactory: (serverOpts) => {
      capturedServerHooks = serverOpts.hooks;
      serverInstance = new HttpBridgeServer({
        ...serverOpts,
        // port 0 avoids binding real ports
        port: 0,
        clock: () => clock.now,
      });
      return {
        start: () => {},
        stop: () => {},
        isListening: () => true,
      };
    },
  });

  return {
    bridge,
    get server() {
      if (!serverInstance) throw new Error("Server not initialized");
      return serverInstance;
    },
    commandQueue,
    resultQueue,
    events,
    detector,
    clock,
    uuidGen,
  };
}

describe("Saito result correlation circuit (ports/infra)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("End-to-end request-response correlation", () => {
    it("correlates pending result by requestId and resolves execute() promise", async () => {
      const h = createCircuitHarness();
      // Establish polling connection
      h.bridge.getStatus();
      h.server["hooks"].onPoll(h.clock.now);
      expect(h.bridge.isConnected()).toBe(true);

      h.uuidGen.set("req-correlate-42");
      const execPromise = h.bridge.execute("add_device", {
        name: "Router1",
        model: "2911",
      });

      // Verify command script enqueued with requestId
      expect(h.commandQueue.length).toBe(1);
      const enqueuedScript = h.commandQueue.tryDequeue()!;
      expect(enqueuedScript).toContain("req-correlate-42");
      expect(enqueuedScript).toContain("addDevice");
      expect(h.bridge.getPendingResultsCount()).toBe(1);

      // Simulate PT posting correlated result
      const ptResponse: BridgeResult = {
        requestId: "req-correlate-42",
        method: "add_device",
        ok: true,
        data: { name: "Router1", created: true },
        ts: h.clock.now,
      };
      h.bridge.handleResultPost(JSON.stringify(ptResponse));

      const toolResult = await execPromise;
      expect(toolResult.mode).toBe("live");
      expect(toolResult.data).toEqual({
        method: "add_device",
        params: { name: "Router1", model: "2911" },
        result: ptResponse,
        code: expect.any(String),
      });

      // Pending results cleaned up and telemetry logged
      expect(h.bridge.getPendingResultsCount()).toBe(0);
      expect(h.events.getLastEvent()).toBe("result-correlated");
    });

    it("correlates multiple interleaved out-of-order requests accurately", async () => {
      const h = createCircuitHarness();
      h.server["hooks"].onPoll(h.clock.now);

      h.uuidGen.set("req-A");
      const pA = h.bridge.execute("add_device", { name: "A" });

      h.uuidGen.set("req-B");
      const pB = h.bridge.execute("add_device", { name: "B" });

      h.uuidGen.set("req-C");
      const pC = h.bridge.execute("add_device", { name: "C" });

      expect(h.bridge.getPendingResultsCount()).toBe(3);

      // Deliver responses out of order: B, then C, then A
      h.bridge.handleResultPost(
        JSON.stringify({
          requestId: "req-B",
          method: "add_device",
          ok: true,
          data: { id: "B" },
          ts: h.clock.now,
        })
      );
      const resB = await pB;
      expect((resB.data as { result: BridgeResult }).result.data).toEqual({ id: "B" });
      expect(h.bridge.getPendingResultsCount()).toBe(2);

      h.bridge.handleResultPost(
        JSON.stringify({
          requestId: "req-C",
          method: "add_device",
          ok: true,
          data: { id: "C" },
          ts: h.clock.now,
        })
      );
      const resC = await pC;
      expect((resC.data as { result: BridgeResult }).result.data).toEqual({ id: "C" });
      expect(h.bridge.getPendingResultsCount()).toBe(1);

      h.bridge.handleResultPost(
        JSON.stringify({
          requestId: "req-A",
          method: "add_device",
          ok: true,
          data: { id: "A" },
          ts: h.clock.now,
        })
      );
      const resA = await pA;
      expect((resA.data as { result: BridgeResult }).result.data).toEqual({ id: "A" });
      expect(h.bridge.getPendingResultsCount()).toBe(0);
    });

    it("throws error with PT error message when ok is false", async () => {
      const h = createCircuitHarness();
      h.server["hooks"].onPoll(h.clock.now);

      h.uuidGen.set("req-fail");
      const p = h.bridge.execute("add_link", { device1: "R1", device2: "R2" });

      h.bridge.handleResultPost(
        JSON.stringify({
          requestId: "req-fail",
          method: "add_link",
          ok: false,
          error: "Interface FastEthernet0/0 already occupied",
          ts: h.clock.now,
        })
      );

      await expect(p).rejects.toThrow("Interface FastEthernet0/0 already occupied");
      expect(h.bridge.getPendingResultsCount()).toBe(0);
    });
  });

  describe("Timeout handling and recovery", () => {
    it("returns queued_no_confirmation on 20s timeout without throwing", async () => {
      const h = createCircuitHarness({ executionTimeoutMs: 20000 });
      h.server["hooks"].onPoll(h.clock.now);

      h.uuidGen.set("req-timeout-1");
      const p = h.bridge.execute("add_device", { name: "R-Slow" });
      expect(h.bridge.getPendingResultsCount()).toBe(1);

      // Advance clock and timer past 20s
      h.clock.advance(20000);
      await vi.advanceTimersByTimeAsync(20000);

      const res = await p;
      expect(res.mode).toBe("live");
      expect(res.data).toMatchObject({
        method: "add_device",
        status: "queued_no_confirmation",
        requestId: "req-timeout-1",
      });
      expect(h.bridge.getPendingResultsCount()).toBe(0);
      expect(h.bridge.getConsecutiveTimeouts()).toBe(1);
    });

    it("drops late-arriving results after timeout without crashing or re-resolving", async () => {
      const h = createCircuitHarness({ executionTimeoutMs: 10000 });
      h.server["hooks"].onPoll(h.clock.now);

      h.uuidGen.set("req-late");
      const p = h.bridge.execute("add_device", { name: "R-Late" });

      // Expire timeout
      h.clock.advance(10000);
      await vi.advanceTimersByTimeAsync(10000);
      await p;

      // Late response arrives 5s later
      h.bridge.handleResultPost(
        JSON.stringify({
          requestId: "req-late",
          method: "add_device",
          ok: true,
          data: { created: true },
          ts: h.clock.now,
        })
      );

      expect(h.events.getLastEvent()).toBe("late-result");
      expect(h.resultQueue.length).toBe(0);
    });
  });

  describe("Rate gating (COMMAND_SPACING_MS = 500)", () => {
    it("suppresses /next dispatch when polls arrive faster than COMMAND_SPACING_MS", () => {
      const h = createCircuitHarness({ commandSpacingMs: 500 });
      h.commandQueue.enqueue("cmd-1;");
      h.commandQueue.enqueue("cmd-2;");

      // Poll 1 at T=1,000,000 dispatches cmd-1
      const cmd1 = h.server["tryDequeueRateGated"](h.clock.now);
      expect(cmd1).toBe("cmd-1;");

      // Poll 2 at T=1,000,200 (200ms < 500ms) gets rate-gated (null)
      h.clock.advance(200);
      const cmd2Blocked = h.server["tryDequeueRateGated"](h.clock.now);
      expect(cmd2Blocked).toBeNull();
      expect(h.commandQueue.length).toBe(1);

      // Poll 3 at T=1,000,500 (500ms elapsed since dispatch) dispatches cmd-2
      h.clock.advance(300);
      const cmd2 = h.server["tryDequeueRateGated"](h.clock.now);
      expect(cmd2).toBe("cmd-2;");
      expect(h.commandQueue.length).toBe(0);
    });
  });

  describe("Wedge detection & degraded-engine circuit", () => {
    it("triggers wedge suppression after 3 consecutive timeouts and clears on correlated result", async () => {
      const h = createCircuitHarness({ executionTimeoutMs: 5000 });
      h.server["hooks"].onPoll(h.clock.now);

      expect(h.bridge.isWedgeSuppressed()).toBe(false);

      // Timeout 1
      h.uuidGen.set("t1");
      const p1 = h.bridge.execute("add_device", { name: "D1" });
      h.clock.advance(5000);
      await vi.advanceTimersByTimeAsync(5000);
      await p1;
      expect(h.bridge.getConsecutiveTimeouts()).toBe(1);
      expect(h.bridge.isWedgeSuppressed()).toBe(false);

      // Timeout 2
      h.uuidGen.set("t2");
      const p2 = h.bridge.execute("add_device", { name: "D2" });
      h.clock.advance(5000);
      await vi.advanceTimersByTimeAsync(5000);
      await p2;
      expect(h.bridge.getConsecutiveTimeouts()).toBe(2);
      expect(h.bridge.isWedgeSuppressed()).toBe(false);

      // Timeout 3 -> reaches WEDGE_THRESHOLD = 3
      h.uuidGen.set("t3");
      const p3 = h.bridge.execute("add_device", { name: "D3" });
      h.clock.advance(5000);
      await vi.advanceTimersByTimeAsync(5000);
      await p3;
      expect(h.bridge.getConsecutiveTimeouts()).toBe(3);
      expect(h.bridge.isWedgeSuppressed()).toBe(true);
      expect(h.events.getRecent().some((e) => e.kind === "engine-wedge-suspected")).toBe(true);
      expect(h.bridge.getWedgeBackoffUntil()).toBe(h.clock.now + 10000);

      // While in wedge suppression, dispatch is suppressed
      h.commandQueue.enqueue("blocked-cmd;");
      expect(h.server["isWedgeSuppressed"](h.clock.now)).toBe(true);

      // A successful correlated response clears wedge state immediately
      h.uuidGen.set("t-recovery");
      const pRecover = h.bridge.execute("add_device", { name: "Recover" });
      h.bridge.handleResultPost(
        JSON.stringify({
          requestId: "t-recovery",
          method: "add_device",
          ok: true,
          data: { recovered: true },
          ts: h.clock.now,
        })
      );
      await pRecover;

      expect(h.bridge.isWedgeSuppressed()).toBe(false);
      expect(h.bridge.getConsecutiveTimeouts()).toBe(0);
      expect(h.bridge.getWedgeBackoffUntil()).toBe(0);
    });

    it("detects engine degraded state on 3 consecutive small-payload timeouts (<2KB)", async () => {
      const h = createCircuitHarness({ executionTimeoutMs: 1000 });
      h.server["hooks"].onPoll(h.clock.now);

      for (let i = 1; i <= 3; i++) {
        h.uuidGen.set(`small-t-${i}`);
        const p = h.bridge.execute("add_device", { name: `small-${i}` });
        h.clock.advance(1000);
        await vi.advanceTimersByTimeAsync(1000);
        await p;
      }

      expect(h.bridge.getConsecutiveSmallTimeouts()).toBe(3);
      expect(h.events.getLastEvent()).toBe("engine-degraded-restart-pt");
    });

    it("resets consecutiveSmallTimeouts when a large payload (>=2KB) times out", async () => {
      const h = createCircuitHarness({ executionTimeoutMs: 1000 });
      h.server["hooks"].onPoll(h.clock.now);

      // 2 small timeouts
      for (let i = 1; i <= 2; i++) {
        h.uuidGen.set(`small-${i}`);
        const p = h.bridge.execute("add_device", { name: `s-${i}` });
        h.clock.advance(1000);
        await vi.advanceTimersByTimeAsync(1000);
        await p;
      }
      expect(h.bridge.getConsecutiveSmallTimeouts()).toBe(2);

      // 1 large timeout (> 2048 bytes script)
      h.uuidGen.set("large-cmd");
      const largeCommands = "conf t\n" + "ip route 10.0.0.0 255.255.255.0 1.1.1.1\n".repeat(80);
      const pLarge = h.bridge.execute("configure_ios_device", {
        device: "R1",
        commands: largeCommands,
      });
      h.clock.advance(1000);
      await vi.advanceTimersByTimeAsync(1000);
      await pLarge;

      // Small timeouts counter reset to 0
      expect(h.bridge.getConsecutiveSmallTimeouts()).toBe(0);
    });
  });

  describe("Legacy fallback and malformed inputs", () => {
    it("routes JSON payloads without requestId to resultQueue for legacy backward compatibility", () => {
      const h = createCircuitHarness();

      // Legacy string encoded as JSON without requestId
      h.bridge.handleResultPost(JSON.stringify("SUCCESS: old-style-plain-response"));
      expect(h.resultQueue.length).toBe(1);
      expect(h.resultQueue.tryDequeue()).toBe(JSON.stringify("SUCCESS: old-style-plain-response"));
      expect(h.events.getLastEvent()).toBe("result-legacy");

      // JSON object without requestId
      h.bridge.handleResultPost(JSON.stringify({ ok: true, data: "legacy-json" }));
      expect(h.resultQueue.length).toBe(1);
      expect(h.events.getLastEvent()).toBe("result-legacy");
    });

    it("discards malformed non-JSON payloads with result-malformed event", () => {
      const h = createCircuitHarness();
      h.bridge.handleResultPost("{ broken json ::::");
      expect(h.resultQueue.length).toBe(0);
      expect(h.events.getLastEvent()).toBe("result-malformed");
    });

    it("discards payloads with non-string requestId with result-malformed-request-id", () => {
      const h = createCircuitHarness();
      h.bridge.handleResultPost(JSON.stringify({ requestId: 12345, ok: true }));
      expect(h.resultQueue.length).toBe(0);
      expect(h.events.getLastEvent()).toBe("result-malformed-request-id");
    });
  });

  describe("Queue & PendingResult lifecycle cleanup", () => {
    it("clearPendingResults drops resultQueue and cancels all pending result timers", async () => {
      const h = createCircuitHarness();
      h.server["hooks"].onPoll(h.clock.now);

      h.resultQueue.enqueue("res-1");
      h.resultQueue.enqueue("res-2");

      h.uuidGen.set("p-1");
      const p1 = h.bridge.execute("add_device", { name: "R1" });
      h.uuidGen.set("p-2");
      const p2 = h.bridge.execute("add_device", { name: "R2" });

      expect(h.bridge.getPendingResultsCount()).toBe(2);

      const dropped = h.bridge.clearPendingResults();
      expect(dropped).toBe(4); // 2 results + 2 pending
      expect(h.bridge.getPendingResultsCount()).toBe(0);
      expect(h.resultQueue.length).toBe(0);
      expect(h.events.getLastEvent()).toBe("result-clear");

      // Cancelled pending promises resolve null -> status queued_no_confirmation
      const r1 = await p1;
      const r2 = await p2;
      expect(r1.data).toMatchObject({ status: "queued_no_confirmation" });
      expect(r2.data).toMatchObject({ status: "queued_no_confirmation" });
    });

    it("clears pending results when Packet Tracer process terminates", async () => {
      const h = createCircuitHarness();
      h.detector.running = true;
      h.server["hooks"].onPoll(h.clock.now);
      h.bridge.getStatus(); // initialize lastPacketTracerRunning = true

      h.uuidGen.set("pending-pt-close");
      const p = h.bridge.execute("add_device", { name: "R-Close" });
      expect(h.bridge.getPendingResultsCount()).toBe(1);

      // Packet Tracer process stops
      h.detector.running = false;
      const status = h.bridge.getStatus();

      expect(status.connected).toBe(false);
      expect(status.lastEvent).toBe("queue-auto-cleared");
      expect(h.bridge.getPendingResultsCount()).toBe(0);

      const res = await p;
      expect(res.data).toMatchObject({ status: "queued_no_confirmation" });
    });
  });
});
