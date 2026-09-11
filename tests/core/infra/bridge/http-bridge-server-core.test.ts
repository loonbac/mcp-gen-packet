import { afterEach, describe, expect, it, vi } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { HttpBridgeServer } from "../../../../src/core/infra/bridge/http-bridge-server.js";
import { AsyncQueue } from "../../../../src/core/utils/async/async-queue.js";
import { EventBuffer } from "../../../../src/core/infra/bridge/event-buffer.js";
import type { BridgeStatus } from "../../../../src/core/ports/bridge-port.js";

function createStatus(overrides?: Partial<BridgeStatus>): BridgeStatus {
  return {
    running: true,
    connected: true,
    pollingActive: true,
    packetTracerRunning: true,
    lastPollAgoSeconds: 1.2,
    queueDepth: 0,
    polls: 5,
    queued: 2,
    resultsReceived: 1,
    lastEvent: "listening",
    ...overrides,
  };
}

function createServer(port = 0) {
  const commandQueue = new AsyncQueue<string>();
  const resultQueue = new AsyncQueue<string>();
  const events = new EventBuffer(400);
  const hooks = {
    getStatus: () => createStatus(),
    onPoll: vi.fn(),
    onCommandQueued: vi.fn(),
    onResultReceived: vi.fn(),
  };
  const server = new HttpBridgeServer({
    host: "127.0.0.1",
    port,
    commandQueue,
    resultQueue,
    events,
    hooks,
    logger: () => {},
  });
  return { server, events, hooks };
}

async function waitForListening(server: HttpBridgeServer, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (!server.isListening()) {
    if (Date.now() - start > timeoutMs) throw new Error("timed out waiting for listening");
    await new Promise((r) => setTimeout(r, 10));
  }
}

const live: HttpBridgeServer[] = [];
afterEach(() => {
  for (const s of live.splice(0)) {
    try {
      s.stop();
    } catch {
      // safe teardown
    }
  }
});

describe("HttpBridgeServer core transport (S4c.1)", () => {
  it("start() is idempotent and stop() is safe", async () => {
    const { server } = createServer(0);
    live.push(server);
    expect(server.isListening()).toBe(false);
    server.start();
    server.start();
    await waitForListening(server);
    expect(server.isListening()).toBe(true);
    server.stop();
    expect(server.isListening()).toBe(false);
    expect(() => server.stop()).not.toThrow();
  });

  it("stop() without start is a safe no-op", () => {
    const { server } = createServer(0);
    live.push(server);
    expect(() => server.stop()).not.toThrow();
    expect(server.isListening()).toBe(false);
  });

  it("OPTIONS * returns CORS preflight headers", async () => {
    const { server } = createServer(0);
    live.push(server);
    server.start();
    await waitForListening(server);
    const port = server.getPort();
    const res = await fetch(`http://127.0.0.1:${port}/any-path`, { method: "OPTIONS" });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-methods")).toContain("GET, POST, OPTIONS");
    expect(res.headers.get("access-control-allow-headers")).toBe("Content-Type");
  });

  it("GET /ping responds pong with CORS and records ping event", async () => {
    const { server, events } = createServer(0);
    live.push(server);
    server.start();
    await waitForListening(server);
    const res = await fetch(`http://127.0.0.1:${server.getPort()}/ping`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("pong");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(events.getLastEvent()).toBe("ping");
  });

  it("GET /monitor serves HTML dashboard", async () => {
    const { server } = createServer(0);
    live.push(server);
    server.start();
    await waitForListening(server);
    const res = await fetch(`http://127.0.0.1:${server.getPort()}/monitor`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<title>Bridge Monitor</title>");
    expect(html).toContain("#008080");
  });

  it("GET /status serializes legacy snake_case/camelCase fields", async () => {
    const { server } = createServer(0);
    live.push(server);
    server.start();
    await waitForListening(server);
    const res = await fetch(`http://127.0.0.1:${server.getPort()}/status`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      connected: true,
      polling_active: true,
      packet_tracer_running: true,
      running: true,
      queueDepth: 0,
      polls: 5,
      queued: 2,
      results_received: 1,
      last_event: "listening",
    });
    expect(typeof body.last_poll_ago).toBe("number");
  });

  it("binds ephemeral port 0 and serves /ping on assigned port", async () => {
    const { server } = createServer(0);
    live.push(server);
    server.start();
    await waitForListening(server);
    const assigned = server.getPort();
    expect(assigned).toBeGreaterThan(0);
    const res = await fetch(`http://127.0.0.1:${assigned}/ping`);
    expect(await res.text()).toBe("pong");
  });

  it("EADDRINUSE is contained with port-in-use event and clean teardown", async () => {
    const dummy = http.createServer((_req, res) => res.end("busy"));
    await new Promise<void>((resolve) => dummy.listen(0, "127.0.0.1", resolve));
    const colliding = (dummy.address() as AddressInfo).port;
    try {
      const { server, events } = createServer(colliding);
      live.push(server);
      expect(() => server.start()).not.toThrow();
      await new Promise((r) => setTimeout(r, 250));
      expect(server.isListening()).toBe(false);
      const kinds = events.getRecent().map((e) => e.kind);
      expect(kinds).toContain("port-in-use");
      expect(() => server.stop()).not.toThrow();
      expect(server.isListening()).toBe(false);
    } finally {
      await new Promise<void>((resolve) => dummy.close(() => resolve()));
    }
  });
});
