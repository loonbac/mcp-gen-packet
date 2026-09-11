import type { BridgePort } from "../../ports/bridge-port.js";
import type { ExecutionMode } from "../../types/bridge.js";
import type { ToolResult } from "../../types/tools.js";

/**
 * Fallback bridge adapter that dynamically routes execution to LiveBridge
 * when connected, and falls back to ScriptBridge when disconnected.
 *
 * Implements BridgePort adhering to the Interface Segregation Principle (ISP)
 * accepting structural dependencies for full testability and decoupling.
 */
export class AutoBridge implements BridgePort {
  constructor(
    private readonly live: BridgePort,
    private readonly script: BridgePort,
  ) {}

  /**
   * Forward start exclusively to the live bridge.
   */
  start(): void {
    this.live.start();
  }

  /**
   * Forward stop exclusively to the live bridge.
   */
  stop(): void {
    this.live.stop();
  }

  /**
   * Check connection status via the live bridge.
   */
  isConnected(): boolean {
    return this.live.isConnected();
  }

  /**
   * Determine current execution mode dynamically based on live connectivity.
   */
  getMode(): ExecutionMode {
    return this.live.isConnected() ? "live" : "script";
  }

  /**
   * Execute command via live bridge when connected, falling back to script bridge when offline.
   */
  async execute(
    method: string,
    params: Record<string, unknown>,
  ): Promise<ToolResult> {
    if (this.live.isConnected()) {
      return this.live.execute(method, params);
    }
    return this.script.execute(method, params);
  }
}
