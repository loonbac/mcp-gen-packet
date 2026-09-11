// ── Primitive Tool: Get PC Config ──

import { z } from "zod";
import type { BridgeAdapter } from "../../bridge/adapter.js";
import type { ToolResult } from "../../types/protocol.js";

export const GetPcConfigSchema = z.object({
  device: z.string().describe("Name of the PC device to query"),
});

export type GetPcConfigParams = z.infer<typeof GetPcConfigSchema>;

export const getPcConfigTool = {
  name: "packet_tracer_get_pc_config",
  description:
    "Get PC configuration (IP, subnet mask, DHCP flag, MAC address). " +
    "Gateway and DNS are unavailable due to PT API limitations.",
  inputSchema: GetPcConfigSchema,

  execute: async (bridge: BridgeAdapter, params: unknown): Promise<ToolResult> => {
    const parsed = GetPcConfigSchema.parse(params);
    return bridge.execute("get_pc_config", {
      device: parsed.device,
    });
  },
};
