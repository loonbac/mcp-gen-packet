import { describe, it, expect, vi } from "vitest";
import type { LanSegmentContext } from "../../../../src/core/pipelines/types.js";
import { PlanLanDevicesStage } from "../../../../src/core/pipelines/stages/plan-lan-devices-stage.js";
import { LayoutLanDevicesStage } from "../../../../src/core/pipelines/stages/layout-lan-devices-stage.js";
import { AssignLanIpsStage } from "../../../../src/core/pipelines/stages/assign-lan-ips-stage.js";
import { PlanLanLinksStage } from "../../../../src/core/pipelines/stages/plan-lan-links-stage.js";

function createContext(overrides?: Partial<LanSegmentContext>): LanSegmentContext {
  return {
    bridge: { execute: vi.fn() },
    operations: [],
    executionResults: [],
    input: {
      name: "Office",
      subnet: "192.168.1.0/24",
      hosts: 3,
    },
    devices: [],
    hostNames: [],
    ...overrides,
  };
}

describe("LAN Pipeline Stages", () => {
  describe("PlanLanDevicesStage", () => {
    it("plans gateway router and host PCs with correct naming and models", () => {
      const stage = new PlanLanDevicesStage();
      const initial = createContext({
        input: { name: "Branch", subnet: "10.0.0.0/24", hosts: 3 },
      });

      const next = stage.execute(initial);

      expect(next.gatewayName).toBe("Branch-GW");
      expect(next.hostNames).toEqual(["Branch-H1", "Branch-H2", "Branch-H3"]);
      expect(next.devices).toEqual([
        { name: "Branch-GW", model: "Router-PT" },
        { name: "Branch-H1", model: "PC-PT" },
        { name: "Branch-H2", model: "PC-PT" },
        { name: "Branch-H3", model: "PC-PT" },
      ]);
      expect(next.operations).toHaveLength(0);
      expect(initial.devices).toHaveLength(0);
    });

    it("handles single-host LAN segment", () => {
      const stage = new PlanLanDevicesStage();
      const initial = createContext({
        input: { name: "Solo", subnet: "192.168.5.0", hosts: 1 },
      });

      const next = stage.execute(initial);

      expect(next.gatewayName).toBe("Solo-GW");
      expect(next.hostNames).toEqual(["Solo-H1"]);
      expect(next.devices).toHaveLength(2);
    });
  });

  describe("LayoutLanDevicesStage", () => {
    it("computes auto-layout coordinates and appends add_device operations", () => {
      const stage = new LayoutLanDevicesStage();
      const initial = createContext({
        gatewayName: "Office-GW",
        hostNames: ["Office-H1", "Office-H2"],
        devices: [
          { name: "Office-GW", model: "Router-PT" },
          { name: "Office-H1", model: "PC-PT" },
          { name: "Office-H2", model: "PC-PT" },
        ],
      });

      const next = stage.execute(initial);

      expect(next.operations).toHaveLength(3);
      expect(next.operations[0]).toMatchObject({
        method: "add_device",
        params: {
          name: "Office-GW",
          model: "Router-PT",
          x: expect.any(Number),
          y: expect.any(Number),
        },
      });
      expect(next.operations[1]).toMatchObject({
        method: "add_device",
        params: {
          name: "Office-H1",
          model: "PC-PT",
          x: expect.any(Number),
          y: expect.any(Number),
        },
      });
      expect(next.operations[2]).toMatchObject({
        method: "add_device",
        params: {
          name: "Office-H2",
          model: "PC-PT",
          x: expect.any(Number),
          y: expect.any(Number),
        },
      });

      // Assert spacing >= 150px between devices
      const coords = next.operations.map((op) => op.params as { x: number; y: number });
      for (let i = 0; i < coords.length; i++) {
        for (let j = i + 1; j < coords.length; j++) {
          const dx = coords[j].x - coords[i].x;
          const dy = coords[j].y - coords[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          expect(dist).toBeGreaterThanOrEqual(150);
        }
      }
    });

    it("preserves pre-existing operations when appending add_device", () => {
      const stage = new LayoutLanDevicesStage();
      const existingOp = { method: "custom_op", params: { foo: "bar" } };
      const initial = createContext({
        operations: [existingOp],
        gatewayName: "Office-GW",
        hostNames: ["Office-H1"],
      });

      const next = stage.execute(initial);

      expect(next.operations).toHaveLength(3);
      expect(next.operations[0]).toEqual(existingOp);
      expect(initial.operations).toHaveLength(1);
    });
  });

  describe("AssignLanIpsStage", () => {
    it("calculates default .1 gateway IP and sequential .2+ host IPs", () => {
      const stage = new AssignLanIpsStage();
      const initial = createContext({
        input: { name: "Lab", subnet: "192.168.10.0/24", hosts: 2 },
        gatewayName: "Lab-GW",
        hostNames: ["Lab-H1", "Lab-H2"],
      });

      const next = stage.execute(initial);

      expect(next.baseIp).toBe("192.168.10.0");
      expect(next.gatewayIp).toBe("192.168.10.1");
      expect(next.operations).toEqual([
        {
          method: "configure_pc_ip",
          params: {
            device: "Lab-GW",
            ip: "192.168.10.1",
            subnetMask: "255.255.255.0",
          },
        },
        {
          method: "configure_pc_ip",
          params: {
            device: "Lab-H1",
            ip: "192.168.10.2",
            subnetMask: "255.255.255.0",
            gateway: "192.168.10.1",
          },
        },
        {
          method: "configure_pc_ip",
          params: {
            device: "Lab-H2",
            ip: "192.168.10.3",
            subnetMask: "255.255.255.0",
            gateway: "192.168.10.1",
          },
        },
      ]);
    });

    it("respects custom gateway IP override", () => {
      const stage = new AssignLanIpsStage();
      const initial = createContext({
        input: {
          name: "DMZ",
          subnet: "172.16.0.0",
          hosts: 1,
          gateway: "172.16.0.254",
        },
        gatewayName: "DMZ-GW",
        hostNames: ["DMZ-H1"],
      });

      const next = stage.execute(initial);

      expect(next.gatewayIp).toBe("172.16.0.254");
      expect(next.operations[0].params.ip).toBe("172.16.0.254");
      expect(next.operations[1].params.gateway).toBe("172.16.0.254");
    });
  });

  describe("PlanLanLinksStage", () => {
    it("plans star topology links from gateway GigabitEthernet0/0 to host FastEthernet ports", () => {
      const stage = new PlanLanLinksStage();
      const initial = createContext({
        gatewayName: "Office-GW",
        hostNames: ["Office-H1", "Office-H2", "Office-H3"],
      });

      const next = stage.execute(initial);

      expect(next.operations).toEqual([
        {
          method: "add_link",
          params: {
            device1: "Office-GW",
            interface1: "GigabitEthernet0/0",
            device2: "Office-H1",
            interface2: "FastEthernet0/1",
            type: "ethernet-straight",
          },
        },
        {
          method: "add_link",
          params: {
            device1: "Office-GW",
            interface1: "GigabitEthernet0/0",
            device2: "Office-H2",
            interface2: "FastEthernet0/2",
            type: "ethernet-straight",
          },
        },
        {
          method: "add_link",
          params: {
            device1: "Office-GW",
            interface1: "GigabitEthernet0/0",
            device2: "Office-H3",
            interface2: "FastEthernet0/3",
            type: "ethernet-straight",
          },
        },
      ]);
    });
  });
});
