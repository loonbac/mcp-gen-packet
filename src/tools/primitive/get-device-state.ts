// ── Primitive Tool: Get Device State ──

import { z } from "zod";
import type { BridgeAdapter } from "../../bridge/adapter.js";
import type { ToolResult } from "../../types/protocol.js";

export const GetDeviceStateSchema = z.object({
  device: z.string().describe("Name of the device to query"),
});

export type GetDeviceStateParams = z.infer<typeof GetDeviceStateSchema>;

export const getDeviceStateTool = {
  name: "packet_tracer_get_device_state",
  description:
    "Get device state (power, uptime, and per-port status including IP, mask, " +
    "protocol state, description, and remote port) via confirmed PT getters.",
  inputSchema: GetDeviceStateSchema,

  execute: async (bridge: BridgeAdapter, params: unknown): Promise<ToolResult> => {
    const parsed = GetDeviceStateSchema.parse(params);
    return bridge.execute("get_device_state", {
      device: parsed.device,
    });
  },
};
