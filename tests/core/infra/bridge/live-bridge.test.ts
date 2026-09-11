import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveBridge } from "../../../../src/core/infra/bridge/live-bridge.js";
import { AsyncQueue } from "../../../../src/core/utils/async/async-queue.js";
import { EventBuffer } from "../../../../src/core/infra/bridge/event-buffer.js";
import type { HttpBridgeServerHooks } from "../../../../src/core/infra/bridge/http-bridge-server.js";

interface TestHarness {
  bridge: LiveBridge;
  detector: { running: boolean; isPacketTracerRunning: () => boolean };
  events: EventBuffer;
  commandQueue: AsyncQueue<string>;
  resultQueue: AsyncQueue<string>;
  hooks: HttpBridgeServerHooks | null;
  serverState: { listening: boolean; started: number; stopped: number };
  currentTime: number;
}

function createHarness(): TestHarness {
  let currentTime = 1_000_000;
  const detector = {
    running: false,
    isPacketTracerRunning: () => detector.running,
  };
  const events = new EventBuffer(100);
  const commandQueue = new AsyncQueue<string>();
  const resultQueue = new AsyncQueue<string>();
  const serverState = { listening: false, started: 0, stopped: 0 };
  let capturedHooks: HttpBridgeServerHooks | null = null;

  const bridge = new LiveBridge("127.0.0.1", 54321, {
    detector,
    events,
    commandQueue,
    resultQueue,
    clock: () => currentTime,
    logger: () => {},
    serverFactory: (opts) => {
      capturedHooks = opts.hooks;
      return {
        start: () => {
          serverState.started += 1;
          serverState.listening = true;
        },
        stop: () => {
          serverState.stopped += 1;
          serverState.listening = false;
        },
        isListening: () => serverState.listening,
      };
    },
  });

  return {
    bridge,
    detector,
    events,
    commandQueue,
    resultQueue,
    get hooks() {
      return capturedHooks;
    },
    serverState,
    get currentTime() {
      return currentTime;
    },
    set currentTime(t: number) {
      currentTime = t;
    },
  };
}

