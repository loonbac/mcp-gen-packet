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

import {
  getPcConfigTool,
  getDeviceStateTool,
  getTopologyTool,
  getDeviceConfigTool,
} from "../../../src/tools/primitive/index";

describe("4.8 get-pc-config tool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should have correct name", () => {
    expect(getPcConfigTool.name).toBe("packet_tracer_get_pc_config");
  });

  it("should have input schema with required device", () => {
    const schema = getPcConfigTool.inputSchema as z.ZodObject<any>;
    expect(schema.shape.device).toBeDefined();
  });

  it("should execute bridge with correct method", async () => {
    const expected: ToolResult = { mode: "live", data: { ip: "10.0.0.1" } };
    mockBridgeAdapter.execute.mockResolvedValue(expected);

    const result = await getPcConfigTool.execute(mockBridgeAdapter, { device: "PC1" });

    expect(mockBridgeAdapter.execute).toHaveBeenCalledWith("get_pc_config", { device: "PC1" });
    expect(result).toEqual(expected);
  });
});

describe("4.10 get-topology tool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should have correct name", () => {
    expect(getTopologyTool.name).toBe("packet_tracer_get_topology");
  });

  it("should have optional maxDevices parameter", () => {
    const schema = getTopologyTool.inputSchema as z.ZodObject<any>;
    expect(schema.shape.maxDevices).toBeDefined();
  });

  it("should execute bridge with correct method", async () => {
    const expected: ToolResult = { mode: "live", data: { devices: [] } };
    mockBridgeAdapter.execute.mockResolvedValue(expected);

    const result = await getTopologyTool.execute(mockBridgeAdapter, {});

    expect(mockBridgeAdapter.execute).toHaveBeenCalledWith("get_topology", {});
    expect(result).toEqual(expected);
  });
});

describe("4.12 get-device-state tool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should have correct name", () => {
    expect(getDeviceStateTool.name).toBe("packet_tracer_get_device_state");
  });

  it("should have input schema with required device", () => {
    const schema = getDeviceStateTool.inputSchema as z.ZodObject<any>;
    expect(schema.shape.device).toBeDefined();
  });

  it("should execute bridge with correct method", async () => {
    const expected: ToolResult = { mode: "live", data: { power: true } };
    mockBridgeAdapter.execute.mockResolvedValue(expected);

    const result = await getDeviceStateTool.execute(mockBridgeAdapter, { device: "R1" });

    expect(mockBridgeAdapter.execute).toHaveBeenCalledWith("get_device_state", { device: "R1" });
    expect(result).toEqual(expected);
  });
});

describe("4.14 get-device-config tool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should have correct name", () => {
    expect(getDeviceConfigTool.name).toBe("packet_tracer_get_device_config");
  });

  it("should have schema with device, include_secrets, format", () => {
    const schema = getDeviceConfigTool.inputSchema as z.ZodObject<any>;
    expect(schema.shape.device).toBeDefined();
    expect(schema.shape.include_secrets).toBeDefined();
    expect(schema.shape.format).toBeDefined();
  });

  it("should execute bridge with chunk params and reassemble", async () => {
    // Single short chunk (< chunk size) completes the fetch in one call.
    mockBridgeAdapter.execute.mockResolvedValue({
      mode: "live",
      data: { result: { data: { chunk: '<DEVICE_ACTIVITY_TREE ID="x"/>', start: 0, end: 28, total: 28 } } },
    });

    const result = await getDeviceConfigTool.execute(mockBridgeAdapter, { device: "R1" });

    expect(mockBridgeAdapter.execute.mock.calls[0][0]).toBe("get_device_config");
    expect(mockBridgeAdapter.execute.mock.calls[0][1]).toMatchObject({ device: "R1", start: 0 });
    expect(result.mode).toBe("live");
    expect((result.data as any).config).toBeDefined();
  });

  it("should request default 4096-byte chunk on first call", async () => {
    mockBridgeAdapter.execute.mockResolvedValue({
      mode: "live",
      data: { result: { data: { chunk: '<DEVICE_ACTIVITY_TREE ID="x"/>', start: 0, end: 28, total: 28 } } },
    });

    await getDeviceConfigTool.execute(mockBridgeAdapter, { device: "R1", format: "ios" });

    const callArgs = mockBridgeAdapter.execute.mock.calls[0][1] as Record<string, unknown>;
    expect(callArgs.device).toBe("R1");
    expect(callArgs.start).toBe(0);
    expect(callArgs.end).toBe(4096);
  });

  it("should return ios-formatted output when format=ios", async () => {
    mockBridgeAdapter.execute.mockResolvedValue({
      mode: "live",
      data: { result: { data: { chunk: '<DEVICE_ACTIVITY_TREE ID="x"/>', start: 0, end: 28, total: 28 } } },
    });

    const result = await getDeviceConfigTool.execute(mockBridgeAdapter, { device: "R1", format: "ios" });

    expect(typeof (result.data as any).config).toBe("string");
  });
});
