import { describe, it, expect, vi } from "vitest";
import { SubnetAllocator } from "../../../../src/core/utils/network/subnet-allocator.js";
import type { NetworkContext, VlanOperationPlan } from "../../../../src/core/pipelines/types.js";
import { AllocateVlanSubnetsStage } from "../../../../src/core/pipelines/stages/allocate-vlan-subnets-stage.js";
import { PlanVlanDevicesStage } from "../../../../src/core/pipelines/stages/plan-vlan-devices-stage.js";
import { LayoutVlanDevicesStage } from "../../../../src/core/pipelines/stages/layout-vlan-devices-stage.js";
import { ConfigureVlanDevicesStage } from "../../../../src/core/pipelines/stages/configure-vlan-devices-stage.js";
import { AssignVlanHostIpsStage } from "../../../../src/core/pipelines/stages/assign-vlan-host-ips-stage.js";
import { PlanVlanLinksStage } from "../../../../src/core/pipelines/stages/plan-vlan-links-stage.js";
import { collectVlanOperations } from "../../../../src/core/pipelines/stages/collect-vlan-operations.js";

function makeContext(overrides: Partial<NetworkContext> = {}): NetworkContext {
  return {
    bridge: { execute: vi.fn(), getMode: () => "mock" },
    operations: [],
    executionResults: [],
    input: {
      vlans: [
        { id: 10, name: "HR" },
        { id: 20, name: "Eng" },
      ],
      hostsPerVlan: 2,
    },
    allocator: new SubnetAllocator(),
    allocations: [],
    vlanPlans: [],
    allDevices: [],
    ...overrides,
  };
}

describe("Network Pipeline Stages", () => {
  it("AllocateVlanSubnetsStage: allocates sequential /24 subnets and gateway .1", () => {
    const stage = new AllocateVlanSubnetsStage();
    const ctx = stage.execute(makeContext());

    expect(ctx.allocations).toHaveLength(2);
    expect(ctx.allocations[0].subnet).toBe("10.0.1.0");
    expect(ctx.allocations[0].gatewayIp).toBe("10.0.1.1");
    expect(ctx.allocations[1].subnet).toBe("10.0.2.0");
    expect(ctx.allocations[1].gatewayIp).toBe("10.0.2.1");
    expect(ctx.allocator.nextIndex).toBe(3);
  });

  it("PlanVlanDevicesStage: plans switches and hosts, populates allDevices", () => {
    const allocCtx = new AllocateVlanSubnetsStage().execute(makeContext());
    const ctx = new PlanVlanDevicesStage().execute(allocCtx);

    expect(ctx.vlanPlans).toHaveLength(2);
    expect(ctx.vlanPlans[0].switchName).toBe("VLAN10-SW");
    expect(ctx.vlanPlans[0].hostNames).toEqual(["VLAN10-H1", "VLAN10-H2"]);
    expect(ctx.allDevices).toHaveLength(6);
    expect(ctx.allDevices.filter((d) => d.type === "switch")).toHaveLength(2);
    expect(ctx.allDevices.filter((d) => d.type === "host")).toHaveLength(4);
  });

  it("LayoutVlanDevicesStage: assigns autoLayout coordinates to switch and hosts", () => {
    const planned = new PlanVlanDevicesStage().execute(
      new AllocateVlanSubnetsStage().execute(makeContext()),
    );
    const ctx = new LayoutVlanDevicesStage().execute(planned);

    expect(ctx.vlanPlans[0].deviceOperations).toHaveLength(3);
    expect(ctx.vlanPlans[0].deviceOperations[0].method).toBe("add_device");
    expect(ctx.vlanPlans[0].deviceOperations[0].params.model).toBe("Switch-PT");
    expect(ctx.vlanPlans[0].deviceOperations[1].params.model).toBe("PC-PT");
  });

  it("ConfigureVlanDevicesStage: configures switch VLAN IOS and switch IP", () => {
    const planned = new PlanVlanDevicesStage().execute(
      new AllocateVlanSubnetsStage().execute(makeContext()),
    );
    const ctx = new ConfigureVlanDevicesStage().execute(planned);

    const ops = ctx.vlanPlans[0].switchOperations;
    expect(ops).toHaveLength(2);
    expect(ops[0].method).toBe("configure_ios_device");
    expect(ops[0].params.commands).toBe("vlan 10\nname HR\nexit");
    expect(ops[1].method).toBe("configure_pc_ip");
    expect(ops[1].params.ip).toBe("10.0.1.1");
  });

  it("AssignVlanHostIpsStage: configures host IPs starting at .2 with gateway .1", () => {
    const planned = new PlanVlanDevicesStage().execute(
      new AllocateVlanSubnetsStage().execute(makeContext()),
    );
    const ctx = new AssignVlanHostIpsStage().execute(planned);

    const ops = ctx.vlanPlans[0].hostIpOperations;
    expect(ops).toHaveLength(2);
    expect(ops[0].params.ip).toBe("10.0.1.2");
    expect(ops[0].params.gateway).toBe("10.0.1.1");
    expect(ops[1].params.ip).toBe("10.0.1.3");
  });

  it("PlanVlanLinksStage: connects switch FastEthernet0/x to host FastEthernet0 and populates operations", () => {
    const alloc = new AllocateVlanSubnetsStage().execute(makeContext());
    const planned = new PlanVlanDevicesStage().execute(alloc);
    const laidOut = new LayoutVlanDevicesStage().execute(planned);
    const configured = new ConfigureVlanDevicesStage().execute(laidOut);
    const assigned = new AssignVlanHostIpsStage().execute(configured);
    const ctx = new PlanVlanLinksStage().execute(assigned);

    const ops = ctx.vlanPlans[0].linkOperations;
    expect(ops).toHaveLength(2);
    expect(ops[0].params).toEqual({
      device1: "VLAN10-SW",
      interface1: "FastEthernet0/1",
      device2: "VLAN10-H1",
      interface2: "FastEthernet0",
      type: "ethernet-straight",
    });
    // 2 VLANs * (3 device ops + 2 switch ops + 2 host IP ops + 2 link ops) = 18 total operations
    expect(ctx.operations).toHaveLength(18);
  });

  it("collectVlanOperations: flattens buckets in legacy sequence per VLAN", () => {
    const plan: VlanOperationPlan = {
      allocation: { vlan: { id: 10, name: "HR" }, subnet: "10.0.1.0", gatewayIp: "10.0.1.1" },
      switchName: "VLAN10-SW",
      hostNames: ["VLAN10-H1"],
      deviceOperations: [{ method: "add_device", params: { name: "VLAN10-SW" } }],
      switchOperations: [{ method: "configure_ios_device", params: { device: "VLAN10-SW" } }],
      hostIpOperations: [{ method: "configure_pc_ip", params: { device: "VLAN10-H1" } }],
      linkOperations: [{ method: "add_link", params: { device1: "VLAN10-SW" } }],
    };

    const ops = collectVlanOperations([plan]);
    expect(ops.map((o) => o.method)).toEqual([
      "add_device",
      "configure_ios_device",
      "configure_pc_ip",
      "add_link",
    ]);
  });
});
