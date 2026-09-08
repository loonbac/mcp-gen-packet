// ── Primitive Tool: Get Topology ──

import { z } from "zod";
import type { BridgeAdapter } from "../../bridge/adapter.js";
import type { ToolResult } from "../../types/protocol.js";

export const GetTopologySchema = z.object({
  maxDevices: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Optional cap on the number of devices scanned (default: all). " +
        "getTopology calls activityTreeToXml per device in-engine; with 100+ " +
        "devices this may exceed the 20s command timeout. Leave unset to scan all."
    ),
});

export type GetTopologyParams = z.infer<typeof GetTopologySchema>;

export const getTopologyTool = {
  name: "packet_tracer_get_topology",
  description:
    "Get network topology (devices and links). Links are extracted in-engine " +
    "per device via activityTreeToXml + regex, so payloads stay small.",
  inputSchema: GetTopologySchema,

  execute: async (bridge: BridgeAdapter, params: unknown): Promise<ToolResult> => {
    const parsed = GetTopologySchema.parse(params);
    const bridgeParams: Record<string, unknown> = {};
    if (parsed.maxDevices !== undefined) {
      bridgeParams.maxDevices = parsed.maxDevices;
    }
    return bridge.execute("get_topology", bridgeParams);
  },
};
