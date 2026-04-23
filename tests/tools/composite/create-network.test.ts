import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BridgeAdapter } from "../../../src/bridge/adapter";
import { createNetworkTool } from "../../../src/tools/composite/create-network";

// Mock BridgeAdapter
const mockBridgeAdapter: BridgeAdapter = {
  execute: vi.fn(),
  isConnected: vi.fn().mockReturnValue(true),
  getMode: vi.fn().mockReturnValue("live"),
  start: vi.fn(),
  stop: vi.fn(),
};

describe("5.4 Create Network Composite Tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(createNetworkTool.name).toBe("packet_tracer_create_network");
  });

  it("should have input schema with vlans and hosts_per_vlan", () => {
    const schema = createNetworkTool.inputSchema;
    expect(schema.shape.vlans).toBeDefined();
    expect(schema.shape.hostsPerVlan).toBeDefined();
  });

  it("should create one switch per VLAN", async () => {
    const params = {
      vlans: [
        { id: 10, name: "Sales" },
        { id: 20, name: "Engineering" },
      ],
      hostsPerVlan: 3,
    };

    await createNetworkTool.execute(mockBridgeAdapter, params);

    const addDeviceCalls = mockBridgeAdapter.execute.mock.calls.filter(
      ([m]) => m === "add_device"
    );

    // Should have 2 switches (one per VLAN) + 6 hosts = 8 devices
    const switchDevices = addDeviceCalls.filter(([, p]) =>
      (p as Record<string, unknown>).model === "Switch-PT"
    );
    expect(switchDevices).toHaveLength(2);
  });

  it("should create correct number of hosts per VLAN", async () => {
    const params = {
      vlans: [
        { id: 10, name: "Sales" },
        { id: 20, name: "Engineering" },
      ],
      hostsPerVlan: 3,
    };

    await createNetworkTool.execute(mockBridgeAdapter, params);

    const addDeviceCalls = mockBridgeAdapter.execute.mock.calls.filter(
      ([m]) => m === "add_device"
    );

    // Should have 2 switches + 6 hosts = 8 total
    expect(addDeviceCalls).toHaveLength(8);
  });

  it("should configure VLANs on switches", async () => {
    const params = {
      vlans: [
        { id: 10, name: "Sales" },
        { id: 20, name: "Engineering" },
      ],
      hostsPerVlan: 3,
    };

    await createNetworkTool.execute(mockBridgeAdapter, params);

    const configureIosCalls = mockBridgeAdapter.execute.mock.calls.filter(
      ([m]) => m === "configure_ios_device"
    );

    // Should configure VLANs on each switch
    expect(configureIosCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("should assign unique subnets per VLAN", async () => {
    const params = {
      vlans: [
        { id: 10, name: "Sales" },
        { id: 20, name: "Engineering" },
      ],
      hostsPerVlan: 2,
    };

    await createNetworkTool.execute(mockBridgeAdapter, params);

    const configurePcIpCalls = mockBridgeAdapter.execute.mock.calls
      .filter(([m]) => m === "configure_pc_ip")
      .map(([, p]) => p as { ip: string });

    // Extract unique subnets
    const subnets = new Set(
      configurePcIpCalls
        .map((p) => p.ip.split(".").slice(0, 3).join("."))
    );

    expect(subnets.size).toBeGreaterThanOrEqual(2);
  });
});