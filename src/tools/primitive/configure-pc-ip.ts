// ── Primitive Tool: Configure PC IP ──

import { z } from "zod";
import type { BridgeAdapter } from "../../bridge/adapter.js";
import type { ToolResult } from "../../types/protocol.js";

export const ConfigurePcIpSchema = z.object({
  device: z.string().describe("PC or server device name"),
  dhcp: z.boolean().optional().describe("Use DHCP to obtain IP address"),
  ip: z.string().optional().describe("Static IP address"),
  subnetMask: z.string().optional().describe("Subnet mask (e.g., 255.255.255.0)"),
  gateway: z.string().optional().describe("Default gateway"),
  dnsServer: z.string().optional().describe("DNS server IP address"),
});

export type ConfigurePcIpParams = z.infer<typeof ConfigurePcIpSchema>;

export const configurePcIpTool = {
  name: "packet_tracer_configure_pc_ip",
  description: "Configure IP settings on a PC or server device in Packet Tracer",
  inputSchema: ConfigurePcIpSchema,

  execute: async (bridge: BridgeAdapter, params: unknown): Promise<ToolResult> => {
    const parsed = ConfigurePcIpSchema.parse(params);
    return bridge.execute("configure_pc_ip", {
      device: parsed.device,
      dhcp: parsed.dhcp,
      ip: parsed.ip,
      subnetMask: parsed.subnetMask,
      gateway: parsed.gateway,
      dnsServer: parsed.dnsServer,
    });
  },
};