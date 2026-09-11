import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { BridgeAdapter } from "../../../bridge/adapter.js";
import type { Tool } from "../../../tools/index.js";
import { formatToolResult } from "./format-tool-result.js";
import { formatToolError } from "./format-tool-error.js";

export type McpToolHandler = (args: Record<string, unknown>) => Promise<CallToolResult>;

/**
 * Create an MCP tool execution handler that calls tool.execute(bridge, args),
 * formats successful results, and catches errors returning isError: true.
 */
export function createToolHandler(tool: Tool, bridge: BridgeAdapter): McpToolHandler {
  return async (args: Record<string, unknown>): Promise<CallToolResult> => {
    try {
      const result = await tool.execute(bridge, args);
      return formatToolResult(result);
    } catch (error) {
      return formatToolError(error);
    }
  };
}
