// ── Primitive Tool: PT Bridge Connect ──
// Returns HTTP polling bootstrap script directly for user to paste in PTBuilder

import { z } from "zod";
import type { BridgeAdapter } from "../../bridge/adapter.js";
import type { ToolResult } from "../../types/protocol.js";

export const PtBridgeConnectSchema = z.object({
  // No required parameters - this tool returns the bootstrap script
});

export type PtBridgeConnectParams = z.infer<typeof PtBridgeConnectSchema>;

// Bootstrap script that polls HTTP /next and executes via $se('runCode')
// This is the working pattern from mcp-gen-packet fork
const BOOTSTRAP_SCRIPT = `(function(){var w=window;if(w.__MCP_PTB_TIMER){clearInterval(w.__MCP_PTB_TIMER);}w.__MCP_PTB_ERRORS=0;w.__MCP_PTB_TIMER=setInterval(function(){var x=new XMLHttpRequest();x.open('GET','http://localhost:54321/next',true);x.timeout=1500;x.onload=function(){if(x.status===200){w.__MCP_PTB_ERRORS=0;if(x.responseText){$se('runCode',x.responseText);}return;}w.__MCP_PTB_ERRORS=(w.__MCP_PTB_ERRORS||0)+1;if(w.__MCP_PTB_ERRORS>=6&&w.__MCP_PTB_TIMER){clearInterval(w.__MCP_PTB_TIMER);w.__MCP_PTB_TIMER=null;}};x.onerror=function(){w.__MCP_PTB_ERRORS=(w.__MCP_PTB_ERRORS||0)+1;if(w.__MCP_PTB_ERRORS>=6&&w.__MCP_PTB_TIMER){clearInterval(w.__MCP_PTB_TIMER);w.__MCP_PTB_TIMER=null;}};x.ontimeout=x.onerror;x.send()},500);})();`;

export const ptBridgeConnectTool = {
  name: "packet_tracer_bridge_connect",
  description:
    "Returns the HTTP polling bootstrap script to inject into PTBuilder. " +
    "The script polls http://localhost:54321/next every 500ms and executes commands via $se('runCode'). " +
    "Paste the returned script into PTBuilder's Script Editor and click Run to connect.",
  inputSchema: PtBridgeConnectSchema,

  execute: async (_bridge: BridgeAdapter, _params: unknown): Promise<ToolResult> => {
    PtBridgeConnectSchema.parse(_params);

    // Return the bootstrap script directly - user pastes it into PTBuilder
    return {
      mode: "script",
      data: {},
      code: BOOTSTRAP_SCRIPT,
    };
  },
};