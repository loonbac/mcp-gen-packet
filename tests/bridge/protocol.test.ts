import { describe, it, expect } from "vitest";
import type { BridgeResult } from "../../src/types/protocol";

describe("BridgeResult interface", () => {
  it("is exported and conforms to envelope shape", () => {
    // BridgeResult: { requestId, method, ok, data?, error?, ts }
    const env: BridgeResult = {
      requestId: "req-123",
      method: "add_device",
      ok: true,
      data: { name: "R1" },
      ts: Date.now(),
    };
    expect(env.requestId).toBe("req-123");
    expect(env.method).toBe("add_device");
    expect(env.ok).toBe(true);
    expect(env.data).toEqual({ name: "R1" });
    expect(env.ts).toBeGreaterThan(0);
  });

  it("supports ok=false with error string", () => {
    const env: BridgeResult = {
      requestId: "req-456",
      method: "add_device",
      ok: false,
      error: "Device not found",
      ts: 1,
    };
    expect(env.ok).toBe(false);
    expect(env.error).toBe("Device not found");
  });

  it("allows absent optional fields", () => {
    const env: BridgeResult = {
      requestId: "req-789",
      method: "get_devices",
      ok: true,
      ts: 1,
    };
    expect(env.data).toBeUndefined();
    expect(env.error).toBeUndefined();
  });
});
