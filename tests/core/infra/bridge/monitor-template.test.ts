import { describe, expect, it } from "vitest";
import { getMonitorHtml } from "../../../../src/core/infra/bridge/monitor-template.js";

describe("Monitor Template getMonitorHtml (S4b)", () => {
  it("should return a complete HTML5 document with title and lang='es'", () => {
    const html = getMonitorHtml();

    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<html lang="es">');
    expect(html).toContain("<title>Bridge Monitor</title>");
    expect(html).toContain("</html>");
  });

  it("should contain retro Win32 window styles, sunken classes, and teal background #008080", () => {
    const html = getMonitorHtml();

    expect(html).toContain("background-color: #008080;");
    expect(html).toContain(".window {");
    expect(html).toContain(".sunken {");
    expect(html).toContain(".title-bar {");
  });

  it("should contain all 10 required DOM status targets", () => {
    const html = getMonitorHtml();
    const requiredTargets = [
      'id="running"',
      'id="connected"',
      'id="pollingActive"',
      'id="packetTracerRunning"',
      'id="lastEvent"',
      'id="queueDepth"',
      'id="polls"',
      'id="queued"',
      'id="results"',
      'id="lastPollAgo"',
    ];

    for (const target of requiredTargets) {
      expect(html).toContain(target);
    }
  });

  it("should contain client-side polling logic targeting /status and /logs", () => {
    const html = getMonitorHtml();

    expect(html).toContain("fetch('/status'");
    expect(html).toContain("fetch('/logs'");
    expect(html).toContain("setInterval(tick,1000)");
  });

  it("should produce byte-identical deterministic output across successive calls", () => {
    const run1 = getMonitorHtml();
    const run2 = getMonitorHtml();
    const run3 = getMonitorHtml();

    expect(run1).toBe(run2);
    expect(run2).toBe(run3);
    expect(typeof run1).toBe("string");
    expect(run1.length).toBeGreaterThan(1000);
  });
});
