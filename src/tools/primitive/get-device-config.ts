// ── Primitive Tool: Get Device Config ──
// Fetches the device activityTree XML in chunks (design D9) and never transports
// the full ~164KB on the wire. The engine caches the XML in __mcpXmlCache and
// slices per [start,end); the server reassembles.

import { z } from "zod";
import type { BridgeAdapter } from "../../bridge/adapter.js";
import type { ToolResult } from "../../types/protocol.js";
import { parse, filterSecrets, formatIos } from "../read/ptree.js";

export const GetDeviceConfigSchema = z.object({
  device: z.string().describe("Name of the device whose configuration to fetch"),
  include_secrets: z
    .boolean()
    .default(false)
    .describe(
      "Include secret nodes (passwords, keys, banners). Default false — " +
        "matching nodes are filtered out unless explicitly requested."
    ),
  format: z
    .enum(["structured", "ios"])
    .default("structured")
    .describe(
      "Output format: 'structured' returns the parsed ConfigTree; " +
        "'ios' returns an IOS-like text view."
    ),
});

export type GetDeviceConfigParams = z.infer<typeof GetDeviceConfigSchema>;

const DEFAULT_CHUNK = 4096;
const SHRUNK_CHUNK = 2048;
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 5000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The bridge returns the correlated BridgeResult nested under data.result.
// A timeout yields no chunk (status "queued_no_confirmation") → extractChunk undefined.
function extractChunk(result: ToolResult): string | undefined {
  const data = result?.data as { result?: { data?: { chunk?: string } } } | undefined;
  const chunk = data?.result?.data?.chunk;
  return typeof chunk === "string" ? chunk : undefined;
}

/**
 * Reassemble the full activityTree XML by issuing chunked get_device_config calls.
 * Exported for WU4 tests. Adaptive: shrinks the window to 2KB after 2 consecutive
 * timeouts; aborts a chunk after MAX_RETRIES retries with backoff between attempts.
 */
export async function reassembleChunks(
  bridge: BridgeAdapter,
  device: string,
  chunkSize: number = DEFAULT_CHUNK
): Promise<string> {
  let start = 0;
  let size = chunkSize;
  let consecutiveTimeouts = 0;
  const chunks: string[] = [];

  while (true) {
    let chunk: string | undefined = undefined;
    let attempt = 0;

    while (chunk === undefined) {
      const result = await bridge.execute("get_device_config", {
        device,
        start,
        end: start + size,
      });
      chunk = extractChunk(result);

      if (chunk !== undefined) break;

      if (attempt >= MAX_RETRIES) {
        throw new Error(
          `get_device_config: chunk at offset ${start} failed after ${MAX_RETRIES} retries`
        );
      }
      attempt++;
      consecutiveTimeouts++;
      if (consecutiveTimeouts >= 2 && size > SHRUNK_CHUNK) {
        size = SHRUNK_CHUNK;
      }
      await sleep(RETRY_BACKOFF_MS);
    }

    consecutiveTimeouts = 0;
    chunks.push(chunk);

    // Completion: a chunk shorter than the requested window means end-of-data.
    // An empty terminal chunk (exact multiple of size) has length 0 < size.
    if (chunk.length < size) break;
    start += size;
  }

  return chunks.join("");
}

export const getDeviceConfigTool = {
  name: "packet_tracer_get_device_config",
  description:
    "Get device configuration derived from the activityTree XML. Fetched in " +
    "chunks (never the full XML on the wire), reassembled server-side, with " +
    "secrets filtered by default. Use format='ios' for an IOS-like text view.",
  inputSchema: GetDeviceConfigSchema,

  execute: async (bridge: BridgeAdapter, params: unknown): Promise<ToolResult> => {
    const parsed = GetDeviceConfigSchema.parse(params);
    const xml = await reassembleChunks(bridge, parsed.device);
    const tree = parse(xml);
    const filtered = filterSecrets(tree, parsed.include_secrets);

    if (parsed.format === "ios") {
      return { mode: "live", data: { config: formatIos(filtered) } };
    }
    return { mode: "live", data: { config: filtered } };
  },
};
