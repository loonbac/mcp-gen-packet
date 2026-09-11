import { describe, it, expect } from "vitest";
import { getBootstrapScript } from "../../../../src/core/utils/pt/bootstrap-script.js";

describe("getBootstrapScript", () => {
  it("generates default IIFE output with localhost:54321, 500ms interval, and $se('runCode')", () => {
    const script = getBootstrapScript();

    expect(script).toMatch(/^\(function\(\)\{.*\}\)\(\);$/);
    expect(script).toContain("http://localhost:54321/next");
    expect(script).toContain("$se('runCode',x.responseText);");
    expect(script).toContain("},500);})();");
    expect(script).toContain("var x=new XMLHttpRequest();");
    expect(script).toContain("w.__MCP_PTB_ERRORS=0;");
  });

  it("handles custom host and port parameters", () => {
    const script = getBootstrapScript({ host: "127.0.0.1", port: 59999 });

    expect(script).toContain("http://127.0.0.1:59999/next");
    expect(script).toContain("},500);})();");
  });

  it("handles custom intervalMs parameter", () => {
    const script = getBootstrapScript({ intervalMs: 250 });

    expect(script).toContain("http://localhost:54321/next");
    expect(script).toContain("},250);})();");
  });

  it("handles all custom parameters simultaneously", () => {
    const script = getBootstrapScript({ host: "10.0.0.5", port: 8080, intervalMs: 1000 });

    expect(script).toContain("http://10.0.0.5:8080/next");
    expect(script).toContain("},1000);})();");
  });

  it("falls back to default parameters when an empty options object is passed", () => {
    const script = getBootstrapScript({});

    expect(script).toContain("http://localhost:54321/next");
    expect(script).toContain("},500);})();");
  });

  it("embeds authoritative error loop retry and threshold mechanics", () => {
    const script = getBootstrapScript();

    // 1500ms request timeout
    expect(script).toContain("x.timeout=1500;");
    // HTTP 200 resets error counter and executes runCode if responseText exists
    expect(script).toContain("if(x.status===200){w.__MCP_PTB_ERRORS=0;if(x.responseText){$se('runCode',x.responseText);}return;}");
    // 6-error stop policy and timer clearInterval
    expect(script).toContain("w.__MCP_PTB_ERRORS=(w.__MCP_PTB_ERRORS||0)+1;if(w.__MCP_PTB_ERRORS>=6&&w.__MCP_PTB_TIMER){clearInterval(w.__MCP_PTB_TIMER);w.__MCP_PTB_TIMER=null;}");
    // Wire onerror and ontimeout
    expect(script).toContain("x.ontimeout=x.onerror;");
  });

  it("handles boundary port and various hostname formats correctly", () => {
    const script1 = getBootstrapScript({ host: "pt-host.internal", port: 80 });
    expect(script1).toContain("http://pt-host.internal:80/next");

    const script2 = getBootstrapScript({ host: "0.0.0.0", port: 65535, intervalMs: 50 });
    expect(script2).toContain("http://0.0.0.0:65535/next");
    expect(script2).toContain("},50);})();");
  });

  it("handles custom baseUrl parameter", () => {
    const script = getBootstrapScript({ baseUrl: "http://10.0.0.1:9999" });
    expect(script).toContain("http://10.0.0.1:9999/next");
    expect(script).toContain("},500);})();");
  });

  it("normalizes baseUrl by stripping trailing slashes", () => {
    const script = getBootstrapScript({ baseUrl: "http://10.0.0.1:9999///" });
    expect(script).toContain("http://10.0.0.1:9999/next");
  });

  it("combines baseUrl with custom intervalMs", () => {
    const script = getBootstrapScript({ baseUrl: "http://example.com:8080", intervalMs: 1200 });
    expect(script).toContain("http://example.com:8080/next");
    expect(script).toContain("},1200);})();");
  });
});
