import type { BridgeAdapter } from "./adapter.js";
import { LiveBridge } from "./live.js";
import { ScriptBridge } from "./script.js";

export function createBridge(httpPort = 54321): BridgeAdapter {
  const live = new LiveBridge("127.0.0.1", httpPort);
  live.start();
  // Adapter that auto-falls back to script mode
  return new AutoBridge(live, new ScriptBridge());
}

/**
 * Wrapper that routes through Live when connected, falls back to Script otherwise.
 */
class AutoBridge implements BridgeAdapter {
  constructor(
    private live: LiveBridge,
    private script: ScriptBridge,
  ) {}

  start(): void {
    this.live.start();
  }

  stop(): void {
    this.live.stop();
  }

  isConnected(): boolean {
    return this.live.isConnected();
  }

  getMode() {
    return this.live.isConnected() ? "live" : "script";
  }

  async execute(method: string, params: Record<string, unknown>) {
    if (this.live.isConnected()) {
      return this.live.execute(method, params);
    }
    return this.script.execute(method, params);
  }
}

export type { BridgeAdapter } from "./adapter.js";
export { LiveBridge } from "./live.js";
export { ScriptBridge } from "./script.js";