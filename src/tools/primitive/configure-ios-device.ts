// ── Primitive Tool: Configure IOS Device ──

import { z } from "zod";
import type { BridgeAdapter } from "../../bridge/adapter.js";
import type { ToolResult } from "../../types/protocol.js";

export const ConfigureIosDeviceSchema = z.object({
  device: z.string().describe("Router or switch device name"),
  commands: z.string().describe("IOS commands separated by newlines"),
});

export type ConfigureIosDeviceParams = z.infer<typeof ConfigureIosDeviceSchema>;

export const configureIosDeviceTool = {
  name: "packet_tracer_configure_ios_device",
  description: "Execute IOS configuration commands on a router or switch in Packet Tracer",
  inputSchema: ConfigureIosDeviceSchema,

  execute: async (bridge: BridgeAdapter, params: unknown): Promise<ToolResult> => {
    const parsed = ConfigureIosDeviceSchema.parse(params);
    return bridge.execute("configure_ios_device", {
      device: parsed.device,
      commands: parsed.commands,
    });
  },
};