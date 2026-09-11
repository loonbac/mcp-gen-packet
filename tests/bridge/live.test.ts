import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LiveBridge } from "../../src/core/infra/bridge/live-bridge.js";
import {
  HttpBridgeServer,
  type HttpBridgeServerHooks,
} from "../../src/core/infra/bridge/http-bridge-server.js";
import { EventBuffer } from "../../src/core/infra/bridge/event-buffer.js";
import { AsyncQueue } from "../../src/core/utils/async/async-queue.js";
import type { BridgeResult } from "../../src/types/protocol.js";

interface TestHarness {
  bridge: LiveBridge;
  server: HttpBridgeServer;
  serverHooks: HttpBridgeServerHooks;
  commandQueue: AsyncQueue<string>;
  resultQueue: AsyncQueue<string>;
  events: EventBuffer;
  detector: { running: boolean; isPacketTracerRunning: () => boolean };
  clock: { now: number; advance: (ms: number) => void };
  uuidGen: { nextId: string; set: (id: string) => void };
  simulatePoll: () => void;
}

function createTestHarness(options?: {
  executionTimeoutMs?: number;
  commandSpacingMs?: number;
}): TestHarness {
  let currentTime = 1_000_000;
  let currentUuid = "req-1";
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
  const events = new EventBuffer(400);
  const commandQueue = new AsyncQueue<string>();
  const resultQueue = new AsyncQueue<string>();

  let capturedServerHooks!: HttpBridgeServerHooks;
  let serverInstance!: HttpBridgeServer;

  const bridge = new LiveBridge("127.0.0.1", 54321, {
    detector,
    events,
    commandQueue,
    resultQueue,
    clock: () => clock.now,
    uuidGenerator: () => uuidGen.nextId,
    executionTimeoutMs: options?.executionTimeoutMs ?? LiveBridge.DEFAULT_EXECUTION_TIMEOUT_MS,
    commandSpacingMs: options?.commandSpacingMs ?? LiveBridge.COMMAND_SPACING_MS,
    logger: () => {},
    serverFactory: (serverOpts) => {
      capturedServerHooks = serverOpts.hooks;
      serverInstance = new HttpBridgeServer({
        ...serverOpts,
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

  const simulatePoll = () => {
    bridge.getStatus();
    capturedServerHooks.onPoll(clock.now);
  };

  return {
    bridge,
    get server() {
      return serverInstance;
    },
    get serverHooks() {
      return capturedServerHooks;
    },
    commandQueue,
    resultQueue,
    events,
    detector,
    clock,
    uuidGen,
    simulatePoll,
  };
}

describe("LiveBridge correlation (WU2)", () => {
  let harness: TestHarness;

  beforeEach(() => {
    vi.useFakeTimers();
    harness = createTestHarness();
  });

  afterEach(() => {
    vi.useRealTimers();
    harness.bridge.stop();
  });

  // ── handleResultPost routing (tasks 2.1-2.4) ──

  describe("handleResultPost routing", () => {
    it("2.1 known requestId resolves the pending promise with BridgeResult", async () => {
      harness.simulatePoll();
      harness.uuidGen.set("req-1");
      const execPromise = harness.bridge.execute("add_device", { name: "R1" });

      expect(harness.bridge.getPendingResultsCount()).toBe(1);

      const body = JSON.stringify({
        requestId: "req-1",
        method: "add_device",
        ok: true,
        data: { name: "R1" },
        ts: 1,
      });
      harness.bridge.handleResultPost(body);

      const result = await execPromise;
      expect(result.mode).toBe("live");
      const bridgeResult = (result.data as { result: BridgeResult }).result;
      expect(bridgeResult.requestId).toBe("req-1");
      expect(bridgeResult.ok).toBe(true);
      expect(bridgeResult.data).toEqual({ name: "R1" });
      expect(harness.bridge.getPendingResultsCount()).toBe(0);
    });

    it("2.2 unknown requestId logs late-result event, does not crash", () => {
      const body = JSON.stringify({
        requestId: "unknown-id",
        method: "add_device",
        ok: true,
        ts: 1,
      });

      expect(() => harness.bridge.handleResultPost(body)).not.toThrow();

      const events = harness.events.getRecent();
      const lateEvent = events.find((e) => e.kind === "late-result");
      expect(lateEvent).toBeDefined();
      expect(lateEvent!.detail).toContain("unknown-id");
    });

    it("2.3 malformed JSON drops with event, never crashes", () => {
      expect(() =>
        harness.bridge.handleResultPost("not valid json {{{")
      ).not.toThrow();

      const events = harness.events.getRecent();
      const malformedEvent = events.find((e) => e.kind === "result-malformed");
      expect(malformedEvent).toBeDefined();
    });

    it("2.3b requestId present but non-string drops with event", () => {
      const body = JSON.stringify({
        requestId: 12345,
        method: "add_device",
        ok: true,
        ts: 1,
      });

      expect(() => harness.bridge.handleResultPost(body)).not.toThrow();

      const events = harness.events.getRecent();
      const malformedEvent = events.find(
        (e) => e.kind === "result-malformed-request-id"
      );
      expect(malformedEvent).toBeDefined();
    });

    it("2.4 absent requestId falls back to legacy resultQueue", () => {
      const body = JSON.stringify({
        method: "add_device",
        ok: true,
        ts: 1,
      });
      harness.bridge.handleResultPost(body);

      expect(harness.resultQueue.length).toBe(1);
    });
  });

  // ── execute() correlation (tasks 2.5-2.7) ──

  describe("execute() correlation", () => {
    beforeEach(() => {
      harness.simulatePoll();
    });

    it("2.5 20s timeout resolves with queued_no_confirmation + requestId", async () => {
      harness.uuidGen.set("req-timeout-1");
      const execPromise = harness.bridge.execute("add_device", {
        name: "R1",
        model: "2911",
      });

      expect(harness.bridge.getPendingResultsCount()).toBe(1);

      harness.clock.advance(20000);
      await vi.advanceTimersByTimeAsync(20000);

      const result = await execPromise;
      expect(result.mode).toBe("live");
      expect((result.data as { status: string }).status).toBe("queued_no_confirmation");
      expect((result.data as { requestId: string }).requestId).toBe("req-timeout-1");
      expect(harness.bridge.getPendingResultsCount()).toBe(0);
    });

    it("2.6 late result after timeout is logged, never resolves settled call", async () => {
      harness.uuidGen.set("req-late-1");
      const execPromise = harness.bridge.execute("add_device", {
        name: "R1",
        model: "2911",
      });

      harness.clock.advance(20000);
      await vi.advanceTimersByTimeAsync(20000);
      const result = await execPromise;
      expect((result.data as { status: string }).status).toBe("queued_no_confirmation");

      // Post a late result after timeout
      const lateBody = JSON.stringify({
        requestId: "req-late-1",
        method: "add_device",
        ok: true,
        data: { name: "R1" },
        ts: 1,
      });
      harness.bridge.handleResultPost(lateBody);

      const events = harness.events.getRecent();
      const lateEvent = events.find((e) => e.kind === "late-result");
      expect(lateEvent).toBeDefined();
    });

    it("2.7 ok=false throws error", async () => {
      harness.uuidGen.set("req-err-1");
      const execPromise = harness.bridge.execute("add_device", {
        name: "R1",
        model: "2911",
      });

      const body = JSON.stringify({
        requestId: "req-err-1",
        method: "add_device",
        ok: false,
        error: "Device already exists",
        ts: 1,
      });
      harness.bridge.handleResultPost(body);

      await expect(execPromise).rejects.toThrow("Device already exists");
    });

    it("2.7b ok=true resolves with BridgeResult data", async () => {
      harness.uuidGen.set("req-ok-1");
      const execPromise = harness.bridge.execute("add_device", {
        name: "R1",
        model: "2911",
      });

      const body = JSON.stringify({
        requestId: "req-ok-1",
        method: "add_device",
        ok: true,
        data: { name: "R1" },
        ts: 1,
      });
      harness.bridge.handleResultPost(body);

      const result = await execPromise;
      expect(result.mode).toBe("live");
      const bridgeResult = (result.data as { result: BridgeResult }).result;
      expect(bridgeResult).toBeDefined();
      expect(bridgeResult.ok).toBe(true);
      expect(bridgeResult.data).toEqual({ name: "R1" });
    });

    it("execute enqueues wrapped script containing requestId", async () => {
      harness.uuidGen.set("req-wrap-1");
      const execPromise = harness.bridge.execute("add_device", {
        name: "R1",
        model: "2911",
      });

      expect(harness.commandQueue.length).toBe(1);
      const enqueuedCode = harness.commandQueue.tryDequeue()!;
      expect(enqueuedCode).toContain("req-wrap-1");
      expect(enqueuedCode).toContain("requestId");

      // Resolve to clean up
      const body = JSON.stringify({
        requestId: "req-wrap-1",
        method: "add_device",
        ok: true,
        ts: 1,
      });
      harness.bridge.handleResultPost(body);
      await execPromise;
    });
  });

  // ── PT close auto-clear (task 2.8) ──

  describe("PT close auto-clear", () => {
    it("2.8 PT close auto-clear extends to pendingResults", () => {
      harness.simulatePoll();
      harness.detector.running = true;

      // First call sets lastPacketTracerRunning = true
      harness.bridge.getStatus();

      // Enqueue a pending command
      harness.uuidGen.set("test-id");
      harness.bridge.execute("add_device", { name: "R1" });
      expect(harness.bridge.getPendingResultsCount()).toBe(1);

      // Now PT closes
      harness.detector.running = false;

      // Call getStatus — should detect PT close and auto-clear
      harness.bridge.getStatus();

      expect(harness.bridge.getPendingResultsCount()).toBe(0);
      expect(harness.events.getLastEvent()).toBe("queue-auto-cleared");
    });
  });

  // ── clearPendingResults ──

  describe("clearPendingResults", () => {
    it("clears all pending results and returns count", () => {
      harness.simulatePoll();

      harness.uuidGen.set("clear-1");
      harness.bridge.execute("add_device", { name: "R1" });
      harness.uuidGen.set("clear-2");
      harness.bridge.execute("add_device", { name: "R2" });

      expect(harness.bridge.getPendingResultsCount()).toBe(2);

      const cleared = harness.bridge.clearPendingResults();
      expect(cleared).toBe(2);
      expect(harness.bridge.getPendingResultsCount()).toBe(0);
      expect(harness.events.getLastEvent()).toBe("result-clear");
    });
  });

  // ── bootstrap v3 (task 2.9) — __mcpPost removed (D13) ──

  describe("bootstrap v3", () => {
    it("2.9 bootstrapScript does NOT contain __mcpPost (D13)", () => {
      const script = harness.bridge.bootstrapScript();
      expect(script).not.toContain("__mcpPost");
      expect(script).not.toContain("window.__mcpPost");
    });

    it("2.9b bootstrapScript keeps /next polling", () => {
      const script = harness.bridge.bootstrapScript();
      expect(script).toContain("/next");
      expect(script).toContain("$se('runCode'");
    });
  });

  // ── rate gate (D11) — task 3.9/3.10 ──

  describe("rate gate (D11)", () => {
    it("3.9 holds 2nd command when <500ms since last dispatch", () => {
      const h = createTestHarness({ commandSpacingMs: 500 });
      h.commandQueue.enqueue("CMD1");
      h.commandQueue.enqueue("CMD2");

      // First dispatch at t=1,000,000
      const first = (h.server as any).tryDequeueRateGated(h.clock.now);
      expect(first).toBe("CMD1");

      // At t=1,000,100 (<500ms elapsed), should be rate-gated (null)
      h.clock.advance(100);
      const blocked = (h.server as any).tryDequeueRateGated(h.clock.now);
      expect(blocked).toBeNull();
      expect(h.commandQueue.length).toBe(1);

      // At t=1,000,500 (500ms elapsed since dispatch), dispatches CMD2
      h.clock.advance(400);
      const second = (h.server as any).tryDequeueRateGated(h.clock.now);
      expect(second).toBe("CMD2");
      expect(h.commandQueue.length).toBe(0);
    });

    it("3.10 updates lastDispatchAt only on actual dispatch", () => {
      const h = createTestHarness({ commandSpacingMs: 500 });
      h.commandQueue.enqueue("CMD2");

      // First dispatch at T=1000 (>=500ms from initial 0)
      const first = (h.server as any).tryDequeueRateGated(1000);
      expect(first).toBe("CMD2");
      expect((h.server as any).lastDispatchAt).toBe(1000);

      // Attempt dispatch 100ms later at T=1100 (<500ms since lastDispatchAt=1000)
      h.commandQueue.enqueue("CMD3");
      const blocked = (h.server as any).tryDequeueRateGated(1100);
      expect(blocked).toBeNull();
      expect((h.server as any).lastDispatchAt).toBe(1000);

      // Successful dispatch after 500ms updates it
      const nextTime = 1000 + 500;
      const ok = (h.server as any).tryDequeueRateGated(nextTime);
      expect(ok).toBe("CMD3");
      expect((h.server as any).lastDispatchAt).toBe(nextTime);
    });
  });

  // ── wedge detection (D12) — tasks 3.11/3.12/3.13/3.14 ──

  describe("wedge detection (D12)", () => {
    it("3.11 three consecutive timeouts trigger wedge suppression + event", async () => {
      const h = createTestHarness({ executionTimeoutMs: 5000 });
      h.simulatePoll();

      for (let i = 1; i <= 3; i++) {
        h.uuidGen.set(`to-${i}`);
        const p = h.bridge.execute("add_device", { name: `D-${i}` });
        h.clock.advance(5000);
        await vi.advanceTimersByTimeAsync(5000);
        await p;
      }

      const events = h.events.getRecent();
      const wedgeEvent = events.find((e) => e.kind === "engine-wedge-suspected");
      expect(wedgeEvent).toBeDefined();
      expect(h.bridge.getConsecutiveTimeouts()).toBe(3);
      expect(h.bridge.getWedgeBackoffUntil()).toBeGreaterThan(0);
      expect(h.bridge.isWedgeSuppressed()).toBe(true);
    });

    it("3.12 wedge backoff suppresses /next dispatch", async () => {
      const h = createTestHarness({ executionTimeoutMs: 5000 });
      h.simulatePoll();

      // Trigger wedge by 3 timeouts
      for (let i = 1; i <= 3; i++) {
        h.uuidGen.set(`to-${i}`);
        const p = h.bridge.execute("add_device", { name: `D-${i}` });
        h.clock.advance(5000);
        await vi.advanceTimersByTimeAsync(5000);
        await p;
      }

      expect(h.bridge.isWedgeSuppressed()).toBe(true);
      expect((h.server as any).isWedgeSuppressed(h.clock.now)).toBe(true);

      h.commandQueue.clear();
      h.commandQueue.enqueue("HELD");
      expect(h.commandQueue.length).toBe(1);
    });

    it("3.13 counter resets on correlated result arrival", async () => {
      const h = createTestHarness({ executionTimeoutMs: 5000 });
      h.simulatePoll();

      // 2 timeouts
      for (let i = 1; i <= 2; i++) {
        h.uuidGen.set(`to-${i}`);
        const p = h.bridge.execute("add_device", { name: `D-${i}` });
        h.clock.advance(5000);
        await vi.advanceTimersByTimeAsync(5000);
        await p;
      }
      expect(h.bridge.getConsecutiveTimeouts()).toBe(2);

      // Correlated result arrives
      h.uuidGen.set("req-wedge");
      const pSuccess = h.bridge.execute("add_device", { name: "Recover" });
      const body = JSON.stringify({
        requestId: "req-wedge",
        method: "add_device",
        ok: true,
        data: {},
        ts: 1,
      });
      h.bridge.handleResultPost(body);
      await pSuccess;

      expect(h.bridge.getConsecutiveTimeouts()).toBe(0);
      expect(h.bridge.getWedgeBackoffUntil()).toBe(0);
      expect(h.bridge.isWedgeSuppressed()).toBe(false);
    });

    it("3.14 wedge threshold is exactly 3 (not 2, not 4)", async () => {
      const h = createTestHarness({ executionTimeoutMs: 5000 });
      h.simulatePoll();

      // 2 timeouts
      for (let i = 1; i <= 2; i++) {
        h.uuidGen.set(`to-${i}`);
        const p = h.bridge.execute("add_device", { name: `D-${i}` });
        h.clock.advance(5000);
        await vi.advanceTimersByTimeAsync(5000);
        await p;
      }
      let wedgeEvents = h.events.getRecent().filter((e) => e.kind === "engine-wedge-suspected");
      expect(wedgeEvents.length).toBe(0);

      // 3rd timeout triggers
      h.uuidGen.set("to-3");
      const p3 = h.bridge.execute("add_device", { name: "D-3" });
      h.clock.advance(5000);
      await vi.advanceTimersByTimeAsync(5000);
      await p3;

      wedgeEvents = h.events.getRecent().filter((e) => e.kind === "engine-wedge-suspected");
      expect(wedgeEvents.length).toBe(1);
    });
  });

  // ── engine-degraded detection (D15) ──

  describe("engine-degraded detection (D15)", () => {
    it("3.16 three consecutive small-payload timeouts emit engine-degraded-restart-pt", async () => {
      const h = createTestHarness({ executionTimeoutMs: 1000 });
      h.simulatePoll();

      for (let i = 1; i <= 3; i++) {
        h.uuidGen.set(`small-${i}`);
        const p = h.bridge.execute("add_device", { name: `small-${i}` });
        h.clock.advance(1000);
        await vi.advanceTimersByTimeAsync(1000);
        await p;
      }

      const events = h.events.getRecent();
      const degradedEvent = events.find((e) => e.kind === "engine-degraded-restart-pt");
      expect(degradedEvent).toBeDefined();
      expect(degradedEvent!.detail).toContain("restart PT");
      expect(h.bridge.getConsecutiveSmallTimeouts()).toBe(3);
    });

    it("3.16b large-payload timeouts do NOT emit engine-degraded (chunk transport wedge only)", async () => {
      const h = createTestHarness({ executionTimeoutMs: 1000 });
      h.simulatePoll();

      for (let i = 1; i <= 3; i++) {
        h.uuidGen.set(`large-${i}`);
        const p = h.bridge.execute("add_device", { name: "x".repeat(2500) });
        h.clock.advance(1000);
        await vi.advanceTimersByTimeAsync(1000);
        await p;
      }

      const events = h.events.getRecent();
      expect(events.some((e) => e.kind === "engine-degraded-restart-pt")).toBe(false);
      expect(events.some((e) => e.kind === "engine-wedge-suspected")).toBe(true);
      expect(h.bridge.getConsecutiveSmallTimeouts()).toBe(0);
    });
  });

  // ── cleanup: no temp spike diagnostics (tasks 3.15/3.16) ──

  describe("cleanup (no temp diagnostics)", () => {
    it("3.15 malformed JSON event has no hex dump", () => {
      harness.bridge.handleResultPost("not valid json {{{");
      const events = harness.events.getRecent();
      const malformedEvent = events.find((e) => e.kind === "result-malformed");
      expect(malformedEvent).toBeDefined();
      expect(malformedEvent!.detail).not.toContain("hex=");
      expect(malformedEvent!.detail).not.toContain("text=");
    });

    it("3.15b no ws-upgrade-attempt event is ever emitted", () => {
      const events = harness.events.getRecent();
      expect(events.some((e) => e.kind === "ws-upgrade-attempt")).toBe(false);
    });
  });
});
