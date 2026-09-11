import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Format an error into an MCP CallToolResult envelope with isError: true.
 */
export function formatToolError(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ error: message }),
      },
    ],
    isError: true,
  };
}
