import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BridgeAdapter } from "../../src/bridge/adapter";
import type { ToolResult } from "../../src/types/protocol";
import { allTools, getTool, primitiveTools, compositeTools } from "../../src/tools/index";
import { deviceCatalog } from "../../src/catalogs/devices";
import { moduleCatalog } from "../../src/catalogs/modules";
import { linkTypeCatalog } from "../../src/catalogs/links";
import { modelInterfaces } from "../../src/catalogs/interfaces";

// Mock BridgeAdapter for testing
const mockBridgeAdapter: BridgeAdapter = {
  execute: vi.fn(),
  isConnected: vi.fn().mockReturnValue(true),
  getMode: vi.fn().mockReturnValue("live"),
  start: vi.fn(),
  stop: vi.fn(),
};

describe("6.1 MCP Server Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBridgeAdapter.execute.mockResolvedValue({ mode: "live", data: {} });
  });

  describe("tool registration", () => {
    it("should have 7 primitive tools", () => {
      expect(primitiveTools).toHaveLength(7);
    });

    it("should have 2 composite tools", () => {
      expect(compositeTools).toHaveLength(2);
    });

    it("should have total of 9 tools", () => {
      expect(allTools).toHaveLength(9);
    });

    it("should be able to lookup primitive tool by name", () => {
      const tool = getTool("packet_tracer_add_device");
      expect(tool).toBeDefined();
      expect(tool?.name).toBe("packet_tracer_add_device");
    });

    it("should be able to lookup composite tool by name", () => {
      const tool = getTool("packet_tracer_create_lan_segment");
      expect(tool).toBeDefined();
      expect(tool?.name).toBe("packet_tracer_create_lan_segment");
    });

    it("should return undefined for unknown tool", () => {
      const tool = getTool("unknown_tool");
      expect(tool).toBeUndefined();
    });
  });

  describe("tool schemas", () => {
    it("each primitive tool should have a Zod inputSchema", () => {
      for (const tool of primitiveTools) {
        expect(tool.inputSchema).toBeDefined();
        expect(typeof tool.inputSchema).toBe("object");
        expect(tool.inputSchema).toHaveProperty("parse");
      }
    });

    it("each composite tool should have a Zod inputSchema", () => {
      for (const tool of compositeTools) {
        expect(tool.inputSchema).toBeDefined();
        expect(typeof tool.inputSchema).toBe("object");
        expect(tool.inputSchema).toHaveProperty("parse");
      }
    });
  });

  describe("catalog resources", () => {
    it("should have device catalog with entries", () => {
      expect(deviceCatalog.size).toBeGreaterThan(0);
    });

    it("should have module catalog with entries", () => {
      expect(moduleCatalog.size).toBeGreaterThan(0);
    });

    it("should have link type catalog with entries", () => {
      expect(linkTypeCatalog.size).toBeGreaterThan(0);
    });

    it("should have interfaces map with entries", () => {
      expect(modelInterfaces.size).toBeGreaterThan(0);
    });
  });

  describe("tool execution", () => {
    it("should execute add_device through bridge", async () => {
      const tool = getTool("packet_tracer_add_device");
      expect(tool).toBeDefined();

      const params = { name: "R1", model: "2911", x: 100, y: 200 };
      await tool!.execute(mockBridgeAdapter, params);

      expect(mockBridgeAdapter.execute).toHaveBeenCalledWith("add_device", params);
    });

    it("should execute get_devices through bridge", async () => {
      const tool = getTool("packet_tracer_get_devices");
      expect(tool).toBeDefined();

      const params = { filter: "router" };
      await tool!.execute(mockBridgeAdapter, params);

      expect(mockBridgeAdapter.execute).toHaveBeenCalledWith("get_devices", params);
    });

    it("should execute composite tool through bridge", async () => {
      const tool = getTool("packet_tracer_create_lan_segment");
      expect(tool).toBeDefined();

      const params = { name: "TestLAN", subnet: "192.168.1.0", hosts: 2 };
      await tool!.execute(mockBridgeAdapter, params);

      expect(mockBridgeAdapter.execute).toHaveBeenCalled();
    });
  });
});