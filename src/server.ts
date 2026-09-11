// ── MCP Server Implementation ──

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createBridge } from "./bridge/index.js";
import type { BridgeAdapter } from "./bridge/adapter.js";
import { allTools } from "./tools/index.js";
import { registerCatalogResources } from "./server/handlers/resources/register-resources.js";
import { registerTools } from "./server/handlers/tools/register-tools.js";

/**
 * Create and configure the MCP server with all tools and resources.
 * Accepts an optional BridgeAdapter override for testing and dependency injection.
 */
export function createMcpServer(bridgeOverride?: BridgeAdapter): McpServer {
  const bridge = bridgeOverride ?? createBridge(54321);

  const server = new McpServer({
    name: "MCP-PTB",
    version: "0.1.0",
  });

  registerCatalogResources(server);
  registerTools(server, bridge, allTools);

  return server;
}

/**
 * Start the MCP server with stdio transport.
 */
export async function startServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();

  console.error("[server] Starting MCP-PTB server...");
  console.error("[server] HTTP bridge listening on localhost:54321");

  await server.connect(transport);
  console.error("[server] MCP-PTB server started");
}
