import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import type { BridgeAdapter } from "../../../src/bridge/adapter";
import type { ToolResult } from "../../../src/types/protocol";

// Mock BridgeAdapter
const mockBridgeAdapter: BridgeAdapter = {
  execute: vi.fn(),
  isConnected: vi.fn().mockReturnValue(true),
  getMode: vi.fn().mockReturnValue("live"),
  start: vi.fn(),
  stop: vi.fn(),
};

// Import tools after mocking
import {
  addDeviceTool,
  addLinkTool,
  addModuleTool,
  configurePcIpTool,
  configureIosDeviceTool,
  getDevicesTool,
} from "../../../src/tools/primitive/index";

describe("4.1 Primitive Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("add-device tool", () => {
    it("should have correct name", () => {
      expect(addDeviceTool.name).toBe("packet_tracer_add_device");
    });

    it("should have input schema with required name and model", () => {
      const schema = addDeviceTool.inputSchema;
      expect(schema.shape.name).toBeDefined();
      expect(schema.shape.model).toBeDefined();
    });

    it("should have optional x and y parameters", () => {
      const schema = addDeviceTool.inputSchema;
      expect(schema.shape.x).toBeDefined();
      expect(schema.shape.y).toBeDefined();
    });

    it("should execute bridge with correct method", async () => {
      const params = { name: "R1", model: "2911", x: 100, y: 200 };
      const expectedResult: ToolResult = { mode: "live", data: { deviceId: "R1" } };
      mockBridgeAdapter.execute.mockResolvedValue(expectedResult);

      const result = await addDeviceTool.execute(mockBridgeAdapter, params);

      expect(mockBridgeAdapter.execute).toHaveBeenCalledWith("add_device", params);
      expect(result).toEqual(expectedResult);
    });
  });

  describe("add-link tool", () => {
    it("should have correct name", () => {
      expect(addLinkTool.name).toBe("packet_tracer_add_link");
    });

    it("should have input schema with required device/interface params", () => {
      const schema = addLinkTool.inputSchema;
      expect(schema.shape.device1).toBeDefined();
      expect(schema.shape.interface1).toBeDefined();
      expect(schema.shape.device2).toBeDefined();
      expect(schema.shape.interface2).toBeDefined();
    });

    it("should have optional type parameter", () => {
      const schema = addLinkTool.inputSchema;
      expect(schema.shape.type).toBeDefined();
    });

    it("should execute bridge with correct method", async () => {
      const params = {
        device1: "R1",
        interface1: "GigabitEthernet0/0",
        device2: "S1",
        interface2: "FastEthernet0/1",
        type: "ethernet-straight",
      };
      const expectedResult: ToolResult = { mode: "live", data: { linkId: "L1" } };
      mockBridgeAdapter.execute.mockResolvedValue(expectedResult);

      const result = await addLinkTool.execute(mockBridgeAdapter, params);

      expect(mockBridgeAdapter.execute).toHaveBeenCalledWith("add_link", params);
      expect(result).toEqual(expectedResult);
    });
  });

  describe("add-module tool", () => {
    it("should have correct name", () => {
      expect(addModuleTool.name).toBe("packet_tracer_add_module");
    });

    it("should have input schema with required device, slot, model", () => {
      const schema = addModuleTool.inputSchema;
      expect(schema.shape.device).toBeDefined();
      expect(schema.shape.slot).toBeDefined();
      expect(schema.shape.model).toBeDefined();
    });

    it("should execute bridge with correct method", async () => {
      const params = { device: "R1", slot: 0, model: "HWIC-1T" };
      const expectedResult: ToolResult = { mode: "live", data: { success: true } };
      mockBridgeAdapter.execute.mockResolvedValue(expectedResult);

      const result = await addModuleTool.execute(mockBridgeAdapter, params);

      expect(mockBridgeAdapter.execute).toHaveBeenCalledWith("add_module", params);
      expect(result).toEqual(expectedResult);
    });
  });

  describe("configure-pc-ip tool", () => {
    it("should have correct name", () => {
      expect(configurePcIpTool.name).toBe("packet_tracer_configure_pc_ip");
    });

    it("should have input schema with required device", () => {
      const schema = configurePcIpTool.inputSchema;
      expect(schema.shape.device).toBeDefined();
    });

    it("should have optional dhcp, ip, subnetMask, gateway, dnsServer", () => {
      const schema = configurePcIpTool.inputSchema;
      expect(schema.shape.dhcp).toBeDefined();
      expect(schema.shape.ip).toBeDefined();
      expect(schema.shape.subnetMask).toBeDefined();
      expect(schema.shape.gateway).toBeDefined();
      expect(schema.shape.dnsServer).toBeDefined();
    });

    it("should execute bridge with correct method", async () => {
      const params = {
        device: "PC1",
        ip: "192.168.1.10",
        subnetMask: "255.255.255.0",
        gateway: "192.168.1.1",
      };
      const expectedResult: ToolResult = { mode: "live", data: { success: true } };
      mockBridgeAdapter.execute.mockResolvedValue(expectedResult);

      const result = await configurePcIpTool.execute(mockBridgeAdapter, params);

      expect(mockBridgeAdapter.execute).toHaveBeenCalledWith("configure_pc_ip", params);
      expect(result).toEqual(expectedResult);
    });
  });

  describe("configure-ios-device tool", () => {
    it("should have correct name", () => {
      expect(configureIosDeviceTool.name).toBe("packet_tracer_configure_ios_device");
    });

    it("should have input schema with required device and commands", () => {
      const schema = configureIosDeviceTool.inputSchema;
      expect(schema.shape.device).toBeDefined();
      expect(schema.shape.commands).toBeDefined();
    });

    it("should execute bridge with correct method", async () => {
      const params = {
        device: "R1",
        commands: "enable\nconfigure terminal\nhostname Router1",
      };
      const expectedResult: ToolResult = { mode: "live", data: { success: true } };
      mockBridgeAdapter.execute.mockResolvedValue(expectedResult);

      const result = await configureIosDeviceTool.execute(mockBridgeAdapter, params);

      expect(mockBridgeAdapter.execute).toHaveBeenCalledWith("configure_ios_device", params);
      expect(result).toEqual(expectedResult);
    });
  });

  describe("get-devices tool", () => {
    it("should have correct name", () => {
      expect(getDevicesTool.name).toBe("packet_tracer_get_devices");
    });

    it("should have input schema with optional filter and startsWith", () => {
      const schema = getDevicesTool.inputSchema;
      expect(schema.shape.filter).toBeDefined();
      expect(schema.shape.startsWith).toBeDefined();
    });

    it("should execute bridge with correct method", async () => {
      const params = { filter: "router", startsWith: "R" };
      const expectedResult: ToolResult = {
        mode: "live",
        data: { devices: [{ name: "R1", model: "2911" }] },
      };
      mockBridgeAdapter.execute.mockResolvedValue(expectedResult);

      const result = await getDevicesTool.execute(mockBridgeAdapter, params);

      expect(mockBridgeAdapter.execute).toHaveBeenCalledWith("get_devices", params);
      expect(result).toEqual(expectedResult);
    });
  });
});