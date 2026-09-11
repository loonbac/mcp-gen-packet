// ── Composite Tool: Create LAN Segment ──

import { z } from "zod";
import type { BridgeAdapter } from "../../bridge/adapter.js";
import type { ToolResult } from "../../types/protocol.js";
import {
  createLanSegmentUseCase,
  type CreateLanSegmentData,
} from "../../core/use_cases/tools/create-lan-segment.js";

export const CreateLanSegmentSchema = z.object({
  name: z.string().describe("Segment name (used as device name prefix)"),
  subnet: z.string().describe("Subnet in CIDR or dotted notation (e.g., 192.168.1.0 or 192.168.1.0/24)"),
  hosts: z.number().min(1).describe("Number of host devices"),
  gateway: z.string().optional().describe("Gateway IP (defaults to .1 of subnet)"),
});

export type CreateLanSegmentParams = z.infer<typeof CreateLanSegmentSchema>;

export const createLanSegmentTool = {
  name: "packet_tracer_create_lan_segment",
  description: "Create a LAN segment with a gateway router and multiple hosts with auto-IP assignment",
  inputSchema: CreateLanSegmentSchema,

  execute: async (bridge: BridgeAdapter, params: unknown): Promise<ToolResult<CreateLanSegmentData>> => {
    const parsed = CreateLanSegmentSchema.parse(params);
    return createLanSegmentUseCase(bridge, parsed);
  },
};
