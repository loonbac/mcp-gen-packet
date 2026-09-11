import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CompositeBridge } from "../../../../src/core/pipelines/types.js";
import {
  createLanSegmentUseCase,
  type CreateLanSegmentData,
  type CreateLanSegmentParams,
} from "../../../../src/core/use_cases/tools/create-lan-segment.js";

describe("createLanSegmentUseCase", () => {
  let mockBridge: CompositeBridge;

  beforeEach(() => {
    mockBridge = {
      execute: vi.fn().mockResolvedValue({}),
      getMode: vi.fn().mockReturnValue("live"),
    };
  });

  it("executes end-to-end LAN pipeline and maps ToolResult<CreateLanSegmentData>", async () => {
    const params: CreateLanSegmentParams = {
      name: "Sales",
      subnet: "192.168.1.0/24",
      hosts: 3,
    };

    const result = await createLanSegmentUseCase(mockBridge, params);

    expect(result.mode).toBe("live");
    expect(result.data).toBeDefined();

    const data: CreateLanSegmentData = result.data;
    expect(data.segmentName).toBe("Sales");
    expect(data.gateway).toBe("Sales-GW");
    expect(data.gatewayIp).toBe("192.168.1.1");
    expect(data.hosts).toEqual(["Sales-H1", "Sales-H2", "Sales-H3"]);

    // Total operations: 4 devices (1 GW + 3 hosts) + 4 IPs (1 GW + 3 hosts) + 3 links = 11 operations
    expect(data.operations).toHaveLength(11);
    expect(mockBridge.execute).toHaveBeenCalledTimes(11);

    // Verify all operations succeeded
    expect(data.operations.every((op) => op.success)).toBe(true);

    // Verify operation method distribution
    const deviceOps = data.operations.filter((op) => op.method === "add_device");
    const ipOps = data.operations.filter((op) => op.method === "configure_pc_ip");
    const linkOps = data.operations.filter((op) => op.method === "add_link");

    expect(deviceOps).toHaveLength(4);
    expect(ipOps).toHaveLength(4);
    expect(linkOps).toHaveLength(3);
  });

  it("propagates custom gateway IP override", async () => {
    const params: CreateLanSegmentParams = {
      name: "Branch",
      subnet: "10.0.0.0",
      hosts: 2,
      gateway: "10.0.0.254",
    };

    const result = await createLanSegmentUseCase(mockBridge, params);

    expect(result.data.gatewayIp).toBe("10.0.0.254");
    expect(mockBridge.execute).toHaveBeenCalledWith("configure_pc_ip", {
      device: "Branch-GW",
      ip: "10.0.0.254",
      subnetMask: "255.255.255.0",
    });
  });

  it("propagates bridge mode correctly", async () => {
    (mockBridge.getMode as ReturnType<typeof vi.fn>).mockReturnValue("dry-run");

    const result = await createLanSegmentUseCase(mockBridge, {
      name: "Test",
      subnet: "192.168.0.0",
      hosts: 1,
    });

    expect(result.mode).toBe("dry-run");
  });

  it("captures resilient operation failure without aborting execution", async () => {
    let callCount = 0;
    (mockBridge.execute as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      callCount++;
      if (callCount === 2) {
        throw new Error("Bridge connection timeout");
      }
      return {};
    });

    const result = await createLanSegmentUseCase(mockBridge, {
      name: "Fragile",
      subnet: "192.168.1.0",
      hosts: 1,
    });

    // 2 devices + 2 IPs + 1 link = 5 operations
    expect(result.data.operations).toHaveLength(5);
    expect(result.data.operations[0].success).toBe(true);
    expect(result.data.operations[1].success).toBe(false);
    expect(result.data.operations[2].success).toBe(true);
  });
});
