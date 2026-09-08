import { describe, it, expect } from "vitest";
import { buildBootstrapScript } from "../../src/bridge/bootstrap";

describe("buildBootstrapScript (v3 — polling only, no __mcpPost)", () => {
  it("returns a non-empty string", () => {
    const script = buildBootstrapScript("http://localhost:54321");
    expect(typeof script).toBe("string");
    expect(script.length).toBeGreaterThan(0);
  });

  it("does NOT contain __mcpPost (design D13: removed)", () => {
    const script = buildBootstrapScript("http://localhost:54321");
    expect(script).not.toContain("__mcpPost");
    expect(script).not.toContain("window.__mcpPost");
  });

  it("keeps existing /next polling behavior", () => {
    const script = buildBootstrapScript("http://localhost:54321");
    expect(script).toContain("/next");
    expect(script).toContain("$se('runCode'");
    expect(script).toContain("setInterval");
  });

  it("uses the provided base URL for /next polling", () => {
    const script = buildBootstrapScript("http://10.0.0.1:9999");
    expect(script).toContain("http://10.0.0.1:9999/next");
  });

  it("is pure ES5 — no arrow functions, no fetch, no async", () => {
    const script = buildBootstrapScript("http://localhost:54321");
    expect(script).not.toContain("=>");
    expect(script).not.toContain("fetch(");
    expect(script).not.toContain("async ");
    expect(script).not.toContain("await ");
  });

  it("still uses XMLHttpRequest for /next polling (engine constraint)", () => {
    const script = buildBootstrapScript("http://localhost:54321");
    expect(script).toContain("XMLHttpRequest");
  });
});
