import { describe, it, expect, vi, afterEach } from "vitest";
import { expectTypeOf } from "vitest";
import {
  createBridge,
  AutoBridge,
  LiveBridge,
  ScriptBridge,
  type BridgeAdapter,
} from "../../src/bridge/index.js";
import type { BridgeAdapter as DirectBridgeAdapter } from "../../src/bridge/adapter.js";
import type { BridgePort } from "../../src/core/ports/bridge-port.js";
import { AutoBridge as CoreAutoBridge } from "../../src/core/infra/bridge/auto-bridge.js";
import { LiveBridge as CoreLiveBridge } from "../../src/core/infra/bridge/live-bridge.js";

describe("Bridge Module Entrypoint Façades & Composition Root (S4d.3)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Re-exports & Module Export Contracts", () => {
    it("exports canonical AutoBridge from src/core/infra/bridge/auto-bridge.js", () => {
      expect(AutoBridge).toBe(CoreAutoBridge);
    });

    it("exports canonical LiveBridge from src/core/infra/bridge/live-bridge.js", () => {
      expect(LiveBridge).toBe(CoreLiveBridge);
    });

    it("exports ScriptBridge class with valid default mode", () => {
      expect(ScriptBridge).toBeDefined();
      const script = new ScriptBridge();
      expect(script.getMode()).toBe("script");
      expect(script.isConnected()).toBe(false);
    });

    it("verifies type-level equivalence of BridgeAdapter and BridgePort across façades", () => {
      expectTypeOf<BridgeAdapter>().toEqualTypeOf<BridgePort>();
      expectTypeOf<DirectBridgeAdapter>().toEqualTypeOf<BridgePort>();
      expectTypeOf<DirectBridgeAdapter>().toEqualTypeOf<BridgeAdapter>();
    });
  });

  describe("createBridge Composition Root Factory", () => {
    it("wires LiveBridge and ScriptBridge into an AutoBridge instance and calls start()", () => {
      const startSpy = vi.spyOn(CoreLiveBridge.prototype, "start").mockImplementation(() => {});
      const bridge = createBridge(54321);

      expect(bridge).toBeInstanceOf(CoreAutoBridge);
      expect(startSpy).toHaveBeenCalledOnce();
      bridge.stop();
    });

    it("satisfies BridgeAdapter contract structurally with all expected methods", () => {
      const startSpy = vi.spyOn(CoreLiveBridge.prototype, "start").mockImplementation(() => {});
      const bridge = createBridge(54322);

      expect(typeof bridge.execute).toBe("function");
      expect(typeof bridge.isConnected).toBe("function");
      expect(typeof bridge.getMode).toBe("function");
      expect(typeof bridge.start).toBe("function");
      expect(typeof bridge.stop).toBe("function");

      bridge.stop();
    });

    it("defaults to script fallback mode and returns script code when live bridge is offline", async () => {
      const startSpy = vi.spyOn(CoreLiveBridge.prototype, "start").mockImplementation(() => {});
      const bridge = createBridge(54323);

      expect(bridge.isConnected()).toBe(false);
      expect(bridge.getMode()).toBe("script");

      const result = await bridge.execute("add_device", { name: "R1", model: "2911" });
      expect(result.mode).toBe("script");
      expect(result.data).toEqual({ method: "add_device", params: { name: "R1", model: "2911" } });
      expect(typeof result.code).toBe("string");
      expect(result.code).toContain('addDevice("R1", "2911"');

      bridge.stop();
    });

    it("forwards lifecycle start() and stop() calls through to the underlying live bridge", () => {
      const startSpy = vi.spyOn(CoreLiveBridge.prototype, "start").mockImplementation(() => {});
      const stopSpy = vi.spyOn(CoreLiveBridge.prototype, "stop").mockImplementation(() => {});

      const bridge = createBridge(54324);
      expect(startSpy).toHaveBeenCalledTimes(1);

      bridge.start();
      expect(startSpy).toHaveBeenCalledTimes(2);

      bridge.stop();
      expect(stopSpy).toHaveBeenCalledTimes(1);
    });
  });
});
