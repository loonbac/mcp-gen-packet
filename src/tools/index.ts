// ── Tools Index ──

export * from "./primitive/index.js";
export * from "./composite/index.js";

import { primitiveTools, getToolByName } from "./primitive/index.js";
import { compositeTools, getCompositeToolByName } from "./composite/index.js";

import type { BridgeAdapter } from "../bridge/adapter.js";
import type { ToolResult } from "../types/protocol.js";

// Unified Tool interface
export interface Tool {
  name: string;
  description: string;
  inputSchema: unknown;
  execute(bridge: BridgeAdapter, params: unknown): Promise<ToolResult>;
}

// All tools combined
export const allTools: Tool[] = [...primitiveTools, ...compositeTools];

// Lookup function for any tool by name
export function getTool(name: string): Tool | undefined {
  return getToolByName(name) ?? getCompositeToolByName(name);
}