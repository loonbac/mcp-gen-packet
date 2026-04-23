// ── Primitive Tool: Add Link ──

import { z } from "zod";
import type { BridgeAdapter } from "../../bridge/adapter.js";
import type { ToolResult } from "../../types/protocol.js";

export const AddLinkSchema = z.object({
  device1: z.string().describe("First device name"),
  interface1: z.string().describe("First device interface (e.g., GigabitEthernet0/0)"),
  device2: z.string().describe("Second device name"),
  interface2: z.string().describe("Second device interface"),
  type: z.string().optional().default("straight").describe("Link type (ethernet-straight, cross, fiber, etc.)"),
});

export type AddLinkParams = z.infer<typeof AddLinkSchema>;

export const addLinkTool = {
  name: "packet_tracer_add_link",
  description: "Add a link between two devices in the Packet Tracer topology",
  inputSchema: AddLinkSchema,

  execute: async (bridge: BridgeAdapter, params: unknown): Promise<ToolResult> => {
    const parsed = AddLinkSchema.parse(params);
    return bridge.execute("add_link", {
      device1: parsed.device1,
      interface1: parsed.interface1,
      device2: parsed.device2,
      interface2: parsed.interface2,
      type: parsed.type,
    });
  },
};