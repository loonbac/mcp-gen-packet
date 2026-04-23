// ── Primitive Tool: Get Devices ──

import { z } from "zod";
import type { BridgeAdapter } from "../../bridge/adapter.js";
import type { ToolResult } from "../../types/protocol.js";

export const GetDevicesSchema = z.object({
  filter: z.string().optional().describe("Filter devices by type (router, switch, pc, etc.)"),
  startsWith: z.string().optional().describe("Filter devices by name prefix"),
});

export type GetDevicesParams = z.infer<typeof GetDevicesSchema>;

export const getDevicesTool = {
  name: "packet_tracer_get_devices",
  description: "Get list of devices in the Packet Tracer topology",
  inputSchema: GetDevicesSchema,

  execute: async (bridge: BridgeAdapter, params: unknown): Promise<ToolResult> => {
    const parsed = GetDevicesSchema.parse(params);
    return bridge.execute("get_devices", {
      filter: parsed.filter,
      startsWith: parsed.startsWith,
    });
  },
};