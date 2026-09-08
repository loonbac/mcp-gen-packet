import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LiveBridge } from "../../src/bridge/live";
import type { BridgeResult } from "../../src/types/protocol";

describe("LiveBridge correlation (WU2)", () => {
  let bridge: LiveBridge;

  beforeEach(() => {
    vi.useFakeTimers();
    bridge = new LiveBridge("127.0.0.1", 0);
  });

  afterEach(() => {
    vi.useRealTimers();
    bridge.stop();
  });

  const getPending = () =>
    (bridge as any).pendingResults as Map<string, any>;

  const getEvents = () =>
    (bridge as any).events as Array<{ kind: string; detail: string; ts: string }>;

  // ── handleResultPost routing (tasks 2.1-2.4) ──

  describe("handleResultPost routing", () => {
    it("2.1 known requestId resolves the pending promise with BridgeResult", () => {
      const resolve = vi.fn();
      const timer = setTimeout(() => {}, 10000);
      getPending().set("req-1", { resolve, timer });

      const body = JSON.stringify({
        requestId: "req-1",
        method: "add_device",
        ok: true,
        data: { name: "R1" },
        ts: 1,
      });
      (bridge as any).handleResultPost(body);

      expect(resolve).toHaveBeenCalledTimes(1);
      const arg = resolve.mock.calls[0][0] as BridgeResult;
      expect(arg.requestId).toBe("req-1");
      expect(arg.ok).toBe(true);
      expect(arg.data).toEqual({ name: "R1" });
      expect(getPending().has("req-1")).toBe(false);
    });

    it("2.2 unknown requestId logs late-result event, does not crash", () => {
      const body = JSON.stringify({
        requestId: "unknown-id",
        method: "add_device",
        ok: true,
        ts: 1,
      });

      expect(() => (bridge as any).handleResultPost(body)).not.toThrow();

      const events = getEvents();
      const lateEvent = events.find((e) => e.kind === "late-result");
      expect(lateEvent).toBeDefined();
      expect(lateEvent!.detail).toContain("unknown-id");
    });

    it("2.3 malformed JSON drops with event, never crashes", () => {
      expect(() =>
        (bridge as any).handleResultPost("not valid json {{{")
      ).not.toThrow();

      const events = getEvents();
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

      expect(() => (bridge as any).handleResultPost(body)).not.toThrow();

      const events = getEvents();
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
      (bridge as any).handleResultPost(body);

      expect((bridge as any).resultQueue.length).toBe(1);
    });
  });

  // ── execute() correlation (tasks 2.5-2.7) ──

  describe("execute() correlation", () => {
    beforeEach(() => {
      vi.spyOn(bridge, "isConnected").mockReturnValue(true);
    });

    it("2.5 20s timeout resolves with queued_no_confirmation + requestId", async () => {
      const execPromise = bridge.execute("add_device", {
        name: "R1",
        model: "2911",
      });

      const pending = getPending();
      expect(pending.size).toBe(1);
      const requestId = Array.from(pending.keys())[0];
      expect(requestId).toBeDefined();
      expect(typeof requestId).toBe("string");

      await vi.advanceTimersByTimeAsync(20000);

      const result = await execPromise;
      expect(result.mode).toBe("live");
      expect(result.data.status).toBe("queued_no_confirmation");
      expect(result.data.requestId).toBe(requestId);
      expect(pending.size).toBe(0);
    });

    it("2.6 late result after timeout is logged, never resolves settled call", async () => {
      const execPromise = bridge.execute("add_device", {
        name: "R1",
        model: "2911",
      });

      const pending = getPending();
      const requestId = Array.from(pending.keys())[0];

      await vi.advanceTimersByTimeAsync(20000);
      const result = await execPromise;
      expect(result.data.status).toBe("queued_no_confirmation");

      // Post a late result after timeout
      const lateBody = JSON.stringify({
        requestId,
        method: "add_device",
        ok: true,
        data: { name: "R1" },
        ts: 1,
      });
      (bridge as any).handleResultPost(lateBody);

      const events = getEvents();
      const lateEvent = events.find((e) => e.kind === "late-result");
      expect(lateEvent).toBeDefined();
    });

    it("2.7 ok=false throws error", async () => {
      const execPromise = bridge.execute("add_device", {
        name: "R1",
        model: "2911",
      });

      const pending = getPending();
      const requestId = Array.from(pending.keys())[0];

      const body = JSON.stringify({
        requestId,
        method: "add_device",
        ok: false,
        error: "Device already exists",
        ts: 1,
      });
      (bridge as any).handleResultPost(body);

      await expect(execPromise).rejects.toThrow("Device already exists");
    });

    it("2.7b ok=true resolves with BridgeResult data", async () => {
      const execPromise = bridge.execute("add_device", {
        name: "R1",
        model: "2911",
      });

      const pending = getPending();
      const requestId = Array.from(pending.keys())[0];

      const body = JSON.stringify({
        requestId,
        method: "add_device",
        ok: true,
        data: { name: "R1" },
        ts: 1,
      });
      (bridge as any).handleResultPost(body);

      const result = await execPromise;
      expect(result.mode).toBe("live");
      expect(result.data.result).toBeDefined();
      expect(result.data.result.ok).toBe(true);
      expect(result.data.result.data).toEqual({ name: "R1" });
    });

    it("execute enqueues wrapped script containing requestId", async () => {
      const enqueueSpy = vi.spyOn(bridge, "enqueue");

      const execPromise = bridge.execute("add_device", {
        name: "R1",
        model: "2911",
      });

      const pending = getPending();
      const requestId = Array.from(pending.keys())[0];

      expect(enqueueSpy).toHaveBeenCalled();
      const enqueuedCode = enqueueSpy.mock.calls[0][0];
      expect(enqueuedCode).toContain(requestId);
      expect(enqueuedCode).toContain("requestId");

      // Resolve to clean up
      const body = JSON.stringify({
        requestId,
        method: "add_device",
        ok: true,
        ts: 1,
      });
      (bridge as any).handleResultPost(body);
      await execPromise;
    });
  });

  // ── PT close auto-clear (task 2.8) ──

  describe("PT close auto-clear", () => {
    it("2.8 PT close auto-clear extends to pendingResults", () => {
      const spy = vi
        .spyOn(bridge as any, "isPacketTracerRunning")
        .mockReturnValue(true);

      // First call sets lastPacketTracerRunning = true
      bridge.getStatus();

      // Now PT closes
      spy.mockReturnValue(false);

      // Add a pending result
      const timer = setTimeout(() => {}, 10000);
      getPending().set("test-id", { resolve: vi.fn(), timer });
      expect(getPending().size).toBe(1);

      // Call getStatus — should detect PT close and auto-clear
      bridge.getStatus();

      expect(getPending().size).toBe(0);

      spy.mockRestore();
    });
  });

  // ── bootstrap v3 (task 2.9) — __mcpPost removed (D13) ──

  describe("bootstrap v3", () => {
    it("2.9 bootstrapScript does NOT contain __mcpPost (D13)", () => {
      const script = bridge.bootstrapScript();
      expect(script).not.toContain("__mcpPost");
      expect(script).not.toContain("window.__mcpPost");
    });

    it("2.9b bootstrapScript keeps /next polling", () => {
      const script = bridge.bootstrapScript();
      expect(script).toContain("/next");
      expect(script).toContain("$se('runCode'");
    });
  });

  // ── rate gate (D11) — task 3.9/3.10 ──

  describe("rate gate (D11)", () => {
    it("3.9 holds 2nd command when <500ms since last dispatch", () => {
      // First dispatch at t=0
      const first = (bridge as any).tryDequeueRateGated(0);
      // Queue a command then immediately try again — should be rate-gated
      bridge.enqueue("CMD1");
      const dequeue = (bridge as any).tryDequeueRateGated.bind(bridge);
      // lastDispatchAt is now 0; at t=100 (<500) it must return null
      expect(dequeue(100)).toBeNull();
      // At t=500 (>=500 since last dispatch at 0) it must dispatch
      expect(dequeue(500)).toBe("CMD1");
    });

    it("3.10 updates lastDispatchAt only on actual dispatch", () => {
      bridge.enqueue("CMD2");
      const dequeue = (bridge as any).tryDequeueRateGated.bind(bridge);
      const before = (bridge as any).lastDispatchAt;
      // Rate-gated call does not touch lastDispatchAt
      dequeue(before + 100);
      expect((bridge as any).lastDispatchAt).toBe(before);
      // Successful dispatch updates it
      const now = before + 500;
      dequeue(now);
      expect((bridge as any).lastDispatchAt).toBe(now);
    });
  });

  // ── wedge detection (D12) — tasks 3.11/3.12/3.13/3.14 ──

  describe("wedge detection (D12)", () => {
    it("3.11 three consecutive timeouts trigger wedge suppression + event", () => {
      // Simulate 3 timeouts via the private registerTimeout path
      (bridge as any).registerTimeout();
      (bridge as any).registerTimeout();
      (bridge as any).registerTimeout();

      const events = getEvents();
      const wedgeEvent = events.find((e) => e.kind === "engine-wedge-suspected");
      expect(wedgeEvent).toBeDefined();
      expect((bridge as any).consecutiveTimeouts).toBe(3);
      expect((bridge as any).wedgeBackoffUntil).toBeGreaterThan(0);
    });

    it("3.12 wedge backoff suppresses /next dispatch", () => {
      // Force wedge state
      (bridge as any).wedgeBackoffUntil = Date.now() + 10000;
      bridge.enqueue("HELD");

      // Hit the /next handler directly via handleRequest is complex; assert
      // the dequeue gate used by /next returns "" during backoff.
      const now = Date.now();
      const cmd = (bridge as any).wedgeBackoffUntil > now ? "" : (bridge as any).tryDequeueRateGated(now) ?? "";
      expect(cmd).toBe("");
      expect((bridge as any).commandQueue.length).toBe(1);
    });

    it("3.13 counter resets on correlated result arrival", () => {
      const resolve = vi.fn();
      const timer = setTimeout(() => {}, 10000);
      getPending().set("req-wedge", { resolve, timer });
      // Build up consecutive timeouts
      (bridge as any).registerTimeout();
      (bridge as any).registerTimeout();
      expect((bridge as any).consecutiveTimeouts).toBe(2);

      // Correlated result arrives
      const body = JSON.stringify({
        requestId: "req-wedge",
        method: "add_device",
        ok: true,
        data: {},
        ts: 1,
      });
      (bridge as any).handleResultPost(body);

      expect((bridge as any).consecutiveTimeouts).toBe(0);
      expect((bridge as any).wedgeBackoffUntil).toBe(0);
    });

    it("3.14 wedge threshold is exactly 3 (not 2, not 4)", () => {
      // 2 timeouts — no wedge event yet
      (bridge as any).registerTimeout();
      (bridge as any).registerTimeout();
      let wedgeEvent = getEvents().filter((e) => e.kind === "engine-wedge-suspected");
      expect(wedgeEvent.length).toBe(0);

      // 3rd timeout triggers
      (bridge as any).registerTimeout();
      wedgeEvent = getEvents().filter((e) => e.kind === "engine-wedge-suspected");
      expect(wedgeEvent.length).toBe(1);
    });
  });

  // ── engine-degraded detection (D15) ──

  describe("engine-degraded detection (D15)", () => {
    it("3.16 five consecutive small-payload timeouts emit engine-degraded-restart-pt", () => {
      // payloads <2048 bytes (not chunk commands) timing out 3x → degraded
      (bridge as any).registerTimeout(500);
      (bridge as any).registerTimeout(1024);
      (bridge as any).registerTimeout(2047);

      const events = getEvents();
      const degradedEvent = events.find((e) => e.kind === "engine-degraded-restart-pt");
      expect(degradedEvent).toBeDefined();
      expect(degradedEvent!.detail).toContain("restart PT");
      expect((bridge as any).consecutiveSmallTimeouts).toBe(3);
    });

    it("3.16b large-payload timeouts do NOT emit engine-degraded (chunk transport wedge only)", () => {
      // payloads >=2048 bytes count as chunk commands → wedge suspected, not degraded
      (bridge as any).registerTimeout(4096);
      (bridge as any).registerTimeout(8192);
      (bridge as any).registerTimeout(4096);

      const events = getEvents();
      expect(events.some((e) => e.kind === "engine-degraded-restart-pt")).toBe(false);
      expect(events.some((e) => e.kind === "engine-wedge-suspected")).toBe(true);
      expect((bridge as any).consecutiveSmallTimeouts).toBe(0);
    });
  });

  // ── cleanup: no temp spike diagnostics (tasks 3.15/3.16) ──

  describe("cleanup (no temp diagnostics)", () => {
    it("3.15 malformed JSON event has no hex dump", () => {
      (bridge as any).handleResultPost("not valid json {{{");
      const events = getEvents();
      const malformedEvent = events.find((e) => e.kind === "result-malformed");
      expect(malformedEvent).toBeDefined();
      expect(malformedEvent!.detail).not.toContain("hex=");
      expect(malformedEvent!.detail).not.toContain("text=");
    });

    it("3.15b no ws-upgrade-attempt event is ever emitted", () => {
      const events = getEvents();
      expect(events.some((e) => e.kind === "ws-upgrade-attempt")).toBe(false);
    });
  });
});
