import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolResult } from "../../../types/protocol.js";

/**
 * Format a successful tool execution result into an MCP CallToolResult envelope.
 */
export function formatToolResult(result: ToolResult): CallToolResult {
  if (result.mode === "script" && result.code) {
    return {
      content: [
        {
          type: "text",
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
        type: "text",
        text: JSON.stringify({
          mode: result.mode,
          data: result.data,
        }),
      },
    ],
  };
}
