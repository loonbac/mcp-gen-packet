// ── Composite Tools Index ──

export { createLanSegmentTool, CreateLanSegmentSchema } from "./create-lan-segment.js";
export { createNetworkTool, CreateNetworkSchema, VlanSpecSchema } from "./create-network.js";

import { createLanSegmentTool } from "./create-lan-segment.js";
import { createNetworkTool } from "./create-network.js";

import type { BridgeAdapter } from "../../bridge/adapter.js";
import type { ToolResult } from "../../types/protocol.js";

// Tool definition
export interface CompositeTool {
  name: string;
  description: string;
  inputSchema: unknown;
  execute(bridge: BridgeAdapter, params: unknown): Promise<ToolResult>;
}

// All composite tools
export const compositeTools: CompositeTool[] = [
  createLanSegmentTool,
  createNetworkTool,
];

// Lookup function
export function getCompositeToolByName(name: string): CompositeTool | undefined {
  return compositeTools.find((t) => t.name === name);
}