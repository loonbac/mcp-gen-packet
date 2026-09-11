// ── Primitive Tool: PT Bridge Connect ──
// Returns HTTP polling bootstrap script directly for user to paste in PTBuilder

import { z } from "zod";
import type { BridgeAdapter } from "../../bridge/adapter.js";
import type { ToolResult } from "../../types/protocol.js";
import { getBootstrapScript } from "../../core/utils/pt/bootstrap-script.js";

export const PtBridgeConnectSchema = z.object({
  // No required parameters - this tool returns the bootstrap script
});

export type PtBridgeConnectParams = z.infer<typeof PtBridgeConnectSchema>;

export const ptBridgeConnectTool = {
  name: "packet_tracer_bridge_connect",
  description:
    "Returns the HTTP polling bootstrap script to inject into PTBuilder. " +
    "The script polls GET /next every 500ms and executes commands via $se('runCode'). " +
    "Paste the returned script into PTBuilder's Script Editor and click Run to connect.",
  inputSchema: PtBridgeConnectSchema,

  execute: async (_bridge: BridgeAdapter, _params: unknown): Promise<ToolResult> => {
    PtBridgeConnectSchema.parse(_params);

    // Return the bootstrap script directly - user pastes it into PTBuilder
    return {
      mode: "script",
      data: {},
      code: getBootstrapScript(),
    };
  },
};
