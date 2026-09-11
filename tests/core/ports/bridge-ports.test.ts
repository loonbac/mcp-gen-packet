import { describe, expect, it } from "vitest";
import type { BridgePort, BridgeStatus } from "../../../src/core/ports/bridge-port.js";
import type { ProcessDetectorPort } from "../../../src/core/ports/process-detector-port.js";
import type { BridgeEvent, EventBufferPort } from "../../../src/core/ports/event-buffer-port.js";
import type { BridgeAdapter } from "../../../src/bridge/adapter.js";
import type { ToolResult } from "../../../src/core/types/tools.js";
import type { ExecutionMode } from "../../../src/core/types/bridge.js";

describe("Core Bridge Ports Contract (ISP)", () => {
  describe("BridgePort & BridgeStatus", () => {
    it("should allow creating an implementation conforming to BridgePort", async () => {
      class MockBridge implements BridgePort {
        private running = false;
        private connected = false;

        async execute(method: string, params: Record<string, unknown>): Promise<ToolResult> {
          return {
            mode: "live",
            data: { method, params },
          };
        }

        isConnected(): boolean {
          return this.connected;
        }

        getMode(): ExecutionMode {
          return "live";
        }

        start(): void {
          this.running = true;
          this.connected = true;
        }

        stop(): void {
          this.running = false;
          this.connected = false;
        }
      }

      const bridge: BridgePort = new MockBridge();
      expect(bridge.isConnected()).toBe(false);
      bridge.start();
      expect(bridge.isConnected()).toBe(true);
      expect(bridge.getMode()).toBe("live");

      const result = await bridge.execute("testMethod", { foo: "bar" });
      expect(result).toEqual({
        mode: "live",
        data: { method: "testMethod", params: { foo: "bar" } },
      });

      bridge.stop();
      expect(bridge.isConnected()).toBe(false);

      // Verify structural assignability to historical BridgeAdapter
      const adapter: BridgeAdapter = bridge;
      expect(adapter.isConnected()).toBe(false);
    });

    it("should type-check a valid BridgeStatus payload", () => {
      const status: BridgeStatus = {
        running: true,
        connected: false,
        pollingActive: false,
        packetTracerRunning: true,
        lastPollAgoSeconds: 12,
        queueDepth: 0,
        polls: 4,
        queued: 2,
        resultsReceived: 2,
        lastEvent: "listening",
      };

      expect(status.running).toBe(true);
      expect(status.packetTracerRunning).toBe(true);
      expect(status.lastPollAgoSeconds).toBe(12);
    });

    it("should allow null lastPollAgoSeconds in BridgeStatus when never polled", () => {
      const status: BridgeStatus = {
        running: false,
        connected: false,
        pollingActive: false,
        packetTracerRunning: false,
        lastPollAgoSeconds: null,
        queueDepth: 0,
        polls: 0,
        queued: 0,
        resultsReceived: 0,
        lastEvent: "idle",
      };

      expect(status.lastPollAgoSeconds).toBeNull();
    });
  });

  describe("ProcessDetectorPort", () => {
    it("should allow creating an implementation conforming to ProcessDetectorPort", () => {
      class MockDetector implements ProcessDetectorPort {
        constructor(private isRunning: boolean = false) {}

        isPacketTracerRunning(): boolean {
          return this.isRunning;
        }
      }

      const detector: ProcessDetectorPort = new MockDetector(true);
      expect(detector.isPacketTracerRunning()).toBe(true);

      const inactiveDetector: ProcessDetectorPort = new MockDetector(false);
      expect(inactiveDetector.isPacketTracerRunning()).toBe(false);
    });
  });

  describe("EventBufferPort & BridgeEvent", () => {
    it("should allow creating an implementation conforming to EventBufferPort", () => {
      class MockBuffer implements EventBufferPort {
        private events: BridgeEvent[] = [];
        private lastEvent = "idle";

        push(kind: string, detail: string): void {
          this.lastEvent = kind;
          this.events.push({
            ts: new Date(1700000000000).toISOString(),
            kind,
            detail,
          });
        }

        setEvent(kind: string, detail: string): void {
          this.push(kind, detail);
        }

        getLastEvent(): string {
          return this.lastEvent;
        }

        getRecent(limit?: number): BridgeEvent[] {
          if (limit !== undefined) {
            return this.events.slice(-limit);
          }
          return [...this.events];
        }

        get size(): number {
          return this.events.length;
        }

        clear(): void {
          this.events = [];
          this.lastEvent = "idle";
        }
      }

      const buffer: EventBufferPort = new MockBuffer();
      expect(buffer.size).toBe(0);
      expect(buffer.getLastEvent()).toBe("idle");

      buffer.push("init", "Bridge initialized");
      expect(buffer.size).toBe(1);
      expect(buffer.getLastEvent()).toBe("init");

      buffer.setEvent("listening", "Port 54321");
      expect(buffer.size).toBe(2);
      expect(buffer.getLastEvent()).toBe("listening");

      const recent = buffer.getRecent(1);
      expect(recent).toHaveLength(1);
      expect(recent[0].kind).toBe("listening");

      buffer.clear();
      expect(buffer.size).toBe(0);
      expect(buffer.getLastEvent()).toBe("idle");
    });
  });
});
