// ── Composite Tool: Create LAN Segment ──

import { z } from "zod";
import type { BridgeAdapter } from "../../bridge/adapter.js";
import type { ToolResult } from "../../types/protocol.js";
import { autoLayout } from "../../layout/auto-layout.js";

export const CreateLanSegmentSchema = z.object({
  name: z.string().describe("Segment name (used as device name prefix)"),
  subnet: z.string().describe("Subnet in CIDR or dotted notation (e.g., 192.168.1.0 or 192.168.1.0/24)"),
  hosts: z.number().min(1).describe("Number of host devices"),
  gateway: z.string().optional().describe("Gateway IP (defaults to .1 of subnet)"),
});

export type CreateLanSegmentParams = z.infer<typeof CreateLanSegmentSchema>;

// Helper: parse subnet and extract base IP
function parseSubnet(subnet: string): { baseIp: string; hostIndexBase: number } {
  // Handle both "192.168.1.0" and "192.168.1.0/24" formats
  const base = subnet.split("/")[0];
  const parts = base.split(".");
  parts[3] = "0"; // Force to network address
  return {
    baseIp: parts.join("."),
    hostIndexBase: 0,
  };
}

// Helper: calculate IP from base + index
function calcIp(baseIp: string, index: number): string {
  const parts = baseIp.split(".");
  const ip = [...parts];
  ip[3] = String(index);
  return ip.join(".");
}

// Helper: determine the interface for a host connecting to the gateway
function getHostInterface(index: number): string {
  // Use FastEthernet0/1, 0/2, etc. for hosts
  return `FastEthernet0/${index + 1}`;
}

// Helper: determine the gateway interface
function getGatewayInterface(): string {
  return "GigabitEthernet0/0";
}

export const createLanSegmentTool = {
  name: "packet_tracer_create_lan_segment",
  description: "Create a LAN segment with a gateway router and multiple hosts with auto-IP assignment",
  inputSchema: CreateLanSegmentSchema,

  execute: async (bridge: BridgeAdapter, params: unknown): Promise<ToolResult> => {
    const parsed = CreateLanSegmentSchema.parse(params);
    const { baseIp } = parseSubnet(parsed.subnet);
    const gatewayIp = parsed.gateway ?? calcIp(baseIp, 1);

    // Build device list: gateway + hosts
    const deviceNames: string[] = [
      `${parsed.name}-GW`,
      ...Array.from({ length: parsed.hosts }, (_, i) => `${parsed.name}-H${i + 1}`),
    ];

    // Get layout positions
    const positions = autoLayout(deviceNames);

    const results: Array<{ method: string; params: Record<string, unknown> }> = [];

    // Add gateway device
    results.push({
      method: "add_device",
      params: {
        name: deviceNames[0],
        model: "Router-PT",
        x: positions[0].x,
        y: positions[0].y,
      },
    });

    // Add host devices
    for (let i = 1; i < deviceNames.length; i++) {
      results.push({
        method: "add_device",
        params: {
          name: deviceNames[i],
          model: "PC-PT",
          x: positions[i].x,
          y: positions[i].y,
        },
      });
    }

    // Configure gateway with IP
    results.push({
      method: "configure_pc_ip",
      params: {
        device: deviceNames[0],
        ip: gatewayIp,
        subnetMask: "255.255.255.0",
      },
    });

    // Configure host IPs
    for (let i = 1; i < deviceNames.length; i++) {
      const hostIp = calcIp(baseIp, i + 1);
      results.push({
        method: "configure_pc_ip",
        params: {
          device: deviceNames[i],
          ip: hostIp,
          subnetMask: "255.255.255.0",
          gateway: gatewayIp,
        },
      });
    }

    // Add links: each host to gateway
    for (let i = 1; i < deviceNames.length; i++) {
      results.push({
        method: "add_link",
        params: {
          device1: deviceNames[0],
          interface1: getGatewayInterface(),
          device2: deviceNames[i],
          interface2: getHostInterface(i - 1),
          type: "ethernet-straight",
        },
      });
    }

    // Execute all operations
    const executionResults: Array<{ success: boolean; method: string; params: Record<string, unknown> }> = [];
    for (const op of results) {
      try {
        const result = await bridge.execute(op.method, op.params);
        executionResults.push({ success: true, method: op.method, params: op.params });
      } catch (error) {
        executionResults.push({
          success: false,
          method: op.method,
          params: op.params,
        });
      }
    }

    return {
      mode: bridge.getMode(),
      data: {
        segmentName: parsed.name,
        gateway: deviceNames[0],
        gatewayIp,
        hosts: deviceNames.slice(1),
        operations: executionResults,
      },
    };
  },
};