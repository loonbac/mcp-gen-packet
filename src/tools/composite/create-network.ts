// ── Composite Tool: Create Network ──

import { z } from "zod";
import type { BridgeAdapter } from "../../bridge/adapter.js";
import type { ToolResult } from "../../types/protocol.js";
import { autoLayout } from "../../layout/auto-layout.js";

export const VlanSpecSchema = z.object({
  id: z.number().min(1).max(4094).describe("VLAN ID (1-4094)"),
  name: z.string().describe("VLAN name"),
});

export const CreateNetworkSchema = z.object({
  vlans: z.array(VlanSpecSchema).min(1).describe("Array of VLAN specifications"),
  hostsPerVlan: z.number().min(1).describe("Number of hosts per VLAN"),
});

export type CreateNetworkParams = z.infer<typeof CreateNetworkSchema>;

// Subnet allocator: generates non-overlapping /24 subnets from 10.0.0.0/8
let subnetCounter = 1;
function nextSubnet(): string {
  const subnet = `10.0.${subnetCounter}.0`;
  subnetCounter++;
  return subnet;
}

function calcIp(baseIp: string, index: number): string {
  const parts = baseIp.split(".");
  const ip = [...parts];
  ip[3] = String(index);
  return ip.join(".");
}

export const createNetworkTool = {
  name: "packet_tracer_create_network",
  description: "Create a multi-VLAN network with switches, routers, and hosts",
  inputSchema: CreateNetworkSchema,

  execute: async (bridge: BridgeAdapter, params: unknown): Promise<ToolResult> => {
    const parsed = CreateNetworkSchema.parse(params);

    // Reset subnet counter for deterministic behavior
    subnetCounter = 1;

    const results: Array<{ method: string; params: Record<string, unknown> }> = [];
    const allDevices: Array<{ name: string; type: "switch" | "host" }> = [];

    for (const vlan of parsed.vlans) {
      const subnet = nextSubnet();
      const gatewayIp = calcIp(subnet, 1);

      // Build device names for this VLAN
      const switchName = `VLAN${vlan.id}-SW`;
      const hostNames = Array.from(
        { length: parsed.hostsPerVlan },
        (_, i) => `VLAN${vlan.id}-H${i + 1}`
      );

      // Get layout positions for this VLAN segment
      const segmentDevices = [switchName, ...hostNames];
      const positions = autoLayout(segmentDevices);

      // Add switch
      results.push({
        method: "add_device",
        params: {
          name: switchName,
          model: "Switch-PT",
          x: positions[0].x,
          y: positions[0].y,
        },
      });
      allDevices.push({ name: switchName, type: "switch" });

      // Add hosts
      for (let i = 0; i < hostNames.length; i++) {
        results.push({
          method: "add_device",
          params: {
            name: hostNames[i],
            model: "PC-PT",
            x: positions[i + 1].x,
            y: positions[i + 1].y,
          },
        });
        allDevices.push({ name: hostNames[i], type: "host" });
      }

      // Configure switch with VLANs
      const vlanCommands = [
        `vlan ${vlan.id}`,
        `name ${vlan.name}`,
        "exit",
      ];
      results.push({
        method: "configure_ios_device",
        params: {
          device: switchName,
          commands: vlanCommands.join("\n"),
        },
      });

      // Configure gateway on switch (use first interface as router interface)
      results.push({
        method: "configure_pc_ip",
        params: {
          device: switchName,
          ip: gatewayIp,
          subnetMask: "255.255.255.0",
        },
      });

      // Configure hosts with IPs in this subnet
      for (let i = 0; i < hostNames.length; i++) {
        const hostIp = calcIp(subnet, i + 2);
        results.push({
          method: "configure_pc_ip",
          params: {
            device: hostNames[i],
            ip: hostIp,
            subnetMask: "255.255.255.0",
            gateway: gatewayIp,
          },
        });
      }

      // Add links: switch to each host
      for (let i = 0; i < hostNames.length; i++) {
        results.push({
          method: "add_link",
          params: {
            device1: switchName,
            interface1: `FastEthernet0/${i + 1}`,
            device2: hostNames[i],
            interface2: "FastEthernet0",
            type: "ethernet-straight",
          },
        });
      }
    }

    // Execute all operations
    const executionResults: Array<{
      success: boolean;
      method: string;
      params: Record<string, unknown>;
    }> = [];
    for (const op of results) {
      try {
        await bridge.execute(op.method, op.params);
        executionResults.push({ success: true, method: op.method, params: op.params });
      } catch (error) {
        executionResults.push({ success: false, method: op.method, params: op.params });
      }
    }

    return {
      mode: bridge.getMode(),
      data: {
        vlans: parsed.vlans,
        hostsPerVlan: parsed.hostsPerVlan,
        allDevices,
        operations: executionResults,
      },
    };
  },
};