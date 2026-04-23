// ── MCP Server Implementation ──

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createBridge } from "./bridge/index.js";
import { allTools, getTool } from "./tools/index.js";
import { deviceCatalog } from "./catalogs/devices.js";
import { moduleCatalog } from "./catalogs/modules.js";
import { linkTypeCatalog } from "./catalogs/links.js";
import { modelInterfaces } from "./catalogs/interfaces.js";
import type { BridgeAdapter } from "./bridge/adapter.js";
import type { Tool } from "./tools/index.js";

// Re-export ZodType for use in schema extraction
type ZodType = z.ZodType<unknown>;

/**
 * Extract the input schema from a tool as a ZodRawShape.
 * This converts the tool's Zod schema into the format expected by MCP SDK.
 */
function extractInputSchema(tool: Tool): z.ZodRawShape {
  const typedTool = tool as Tool & { inputSchema: z.ZodObject<z.ZodRawShape> };
  return typedTool.inputSchema.shape;
}

/**
 * Create and configure the MCP server with all tools and resources.
 */
export function createMcpServer(): McpServer {
  const bridge: BridgeAdapter = createBridge(54321);

  const server = new McpServer({
    name: "MCP-PTB",
    version: "0.1.0",
  });

  // ── Register Catalog Resources ──

  server.resource(
    "pt://catalog/devices",
    "Device catalog from PTBuilder",
    async () => {
      const devices = [...deviceCatalog.values()].map((entry) => ({
        model: entry.model,
        typeId: entry.typeId,
        category: entry.category,
      }));
      return {
        contents: [
          {
            uri: "pt://catalog/devices",
            mimeType: "application/json",
            text: JSON.stringify(devices, null, 2),
          },
        ],
      };
    },
  );

  server.resource(
    "pt://catalog/modules",
    "Module catalog from PTBuilder",
    async () => {
      const modules = [...moduleCatalog.values()].map((entry) => ({
        model: entry.model,
        typeId: entry.typeId,
      }));
      return {
        contents: [
          {
            uri: "pt://catalog/modules",
            mimeType: "application/json",
            text: JSON.stringify(modules, null, 2),
          },
        ],
      };
    },
  );

  server.resource(
    "pt://catalog/links",
    "Link types catalog from PTBuilder",
    async () => {
      const links = [...linkTypeCatalog.values()].map((entry) => ({
        name: entry.name,
        id: entry.id,
        aliases: entry.aliases,
      }));
      return {
        contents: [
          {
            uri: "pt://catalog/links",
            mimeType: "application/json",
            text: JSON.stringify(links, null, 2),
          },
        ],
      };
    },
  );

  server.resource(
    "pt://catalog/interfaces",
    "Interface map from PTBuilder",
    async () => {
      const interfaces: Record<string, string[]> = {};
      for (const [model, ifaces] of modelInterfaces.entries()) {
        interfaces[model] = ifaces;
      }
      return {
        contents: [
          {
            uri: "pt://catalog/interfaces",
            mimeType: "application/json",
            text: JSON.stringify(interfaces, null, 2),
          },
        ],
      };
    },
  );

  // ── Register Tools ──

  for (const tool of allTools) {
    const paramsSchema = extractInputSchema(tool);

    server.tool(
      tool.name,
      tool.description,
      paramsSchema,
      async (args: Record<string, unknown>) => {
        try {
          const result = await tool.execute(bridge, args);

          // Format result for MCP response
          if (result.mode === "script" && result.code) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    mode: result.mode,
                    script: result.code,
                  }),
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  mode: result.mode,
                  data: result.data,
                }),
              },
            ],
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ error: message }),
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

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