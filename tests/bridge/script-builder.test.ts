import { describe, it, expect } from "vitest";
import { buildScript } from "../../src/bridge/script-builder";

describe("buildScript single-line __mcpLastResult= (WU3a)", () => {
  it("returns bare command when no options provided (script mode)", () => {
    const code = buildScript("add_device", { name: "R1", model: "2911", x: 100, y: 200 });
    expect(code).toBe(`addDevice("R1", "2911", 100, 200);`);
  });

  it("write method produces single-line try/catch __mcpLastResult= assignment", () => {
    const code = buildScript(
      "add_device",
      { name: "R1", model: "2911", x: 100, y: 200 },
      { requestId: "req-1", ts: 1700000000000 }
    );
    expect(code.startsWith("__mcpLastResult=")).toBe(true);
    expect(code).toContain("var __r=addDevice");
    expect(code).toContain("if(__r===false){throw 0;}");
    expect(code).toContain('requestId:"req-1"');
    expect(code).toContain('method:"add_device"');
    expect(code).toContain("ok:true");
    expect(code).toContain("data:{}");
    expect(code).toContain("ts:1700000000000");
    expect(code).toContain("catch(__e)");
    expect(code).toContain('error:"PT command failed"');
  });

  it("write catch block returns ok=false with fixed error string", () => {
    const code = buildScript(
      "add_device",
      { name: "R1", model: "2911" },
      { requestId: "req-2", ts: 5 }
    );
    expect(code).toContain("ok:false");
    expect(code).toContain('error:"PT command failed"');
    expect(code).not.toContain("String(__e)");
  });

  it("read method get_devices produces __mcpLastResult=getDevices(...) dispatch", () => {
    const code = buildScript(
      "get_devices",
      {},
      { requestId: "req-d", ts: 1700000000000 }
    );
    expect(code.startsWith("__mcpLastResult=")).toBe(true);
    expect(code).toContain("getDevices(");
    expect(code).toContain('"req-d"');
    expect(code).toContain('"get_devices"');
    expect(code).toContain("1700000000000");
  });

  it("read dispatch appends envelope args after user args", () => {
    const code = buildScript(
      "get_device_config",
      { device: "R1", start: 0, end: 4096 },
      { requestId: "req-c", ts: 99 }
    );
    expect(code.startsWith("__mcpLastResult=")).toBe(true);
    expect(code).toContain('getDeviceConfig("R1", 0, 4096,"req-c","get_device_config",99)');
  });

  it("read dispatch with no user args (getTopology) inserts envelope directly", () => {
    const code = buildScript(
      "get_topology",
      {},
      { requestId: "req-t", ts: 7 }
    );
    expect(code.startsWith("__mcpLastResult=")).toBe(true);
    expect(code).toContain('getTopology("req-t","get_topology",7)');
  });

  it("contains no XMLHttpRequest, fetch, __mcpPost, or arrow anywhere", () => {
    const code = buildScript(
      "add_device",
      { name: "R1", model: "2911" },
      { requestId: "req-x", ts: 1 }
    );
    expect(code).not.toContain("XMLHttpRequest");
    expect(code).not.toContain("fetch(");
    expect(code).not.toContain("__mcpPost");
    expect(code).not.toContain("=>");
    expect(code).not.toContain("async ");
    expect(code).not.toContain("await ");
  });

  it("is a single line (no newlines)", () => {
    const code = buildScript(
      "add_device",
      { name: "R1", model: "2911" },
      { requestId: "req-line", ts: 1 }
    );
    expect(code).not.toContain("\n");
  });

  it("is pure ES5 — no const/let/class", () => {
    const code = buildScript(
      "add_device",
      { name: "R1", model: "2911" },
      { requestId: "req-es5", ts: 1 }
    );
    expect(code).not.toContain("const ");
    expect(code).not.toContain("let ");
    expect(code).not.toContain("class ");
  });
});
