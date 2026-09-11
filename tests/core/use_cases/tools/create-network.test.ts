import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CompositeBridge } from "../../../../src/core/pipelines/types.js";
import { createNetworkUseCase } from "../../../../src/core/use_cases/tools/create-network.js";

function makeMockBridge(mode: "live" | "mock" = "live"): CompositeBridge {
  return {
    getMode: () => mode,
    execute: vi.fn().mockResolvedValue({ success: true }),
  };
}

describe("createNetworkUseCase", () => {
  it("executes multi-VLAN network generation and maps ToolResult<CreateNetworkData>", async () => {
    const bridge = makeMockBridge();
    const result = await createNetworkUseCase(bridge, {
      vlans: [
        { id: 10, name: "HR" },
        { id: 20, name: "Engineering" },
      ],
      hostsPerVlan: 2,
    });

    expect(result.mode).toBe("live");
    expect(result.data.vlans).toHaveLength(2);
    expect(result.data.hostsPerVlan).toBe(2);
    expect(result.data.allDevices).toHaveLength(6);
    expect(result.data.operations).toHaveLength(18);
    expect(bridge.execute).toHaveBeenCalledTimes(18);
  });

  it("ensures SubnetAllocator isolation across successive calls without module-level state", async () => {
    const bridge = makeMockBridge();

    const result1 = await createNetworkUseCase(bridge, {
      vlans: [{ id: 10, name: "VLAN1" }],
      hostsPerVlan: 1,
    });

    const result2 = await createNetworkUseCase(bridge, {
      vlans: [{ id: 10, name: "VLAN1" }],
      hostsPerVlan: 1,
    });

    // In both calls, the first VLAN must receive 10.0.1.1 as gateway IP
    const pcIpCall1 = (bridge.execute as any).mock.calls.find(
      ([m, p]: [string, any]) => m === "configure_pc_ip" && p.device === "VLAN10-SW",
    );
    expect(pcIpCall1[1].ip).toBe("10.0.1.1");

    // The second call must also start fresh at 10.0.1.1 (zero contamination)
    const pcIpCalls = (bridge.execute as any).mock.calls.filter(
      ([m, p]: [string, any]) => m === "configure_pc_ip" && p.device === "VLAN10-SW",
    );
    expect(pcIpCalls[1][1].ip).toBe("10.0.1.1");
  });

  it("handles operation failures resiliently without throwing", async () => {
    const bridge = makeMockBridge();
    (bridge.execute as any).mockRejectedValueOnce(new Error("PT link error"));

    const result = await createNetworkUseCase(bridge, {
      vlans: [{ id: 10, name: "HR" }],
      hostsPerVlan: 1,
    });

    expect(result.data.operations[0].success).toBe(false);
    expect(result.data.operations.slice(1).every((op) => op.success)).toBe(true);
  });
});
