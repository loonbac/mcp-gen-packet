import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BridgeAdapter } from "../../../bridge/adapter.js";
import { allTools, type Tool } from "../../../tools/index.js";
import { extractInputSchema } from "./extract-input-schema.js";
import { createToolHandler } from "./create-tool-handler.js";

/**
 * Register tools on the McpServer instance.
 * Defaults to registering all tools (primitive + composite) if none provided.
 */
export function registerTools(
  server: McpServer,
  bridge: BridgeAdapter,
  tools: Tool[] = allTools,
): void {
  for (const tool of tools) {
    const paramsSchema = extractInputSchema(tool);
    server.tool(tool.name, tool.description, paramsSchema, createToolHandler(tool, bridge));
  }
}
