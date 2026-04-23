import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BridgeAdapter } from "../../../src/bridge/adapter";
import type { ToolResult } from "../../../src/types/protocol";
import { createLanSegmentTool } from "../../../src/tools/composite/create-lan-segment";

// Mock BridgeAdapter
const mockBridgeAdapter: BridgeAdapter = {
  execute: vi.fn(),
  isConnected: vi.fn().mockReturnValue(true),
  getMode: vi.fn().mockReturnValue("live"),
  start: vi.fn(),
  stop: vi.fn(),
};

describe("5.4 Create LAN Segment Composite Tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementation that returns successful results
    mockBridgeAdapter.execute.mockImplementation(async (method: string, params: Record<string, unknown>) => {
      if (method === "add_device") {
        return { mode: "live" as const, data: { deviceId: params.name } };
      }
      if (method === "configure_pc_ip" || method === "configure_ios_device") {
        return { mode: "live" as const, data: { success: true } };
      }
      if (method === "add_link") {
        return { mode: "live" as const, data: { linkId: "L1" } };
      }
      return { mode: "live" as const, data: {} };
    });
  });

  it("should have correct name", () => {
    expect(createLanSegmentTool.name).toBe("packet_tracer_create_lan_segment");
  });

  it("should have input schema with segment name, subnet, and host count", () => {
    const schema = createLanSegmentTool.inputSchema;
    expect(schema.shape.name).toBeDefined();
    expect(schema.shape.subnet).toBeDefined();
    expect(schema.shape.hosts).toBeDefined();
  });

  it("should create gateway device plus host devices", async () => {
    const params = {
      name: "Sales",
      subnet: "192.168.1.0",
      hosts: 3,
    };

    const result = await createLanSegmentTool.execute(mockBridgeAdapter, params);

    // Should call add_device for gateway + 3 hosts = 4 devices
    const addDeviceCalls = mockBridgeAdapter.execute.mock.calls.filter(
      ([m]) => m === "add_device"
    );
    expect(addDeviceCalls).toHaveLength(4);
  });

  it("should assign gateway at .1 address", async () => {
    const params = {
      name: "Sales",
      subnet: "192.168.1.0",
      hosts: 3,
    };

    await createLanSegmentTool.execute(mockBridgeAdapter, params);

    // Find the configure_pc_ip call for the gateway
    const configureCalls = mockBridgeAdapter.execute.mock.calls.filter(
      ([m]) => m === "configure_pc_ip"
    );
    const gatewayConfig = configureCalls.find(([, p]) =>
      (p as Record<string, unknown>).ip === "192.168.1.1"
    );
    expect(gatewayConfig).toBeDefined();
  });

  it("should assign host IPs starting at .2", async () => {
    const params = {
      name: "Sales",
      subnet: "192.168.1.0",
      hosts: 3,
    };

    await createLanSegmentTool.execute(mockBridgeAdapter, params);

    // Find the configure_pc_ip calls for hosts
    const configureCalls = mockBridgeAdapter.execute.mock.calls.filter(
      ([m]) => m === "configure_pc_ip"
    );
    const hostIps = configureCalls
      .filter(([, p]) => (p as Record<string, unknown>).ip !== "192.168.1.1")
      .map(([, p]) => (p as Record<string, unknown>).ip);

    expect(hostIps).toContain("192.168.1.2");
    expect(hostIps).toContain("192.168.1.3");
    expect(hostIps).toContain("192.168.1.4");
  });

  it("should create links between hosts and gateway", async () => {
    const params = {
      name: "Sales",
      subnet: "192.168.1.0",
      hosts: 3,
    };

    await createLanSegmentTool.execute(mockBridgeAdapter, params);

    // Should have add_link calls for each host
    const addLinkCalls = mockBridgeAdapter.execute.mock.calls.filter(
      ([m]) => m === "add_link"
    );
    expect(addLinkCalls.length).toBeGreaterThanOrEqual(3);
  });

  it("should use auto-layout for device positioning", async () => {
    const params = {
      name: "Sales",
      subnet: "192.168.1.0",
      hosts: 3,
    };

    await createLanSegmentTool.execute(mockBridgeAdapter, params);

    // Check that devices have non-overlapping coordinates
    const addDeviceCalls = mockBridgeAdapter.execute.mock.calls
      .filter(([m]) => m === "add_device")
      .map(([, p]) => p as { name: string; x: number; y: number });

    // Each device should have unique or spaced positions
    for (let i = 0; i < addDeviceCalls.length; i++) {
      for (let j = i + 1; j < addDeviceCalls.length; j++) {
        const dx = Math.abs(addDeviceCalls[j].x - addDeviceCalls[i].x);
        const dy = Math.abs(addDeviceCalls[j].y - addDeviceCalls[i].y);
        const distance = Math.sqrt(dx * dx + dy * dy);
        expect(distance).toBeGreaterThanOrEqual(150);
      }
    }
  });
});