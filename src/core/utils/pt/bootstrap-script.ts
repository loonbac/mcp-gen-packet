export interface BootstrapScriptOptions {
  readonly host?: string;
  readonly port?: number;
  readonly intervalMs?: number;
  readonly baseUrl?: string;
}

/**
 * Generates the canonical JavaScript IIFE polling script for Packet Tracer.
 * Polls http://${host}:${port}/next (or options.baseUrl/next) and executes commands via $se('runCode').
 */
export function getBootstrapScript(options?: BootstrapScriptOptions): string {
  const intervalMs = options?.intervalMs ?? 500;
  const url = options?.baseUrl
    ? `${options.baseUrl.replace(/\/+$/, "")}/next`
    : `http://${options?.host ?? "localhost"}:${options?.port ?? 54321}/next`;

  return `(function(){var w=window;if(w.__MCP_PTB_TIMER){clearInterval(w.__MCP_PTB_TIMER);}w.__MCP_PTB_ERRORS=0;w.__MCP_PTB_TIMER=setInterval(function(){var x=new XMLHttpRequest();x.open('GET','${url}',true);x.timeout=1500;x.onload=function(){if(x.status===200){w.__MCP_PTB_ERRORS=0;if(x.responseText){$se('runCode',x.responseText);}return;}w.__MCP_PTB_ERRORS=(w.__MCP_PTB_ERRORS||0)+1;if(w.__MCP_PTB_ERRORS>=6&&w.__MCP_PTB_TIMER){clearInterval(w.__MCP_PTB_TIMER);w.__MCP_PTB_TIMER=null;}};x.onerror=function(){w.__MCP_PTB_ERRORS=(w.__MCP_PTB_ERRORS||0)+1;if(w.__MCP_PTB_ERRORS>=6&&w.__MCP_PTB_TIMER){clearInterval(w.__MCP_PTB_TIMER);w.__MCP_PTB_TIMER=null;}};x.ontimeout=x.onerror;x.send();},${intervalMs});})();`;
}
