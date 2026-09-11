// ── Composite Tool: Create Network ──

import { z } from "zod";
import type { BridgeAdapter } from "../../bridge/adapter.js";
import type { ToolResult } from "../../types/protocol.js";
import {
  createNetworkUseCase,
  type CreateNetworkData,
} from "../../core/use_cases/tools/create-network.js";

export const VlanSpecSchema = z.object({
  id: z.number().min(1).max(4094).describe("VLAN ID (1-4094)"),
  name: z.string().describe("VLAN name"),
});

export const CreateNetworkSchema = z.object({
  vlans: z.array(VlanSpecSchema).min(1).describe("Array of VLAN specifications"),
  hostsPerVlan: z.number().min(1).describe("Number of hosts per VLAN"),
});

export type CreateNetworkParams = z.infer<typeof CreateNetworkSchema>;

export const createNetworkTool = {
  name: "packet_tracer_create_network",
  description: "Create a multi-VLAN network with switches, routers, and hosts",
  inputSchema: CreateNetworkSchema,

  execute: async (bridge: BridgeAdapter, params: unknown): Promise<ToolResult<CreateNetworkData>> => {
    const parsed = CreateNetworkSchema.parse(params);
    return createNetworkUseCase(bridge, parsed);
  },
};
