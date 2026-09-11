import { describe, expect, it } from "vitest";
import { EventBuffer } from "../../../../src/core/infra/bridge/event-buffer.js";
import type { EventBufferPort } from "../../../../src/core/ports/event-buffer-port.js";

describe("EventBuffer (Bounded Circular Telemetry)", () => {
  describe("Constructor & Defaults", () => {
    it("should initialize with default capacity 400, size 0, and idle lastEvent", () => {
      const buffer = new EventBuffer();
      expect(buffer.size).toBe(0);
      expect(buffer.getLastEvent()).toBe("idle");
      expect(buffer.getRecent()).toEqual([]);
    });

    it("should satisfy EventBufferPort interface", () => {
      const buffer: EventBufferPort = new EventBuffer();
      expect(typeof buffer.push).toBe("function");
      expect(typeof buffer.setEvent).toBe("function");
      expect(typeof buffer.getLastEvent).toBe("function");
      expect(typeof buffer.getRecent).toBe("function");
      expect(typeof buffer.clear).toBe("function");
      expect(buffer.size).toBe(0);
    });

    it("should accept custom capacity and custom clock", () => {
      const fixedDate = new Date("2026-09-11T12:00:00.000Z");
      const buffer = new EventBuffer(10, () => fixedDate);
      buffer.push("test", "detail");

      expect(buffer.size).toBe(1);
      const events = buffer.getRecent();
      expect(events[0]).toEqual({
        ts: "2026-09-11T12:00:00.000Z",
        kind: "test",
        detail: "detail",
      });
    });

    it("should throw RangeError when capacity is not a positive integer", () => {
      expect(() => new EventBuffer(0)).toThrow(RangeError);
      expect(() => new EventBuffer(-10)).toThrow(RangeError);
      expect(() => new EventBuffer(1.5)).toThrow(RangeError);
      expect(() => new EventBuffer(NaN)).toThrow(RangeError);
      expect(() => new EventBuffer(Infinity)).toThrow(RangeError);
      // @ts-expect-error testing invalid type
      expect(() => new EventBuffer("400")).toThrow(RangeError);
    });
  });

  describe("Event Recording (push & setEvent)", () => {
    it("should record events chronologically with ISO-8601 timestamps", () => {
      let tick = 0;
      const clock = () => new Date(1700000000000 + (tick++) * 1000);
      const buffer = new EventBuffer(100, clock);

      buffer.push("init", "Bridge init");
      buffer.push("listening", "Listening on port 54321");
      buffer.setEvent("enqueue", "Command 1 enqueued");

      expect(buffer.size).toBe(3);
      expect(buffer.getLastEvent()).toBe("enqueue");

      const recent = buffer.getRecent();
      expect(recent).toHaveLength(3);
      expect(recent[0].kind).toBe("init");
      expect(recent[0].detail).toBe("Bridge init");
      expect(recent[1].kind).toBe("listening");
      expect(recent[2].kind).toBe("enqueue");
      expect(recent[2].ts).toBe(new Date(1700000002000).toISOString());
    });

    it("should setEvent delegate to push, updating lastEvent and recording entry", () => {
      const buffer = new EventBuffer(10);
      buffer.setEvent("port-in-use", "Address 54321 already bound");

      expect(buffer.getLastEvent()).toBe("port-in-use");
      expect(buffer.size).toBe(1);
      expect(buffer.getRecent()[0].detail).toBe("Address 54321 already bound");
    });
  });

  describe("FIFO Eviction at Capacity", () => {
    it("should evict oldest event when capacity is exceeded", () => {
      const buffer = new EventBuffer(5);

      for (let i = 1; i <= 6; i++) {
        buffer.push(`ev${i}`, `detail ${i}`);
      }

      expect(buffer.size).toBe(5);
      expect(buffer.getLastEvent()).toBe("ev6");

      const kinds = buffer.getRecent().map((e) => e.kind);
      expect(kinds).toEqual(["ev2", "ev3", "ev4", "ev5", "ev6"]);
    });

    it("should maintain fixed capacity over large number of pushes", () => {
      const buffer = new EventBuffer(3);

      for (let i = 0; i < 100; i++) {
        buffer.push(`event-${i}`, `payload-${i}`);
      }

      expect(buffer.size).toBe(3);
      expect(buffer.getLastEvent()).toBe("event-99");
      const kinds = buffer.getRecent().map((e) => e.kind);
      expect(kinds).toEqual(["event-97", "event-98", "event-99"]);
    });
  });

  describe("Bounded Retrieval (getRecent)", () => {
    it("should return bounded subset of recent events when limit is specified", () => {
      const buffer = new EventBuffer(50);
      for (let i = 0; i < 30; i++) {
        buffer.push(`k${i}`, `d${i}`);
      }

      const last5 = buffer.getRecent(5);
      expect(last5).toHaveLength(5);
      expect(last5[0].kind).toBe("k25");
      expect(last5[4].kind).toBe("k29");
    });

    it("should return all events when limit exceeds current size", () => {
      const buffer = new EventBuffer(50);
      buffer.push("k1", "d1");
      buffer.push("k2", "d2");

      const recent = buffer.getRecent(100);
      expect(recent).toHaveLength(2);
      expect(recent[0].kind).toBe("k1");
      expect(recent[1].kind).toBe("k2");
    });

    it("should return copy of array to prevent mutation of internal buffer", () => {
      const buffer = new EventBuffer(10);
      buffer.push("k1", "d1");

      const recent = buffer.getRecent();
      recent.push({ ts: "fake", kind: "fake", detail: "fake" });

      expect(buffer.size).toBe(1);
      expect(buffer.getRecent()).toHaveLength(1);
    });

    it("should handle edge limits safely (0, negative, fractional)", () => {
      const buffer = new EventBuffer(10);
      buffer.push("k1", "d1");
      buffer.push("k2", "d2");
      buffer.push("k3", "d3");

      expect(buffer.getRecent(0)).toEqual([]);
      expect(buffer.getRecent(-2)).toEqual([]);
      expect(buffer.getRecent(1.9)).toHaveLength(1);
      expect(buffer.getRecent(1.9)[0].kind).toBe("k3");
      expect(buffer.getRecent(undefined)).toHaveLength(3);
    });

    it("should handle empty string kind and detail without error", () => {
      const buffer = new EventBuffer(10);
      buffer.push("", "");
      expect(buffer.size).toBe(1);
      expect(buffer.getLastEvent()).toBe("");
      expect(buffer.getRecent()[0]).toMatchObject({ kind: "", detail: "" });
    });
  });

  describe("Clear Buffer", () => {
    it("should reset size to 0, lastEvent to idle, and empty events", () => {
      const buffer = new EventBuffer(10);
      buffer.push("k1", "d1");
      buffer.push("k2", "d2");
      expect(buffer.size).toBe(2);
      expect(buffer.getLastEvent()).toBe("k2");

      buffer.clear();
      expect(buffer.size).toBe(0);
      expect(buffer.getLastEvent()).toBe("idle");
      expect(buffer.getRecent()).toEqual([]);
    });

    it("should allow pushing new events after clear", () => {
      const buffer = new EventBuffer(10);
      buffer.push("k1", "d1");
      buffer.clear();

      buffer.push("k_new", "d_new");
      expect(buffer.size).toBe(1);
      expect(buffer.getLastEvent()).toBe("k_new");
      expect(buffer.getRecent()).toHaveLength(1);
    });
  });
});
