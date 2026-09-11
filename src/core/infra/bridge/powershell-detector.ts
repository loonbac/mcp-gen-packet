import { spawnSync } from "node:child_process";
import type { ProcessDetectorPort } from "../../ports/process-detector-port.js";

export type ProcessDetectorClock = () => number;
export type SpawnSyncFn = typeof spawnSync;

export interface PowerShellProcessDetectorOptions {
  readonly throttleMs?: number;
  readonly timeoutMs?: number;
  readonly platform?: NodeJS.Platform;
  readonly clock?: ProcessDetectorClock;
  readonly spawn?: SpawnSyncFn;
}

/**
 * Platform-aware Packet Tracer process detector using PowerShell with execution throttling.
 */
export class PowerShellProcessDetector implements ProcessDetectorPort {
  private static readonly DEFAULT_THROTTLE_MS = 2000;
  private static readonly DEFAULT_TIMEOUT_MS = 3000;
  private static readonly PS_COMMAND =
    "$p = Get-Process -Name PacketTracer -ErrorAction SilentlyContinue; if ($p) { '1' } else { '0' }";

  private readonly throttleMs: number;
  private readonly timeoutMs: number;
  private readonly platform: NodeJS.Platform;
  private readonly clock: ProcessDetectorClock;
  private readonly spawn: SpawnSyncFn;

  private cache = false;
  private lastCheckAt = -Infinity;

  constructor(options?: PowerShellProcessDetectorOptions) {
    this.throttleMs =
      options?.throttleMs ?? PowerShellProcessDetector.DEFAULT_THROTTLE_MS;
    this.timeoutMs =
      options?.timeoutMs ?? PowerShellProcessDetector.DEFAULT_TIMEOUT_MS;
    this.platform = options?.platform ?? process.platform;
    this.clock = options?.clock ?? Date.now;
    this.spawn = options?.spawn ?? spawnSync;
  }

  /**
   * Check if Packet Tracer is currently running.
   * Returns false on non-Windows platforms or spawn errors without throwing.
   */
  isPacketTracerRunning(): boolean {
    if (this.platform !== "win32") {
      return false;
    }

    const now = this.clock();
    if (now - this.lastCheckAt < this.throttleMs) {
      return this.cache;
    }

    this.lastCheckAt = now;

    try {
      const result = this.spawn(
        "powershell",
        ["-NoProfile", "-Command", PowerShellProcessDetector.PS_COMMAND],
        {
          encoding: "utf-8",
          timeout: this.timeoutMs,
        },
      );

      if (result && !result.error && typeof result.stdout === "string") {
        this.cache = result.stdout.trim() === "1";
      }
    } catch {
      // Graceful fallback on spawn exceptions (ENOENT, timeout, etc.)
    }

    return this.cache;
  }
}
