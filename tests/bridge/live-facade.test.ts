import { describe, it, expect, vi, afterEach } from "vitest";
import { expectTypeOf } from "vitest";
import { LiveBridge } from "../../src/bridge/live.js";
import type { BridgeStatus } from "../../src/bridge/live.js";
import { LiveBridge as CanonicalLiveBridge } from "../../src/core/infra/bridge/live-bridge.js";
import type { BridgeStatus as CanonicalBridgeStatus, BridgePort } from "../../src/core/ports/bridge-port.js";
import type { BridgeAdapter } from "../../src/bridge/adapter.js";

describe("Live Bridge Façade & Historical Compatibility (S4d.4)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Re-exports Contract", () => {
    it("re-exports canonical LiveBridge from src/core/infra/bridge/live-bridge.js", () => {
      expect(LiveBridge).toBe(CanonicalLiveBridge);
    });

    it("verifies type equivalence between historical BridgeStatus and canonical BridgeStatus", () => {
      expectTypeOf<BridgeStatus>().toEqualTypeOf<CanonicalBridgeStatus>();
    });
  });

  describe("Historical Instantiation & Public API", () => {
    it("instantiates LiveBridge with (host, port) matching BridgeAdapter and BridgePort contracts", () => {
      const bridge = new LiveBridge("127.0.0.1", 54321);

      expectTypeOf(bridge).toMatchTypeOf<BridgePort>();
      expectTypeOf(bridge).toMatchTypeOf<BridgeAdapter>();

      expect(typeof bridge.start).toBe("function");
      expect(typeof bridge.stop).toBe("function");
      expect(typeof bridge.enqueue).toBe("function");
      expect(typeof bridge.clearPendingResults).toBe("function");
      expect(typeof bridge.sendAndWait).toBe("function");
      expect(typeof bridge.bootstrapScript).toBe("function");
      expect(typeof bridge.getStatus).toBe("function");
      expect(typeof bridge.isConnected).toBe("function");
      expect(typeof bridge.getMode).toBe("function");
      expect(typeof bridge.execute).toBe("function");
    });

    it("returns offline script mode result when packet tracer is disconnected", async () => {
      const bridge = new LiveBridge("127.0.0.1", 54322);

      expect(bridge.isConnected()).toBe(false);
      expect(bridge.getMode()).toBe("live");

      const result = await bridge.execute("add_device", { name: "R1", model: "2911" });
      expect(result.mode).toBe("script");
      expect(result.data).toEqual({ method: "add_device", params: { name: "R1", model: "2911" } });
      expect(typeof result.code).toBe("string");
      expect(result.code).toContain('addDevice("R1", "2911"');
    });

    it("generates bootstrap script containing configured host and port", () => {
      const bridge = new LiveBridge("10.0.0.1", 45678);
      const script = bridge.bootstrapScript();

      expect(script).toContain("10.0.0.1");
      expect(script).toContain("45678");
    });

    it("provides getStatus() telemetry with all expected historical fields", () => {
      const bridge = new LiveBridge("127.0.0.1", 54323);
      const status = bridge.getStatus();

      expect(status).toHaveProperty("running");
      expect(status).toHaveProperty("connected");
      expect(status).toHaveProperty("pollingActive");
      expect(status).toHaveProperty("packetTracerRunning");
      expect(status).toHaveProperty("lastPollAgoSeconds");
      expect(status).toHaveProperty("queueDepth");
      expect(status).toHaveProperty("polls");
      expect(status).toHaveProperty("queued");
      expect(status).toHaveProperty("resultsReceived");
      expect(status).toHaveProperty("lastEvent");
    });
  });
});
