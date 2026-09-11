import { describe, expect, it, vi } from "vitest";
import { AutoBridge } from "../../../../src/core/infra/bridge/auto-bridge.js";
import type { BridgePort } from "../../../../src/core/ports/bridge-port.js";
import type { ToolResult } from "../../../../src/core/types/tools.js";

function createMockBridge(overrides: Partial<BridgePort> = {}): BridgePort {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    isConnected: vi.fn().mockReturnValue(false),
    getMode: vi.fn().mockReturnValue("script"),
    execute: vi.fn().mockResolvedValue({ mode: "script", data: {} } satisfies ToolResult),
    ...overrides,
  };
}

describe("AutoBridge", () => {
  describe("Lifecycle Delegation", () => {
    it("should forward start() exclusively to live bridge", () => {
      const live = createMockBridge();
      const script = createMockBridge();
      const auto = new AutoBridge(live, script);

      auto.start();

      expect(live.start).toHaveBeenCalledTimes(1);
      expect(script.start).not.toHaveBeenCalled();
    });

    it("should forward stop() exclusively to live bridge", () => {
      const live = createMockBridge();
      const script = createMockBridge();
      const auto = new AutoBridge(live, script);

      auto.stop();

      expect(live.stop).toHaveBeenCalledTimes(1);
      expect(script.stop).not.toHaveBeenCalled();
    });
  });

  describe("Connection State & Execution Mode", () => {
    it("should delegate isConnected() directly to live bridge", () => {
      const live = createMockBridge({ isConnected: vi.fn().mockReturnValue(true) });
      const script = createMockBridge({ isConnected: vi.fn().mockReturnValue(false) });
      const auto = new AutoBridge(live, script);

      expect(auto.isConnected()).toBe(true);
      expect(live.isConnected).toHaveBeenCalledTimes(1);
      expect(script.isConnected).not.toHaveBeenCalled();
    });

    it("should return 'live' mode when live bridge is connected", () => {
      const live = createMockBridge({ isConnected: vi.fn().mockReturnValue(true) });
      const script = createMockBridge();
      const auto = new AutoBridge(live, script);

      expect(auto.getMode()).toBe("live");
    });

    it("should return 'script' mode when live bridge is disconnected", () => {
      const live = createMockBridge({ isConnected: vi.fn().mockReturnValue(false) });
      const script = createMockBridge();
      const auto = new AutoBridge(live, script);

      expect(auto.getMode()).toBe("script");
    });

    it("should reflect dynamic changes in live connection state without caching", () => {
      let connected = false;
      const live = createMockBridge({ isConnected: vi.fn(() => connected) });
      const script = createMockBridge();
      const auto = new AutoBridge(live, script);

      expect(auto.getMode()).toBe("script");
      expect(auto.isConnected()).toBe(false);

      connected = true;
      expect(auto.getMode()).toBe("live");
      expect(auto.isConnected()).toBe(true);

      connected = false;
      expect(auto.getMode()).toBe("script");
      expect(auto.isConnected()).toBe(false);
    });
  });

  describe("Command Execution Routing", () => {
    it("should delegate execute() to live bridge when connected", async () => {
      const expectedResult: ToolResult = {
        mode: "live",
        data: { id: "dev1", status: "created" },
        code: "addDevice()",
      };
      const live = createMockBridge({
        isConnected: vi.fn().mockReturnValue(true),
        execute: vi.fn().mockResolvedValue(expectedResult),
      });
      const script = createMockBridge();
      const auto = new AutoBridge(live, script);

      const params = { name: "R1", model: "2911" };
      const result = await auto.execute("add_device", params);

      expect(result).toEqual(expectedResult);
      expect(live.execute).toHaveBeenCalledTimes(1);
      expect(live.execute).toHaveBeenCalledWith("add_device", params);
      expect(script.execute).not.toHaveBeenCalled();
    });

    it("should delegate execute() to script bridge when disconnected", async () => {
      const expectedResult: ToolResult = {
        mode: "script",
        data: { method: "add_device" },
        code: "// script fallback",
      };
      const live = createMockBridge({
        isConnected: vi.fn().mockReturnValue(false),
      });
      const script = createMockBridge({
        execute: vi.fn().mockResolvedValue(expectedResult),
      });
      const auto = new AutoBridge(live, script);

      const params = { name: "R1", model: "2911" };
      const result = await auto.execute("add_device", params);

      expect(result).toEqual(expectedResult);
      expect(script.execute).toHaveBeenCalledTimes(1);
      expect(script.execute).toHaveBeenCalledWith("add_device", params);
      expect(live.execute).not.toHaveBeenCalled();
    });

    it("should propagate errors thrown by live bridge when connected", async () => {
      const live = createMockBridge({
        isConnected: vi.fn().mockReturnValue(true),
        execute: vi.fn().mockRejectedValue(new Error("Packet Tracer IPC error")),
      });
      const script = createMockBridge();
      const auto = new AutoBridge(live, script);

      await expect(auto.execute("add_device", {})).rejects.toThrow(
        "Packet Tracer IPC error",
      );
      expect(script.execute).not.toHaveBeenCalled();
    });

    it("should propagate errors thrown by script bridge when disconnected", async () => {
      const live = createMockBridge({
        isConnected: vi.fn().mockReturnValue(false),
      });
      const script = createMockBridge({
        execute: vi.fn().mockRejectedValue(new Error("Script generation failed")),
      });
      const auto = new AutoBridge(live, script);

      await expect(auto.execute("add_device", {})).rejects.toThrow(
        "Script generation failed",
      );
      expect(live.execute).not.toHaveBeenCalled();
    });
  });
});
