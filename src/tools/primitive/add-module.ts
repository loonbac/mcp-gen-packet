// ── Primitive Tool: Add Module ──

import { z } from "zod";
import type { BridgeAdapter } from "../../bridge/adapter.js";
import type { ToolResult } from "../../types/protocol.js";

export const AddModuleSchema = z.object({
  device: z.string().describe("Device name to add module to"),
  slot: z.number().describe("Slot number for the module"),
  model: z.string().describe("Module model (e.g., HWIC-1T, NM-1FE-TX)"),
});

export type AddModuleParams = z.infer<typeof AddModuleSchema>;

export const addModuleTool = {
  name: "packet_tracer_add_module",
  description: "Add a module card to a device in Packet Tracer",
  inputSchema: AddModuleSchema,

  execute: async (bridge: BridgeAdapter, params: unknown): Promise<ToolResult> => {
    const parsed = AddModuleSchema.parse(params);
    return bridge.execute("add_module", {
      device: parsed.device,
      slot: parsed.slot,
      model: parsed.model,
    });
  },
};