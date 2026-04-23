// ── Primitive Tool: Add Device ──

import { z } from "zod";
import type { BridgeAdapter } from "../../bridge/adapter.js";
import type { ToolResult } from "../../types/protocol.js";

export const AddDeviceSchema = z.object({
  name: z.string().describe("Device name (e.g., R1, S1, PC1)"),
  model: z.string().describe("Device model (e.g., 2911, 2960-24TT, PC-PT)"),
  x: z.number().optional().default(100).describe("X coordinate in pixels"),
  y: z.number().optional().default(100).describe("Y coordinate in pixels"),
});

export type AddDeviceParams = z.infer<typeof AddDeviceSchema>;

export const addDeviceTool = {
  name: "packet_tracer_add_device",
  description: "Add a network device to the Packet Tracer topology",
  inputSchema: AddDeviceSchema,

  execute: async (bridge: BridgeAdapter, params: unknown): Promise<ToolResult> => {
    const parsed = AddDeviceSchema.parse(params);
    return bridge.execute("add_device", {
      name: parsed.name,
      model: parsed.model,
      x: parsed.x,
      y: parsed.y,
    });
  },
};