import { describe, expect, it, vi } from "vitest";
import type { SpawnSyncReturns } from "node:child_process";
import {
  PowerShellProcessDetector,
  type SpawnSyncFn,
} from "../../../../src/core/infra/bridge/powershell-detector.js";
import type { ProcessDetectorPort } from "../../../../src/core/ports/process-detector-port.js";

function createMockSpawn(
  stdout = "0",
  error?: Error,
): { spawn: SpawnSyncFn; getCalls: () => number } {
  let calls = 0;
  const spawn = vi.fn((_cmd, _args, _opts) => {
    calls++;
    if (error) {
      return {
        stdout: "",
        stderr: error.message,
        output: ["", "", error.message],
        pid: 1234,
        status: 1,
        signal: null,
        error,
      } as unknown as SpawnSyncReturns<string>;
    }
    return {
      stdout,
      stderr: "",
      output: ["", stdout, ""],
      pid: 1234,
      status: 0,
      signal: null,
    } as unknown as SpawnSyncReturns<string>;
  }) as unknown as SpawnSyncFn;

  return { spawn, getCalls: () => calls };
}

describe("PowerShellProcessDetector (S4b)", () => {
  it("should implement ProcessDetectorPort contract", () => {
    const { spawn } = createMockSpawn("0");
    const detector: ProcessDetectorPort = new PowerShellProcessDetector({
      platform: "win32",
      spawn,
    });
    expect(typeof detector.isPacketTracerRunning).toBe("function");
  });

  it("should return true when PowerShell stdout returns '1'", () => {
    const { spawn, getCalls } = createMockSpawn("1\r\n");
    const detector = new PowerShellProcessDetector({
      platform: "win32",
      spawn,
    });

    expect(detector.isPacketTracerRunning()).toBe(true);
    expect(getCalls()).toBe(1);
  });

  it("should return false when PowerShell stdout returns '0' or empty", () => {
    const mockZero = createMockSpawn("0\n");
    const detectorZero = new PowerShellProcessDetector({
      platform: "win32",
      spawn: mockZero.spawn,
    });
    expect(detectorZero.isPacketTracerRunning()).toBe(false);

    const mockEmpty = createMockSpawn("");
    const detectorEmpty = new PowerShellProcessDetector({
      platform: "win32",
      spawn: mockEmpty.spawn,
    });
    expect(detectorEmpty.isPacketTracerRunning()).toBe(false);
  });

  it("should throttle executions within 2,000ms interval and return cached value", () => {
    let currentTime = 1000;
    const clock = () => currentTime;
    const { spawn, getCalls } = createMockSpawn("1");

    const detector = new PowerShellProcessDetector({
      platform: "win32",
      clock,
      spawn,
      throttleMs: 2000,
    });

    // 1st call at T=1000 -> spawns, returns true
    expect(detector.isPacketTracerRunning()).toBe(true);
    expect(getCalls()).toBe(1);

    // 2nd call at T=1500 (delta=500ms < 2000ms) -> cached true, no spawn
    currentTime = 1500;
    expect(detector.isPacketTracerRunning()).toBe(true);
    expect(getCalls()).toBe(1);

    // 3rd call at T=2999 (delta=1999ms < 2000ms) -> cached true, no spawn
    currentTime = 2999;
    expect(detector.isPacketTracerRunning()).toBe(true);
    expect(getCalls()).toBe(1);

    // 4th call at T=3000 (delta=2000ms >= 2000ms) -> spawns
    currentTime = 3000;
    expect(detector.isPacketTracerRunning()).toBe(true);
    expect(getCalls()).toBe(2);
  });

  it("should return false on non-Windows platforms without spawning", () => {
    const { spawn, getCalls } = createMockSpawn("1");
    const detectorLinux = new PowerShellProcessDetector({
      platform: "linux",
      spawn,
    });
    expect(detectorLinux.isPacketTracerRunning()).toBe(false);
    expect(getCalls()).toBe(0);

    const detectorDarwin = new PowerShellProcessDetector({
      platform: "darwin",
      spawn,
    });
    expect(detectorDarwin.isPacketTracerRunning()).toBe(false);
    expect(getCalls()).toBe(0);
  });

  it("should handle spawnSync errors gracefully returning cached value", () => {
    const enoentError = new Error("spawnSync powershell ENOENT");
    Object.assign(enoentError, { code: "ENOENT" });
    const { spawn: spawnEnoent } = createMockSpawn("", enoentError);

    const detectorEnoent = new PowerShellProcessDetector({
      platform: "win32",
      spawn: spawnEnoent,
    });
    expect(() => detectorEnoent.isPacketTracerRunning()).not.toThrow();
    expect(detectorEnoent.isPacketTracerRunning()).toBe(false);

    // Thrown exception from spawnSync
    const throwingSpawn: SpawnSyncFn = (() => {
      throw new Error("Command failed abruptly");
    }) as unknown as SpawnSyncFn;

    const detectorThrow = new PowerShellProcessDetector({
      platform: "win32",
      spawn: throwingSpawn,
    });
    expect(() => detectorThrow.isPacketTracerRunning()).not.toThrow();
    expect(detectorThrow.isPacketTracerRunning()).toBe(false);
  });

  it("should preserve existing true cache when subsequent spawn errors occur", () => {
    let shouldFail = false;
    let calls = 0;
    let currentTime = 1000;
    const clock = () => currentTime;

    const spawn = vi.fn(() => {
      calls++;
      if (shouldFail) {
        const timeoutErr = new Error("ETIMEDOUT");
        Object.assign(timeoutErr, { code: "ETIMEDOUT" });
        return {
          stdout: "",
          stderr: "timed out",
          error: timeoutErr,
        } as unknown as SpawnSyncReturns<string>;
      }
      return {
        stdout: "1",
        stderr: "",
      } as unknown as SpawnSyncReturns<string>;
    }) as unknown as SpawnSyncFn;

    const detector = new PowerShellProcessDetector({
      platform: "win32",
      clock,
      spawn,
      throttleMs: 2000,
    });

    // 1st call -> success, cache = true
    expect(detector.isPacketTracerRunning()).toBe(true);
    expect(calls).toBe(1);

    // Advance beyond throttle and trigger spawn error
    currentTime = 4000;
    shouldFail = true;
    expect(detector.isPacketTracerRunning()).toBe(true);
    expect(calls).toBe(2);
  });
});
