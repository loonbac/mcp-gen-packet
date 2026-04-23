import type { ExecutionMode, ToolResult } from "../types/protocol.js";

export interface BridgeAdapter {
  /** Execute a PTBuilder JS command, returning result or script */
  execute(method: string, params: Record<string, unknown>): Promise<ToolResult>;

  /** Check if live connection is available */
  isConnected(): boolean;

  /** Get current execution mode */
  getMode(): ExecutionMode;

  /** Start the adapter (if needed) */
  start(): void;

  /** Stop the adapter */
  stop(): void;
}
