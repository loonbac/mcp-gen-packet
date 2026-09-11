import type { ExecutionMode } from "../types/bridge.js";
import type { ToolResult } from "../types/tools.js";

/**
 * Snapshot of live bridge status and connection telemetry.
 */
export interface BridgeStatus {
  running: boolean;
  connected: boolean;
  pollingActive: boolean;
  packetTracerRunning: boolean;
  lastPollAgoSeconds: number | null;
  queueDepth: number;
  polls: number;
  queued: number;
  resultsReceived: number;
  lastEvent: string;
}

/**
 * Consumer-driven minimal port for bridge execution and lifecycle management (ISP).
 */
export interface BridgePort {
  /** Execute a PTBuilder JS command, returning result or script */
  execute(
    method: string,
    params: Record<string, unknown>,
  ): Promise<ToolResult>;

  /** Check if live connection is available */
  isConnected(): boolean;

  /** Get current execution mode ("live" or "script") */
  getMode(): ExecutionMode;

  /** Start the bridge adapter (if needed) */
  start(): void;

  /** Stop the bridge adapter */
  stop(): void;
}
