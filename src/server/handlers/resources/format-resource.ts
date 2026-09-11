import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Pure helper to serialize catalog snapshot data into an SDK ReadResourceResult envelope.
 */
export function formatJsonResource(
  uri: string,
  data: unknown,
): ReadResourceResult {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}