describe("LiveBridge coordinator (S4d.2)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("evaluates connection heuristics based on polling, process, and grace window", () => {
    const h = createHarness();
    expect(h.bridge.isConnected()).toBe(false);
    expect(h.bridge.getStatus().running).toBe(false);

    // PT running but no polling yet
    h.detector.running = true;
    expect(h.bridge.isConnected()).toBe(false);

    // Simulate poll arriving via server hooks
    h.hooks?.onPoll(h.currentTime);
    expect(h.bridge.isConnected()).toBe(true);
    const status = h.bridge.getStatus();
    expect(status.connected).toBe(true);
    expect(status.pollingActive).toBe(true);
    expect(status.lastPollAgoSeconds).toBe(0);

    // 10s later (> 5s threshold, but < 900s grace)
    h.currentTime += 10_000;
    const graceStatus = h.bridge.getStatus();
    expect(graceStatus.pollingActive).toBe(false);
    expect(graceStatus.connected).toBe(true);
    expect(graceStatus.lastPollAgoSeconds).toBe(10);

    // Past 15min grace period (901s)
    h.currentTime += 891_000;
    expect(h.bridge.isConnected()).toBe(false);

    // If PT process stops during polling, immediately disconnected
    h.hooks?.onPoll(h.currentTime);
    expect(h.bridge.isConnected()).toBe(true);
    h.detector.running = false;
    expect(h.bridge.isConnected()).toBe(false);
  });

  it("auto-clears both queues and resets state when Packet Tracer transitions true -> false", () => {
    const h = createHarness();
    h.detector.running = true;
    h.bridge.getStatus(); // initialize lastPacketTracerRunning = true

    h.hooks?.onPoll(h.currentTime);
    h.commandQueue.enqueue("cmd1;");
    h.commandQueue.enqueue("cmd2;");
    h.resultQueue.enqueue("res1");

    expect(h.commandQueue.length).toBe(2);
    expect(h.resultQueue.length).toBe(1);

    // Transition PT process to false
    h.detector.running = false;
    const status = h.bridge.getStatus();

    expect(status.connected).toBe(false);
    expect(status.queueDepth).toBe(0);
    expect(h.commandQueue.length).toBe(0);
    expect(h.resultQueue.length).toBe(0);
    expect(status.lastEvent).toBe("queue-auto-cleared");
    expect(status.lastPollAgoSeconds).toBeNull();
  });

  it("executes in script fallback mode when disconnected without enqueuing", async () => {
    const h = createHarness();
    expect(h.bridge.isConnected()).toBe(false);

    const result = await h.bridge.execute("add_device", { name: "R1", model: "2911" });
    expect(result.mode).toBe("script");
    expect(result.data).toEqual({ method: "add_device", params: { name: "R1", model: "2911" } });
    expect(typeof result.code).toBe("string");
    expect(result.code).toContain("addDevice");
    expect(h.commandQueue.length).toBe(0);
  });

  it("executes in live mode when connected, resolving result from resultQueue", async () => {
    const h = createHarness();
    h.detector.running = true;
    h.hooks?.onPoll(h.currentTime);
    expect(h.bridge.isConnected()).toBe(true);

    const execPromise = h.bridge.execute("add_device", { name: "R1", model: "2911" });

    // Verify command was enqueued
    expect(h.commandQueue.length).toBe(1);
    const queuedCmd = h.commandQueue.tryDequeue();
    expect(queuedCmd).toContain("addDevice");

    // Simulate PT returning result
    h.resultQueue.enqueue("SUCCESS: R1 created");
    const result = await execPromise;

    expect(result.mode).toBe("live");
    expect(result.data).toMatchObject({
      method: "add_device",
      result: "SUCCESS: R1 created",
    });
  });

  it("returns queued_no_confirmation on 20s execution timeout without throwing", async () => {
    const h = createHarness();
    h.detector.running = true;
    h.hooks?.onPoll(h.currentTime);

    const execPromise = h.bridge.execute("add_device", { name: "R1", model: "2911" });
    expect(h.commandQueue.length).toBe(1);

    // Advance fake timer past 20,000ms
    await vi.advanceTimersByTimeAsync(20_000);
    const result = await execPromise;

    expect(result.mode).toBe("live");
    expect(result.data).toMatchObject({
      method: "add_device",
      status: "queued_no_confirmation",
    });
  });

  it("throws Error when result starts with ERROR (case-insensitive)", async () => {
    const h = createHarness();
    h.detector.running = true;
    h.hooks?.onPoll(h.currentTime);

    const p1 = h.bridge.execute("add_device", { name: "R1" });
    h.resultQueue.enqueue("ERROR: Device model not recognized");
    await expect(p1).rejects.toThrow("ERROR: Device model not recognized");

    const p2 = h.bridge.execute("add_device", { name: "R2" });
    h.resultQueue.enqueue("error: syntax invalid");
    await expect(p2).rejects.toThrow("error: syntax invalid");
  });

  it("sendAndWait enqueues command and awaits result with timeout", async () => {
    const h = createHarness();
    const waitPromise = h.bridge.sendAndWait("ping();", 5000);
    expect(h.commandQueue.length).toBe(1);

    h.resultQueue.enqueue("pong");
    const result = await waitPromise;
    expect(result).toBe("pong");

    // Timeout returns null
    const timeoutPromise = h.bridge.sendAndWait("no-reply();", 3000);
    await vi.advanceTimersByTimeAsync(3000);
    expect(await timeoutPromise).toBeNull();
  });

  it("discards pending results and delegates bootstrap script generation", () => {
    const h = createHarness();
    h.resultQueue.enqueue("r1");
    h.resultQueue.enqueue("r2");
    expect(h.bridge.clearPendingResults()).toBe(2);
    expect(h.bridge.clearPendingResults()).toBe(0);

    const script = h.bridge.bootstrapScript();
    expect(script).toContain("http://127.0.0.1:54321/next");
  });

  it("controls server lifecycle idempotently and supports rapid polling", () => {
    const h = createHarness();
    expect(h.bridge.getStatus().running).toBe(false);
    h.bridge.start();
    expect(h.serverState.started).toBe(1);
    expect(h.bridge.getStatus().running).toBe(true);
    h.bridge.stop();
    expect(h.serverState.stopped).toBe(1);
    expect(h.bridge.getStatus().running).toBe(false);

    // Rapid status checks do not fail or throw
    for (let i = 0; i < 50; i++) {
      expect(h.bridge.getStatus()).toBeDefined();
    }
    expect(h.bridge.getMode()).toBe("live");
  });

  it("supports options-only constructor and manual enqueue tracking", () => {
    const events = new EventBuffer(50);
    const commandQueue = new AsyncQueue<string>();
    const bridge = new LiveBridge({
      host: "0.0.0.0",
      port: 9999,
      events,
      commandQueue,
      serverFactory: () => ({
        start: () => {},
        stop: () => {},
        isListening: () => true,
      }),
    });

    bridge.enqueue("device.select();");
    expect(commandQueue.length).toBe(1);
    const status = bridge.getStatus();
    expect(status.queued).toBe(1);
    expect(status.queueDepth).toBe(1);
    expect(status.lastEvent).toBe("enqueue");
    expect(bridge.bootstrapScript()).toContain("http://0.0.0.0:9999/next");
  });
});
