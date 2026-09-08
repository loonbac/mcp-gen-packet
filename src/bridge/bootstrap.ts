// ── Bootstrap script builder (v3) — polling only ──
// Generates the ES5 IIFE that polls GET /next. Result POST is handled by the
// user's bridge.html pump (design D7); __mcpPost removed (design D13).

export function buildBootstrapScript(baseUrl: string): string {
  return (
    "(function(){var w=window;" +
    "if(w.__MCP_PTB_TIMER){clearInterval(w.__MCP_PTB_TIMER);}" +
    "w.__MCP_PTB_ERRORS=0;" +
    "w.__MCP_PTB_TIMER=setInterval(function(){" +
    "var x=new XMLHttpRequest();" +
    "x.open('GET','" + baseUrl + "/next',true);" +
    "x.timeout=1500;" +
    "x.onload=function(){if(x.status===200){w.__MCP_PTB_ERRORS=0;if(x.responseText){$se('runCode',x.responseText);}return;}" +
    "w.__MCP_PTB_ERRORS=(w.__MCP_PTB_ERRORS||0)+1;" +
    "if(w.__MCP_PTB_ERRORS>=6&&w.__MCP_PTB_TIMER){clearInterval(w.__MCP_PTB_TIMER);w.__MCP_PTB_TIMER=null;}};" +
    "x.onerror=function(){w.__MCP_PTB_ERRORS=(w.__MCP_PTB_ERRORS||0)+1;if(w.__MCP_PTB_ERRORS>=6&&w.__MCP_PTB_TIMER){clearInterval(w.__MCP_PTB_TIMER);w.__MCP_PTB_TIMER=null;}};" +
    "x.ontimeout=x.onerror;" +
    "x.send();" +
    "},500);" +
    "})();"
  );
}
