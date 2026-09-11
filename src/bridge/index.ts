import type { BridgeAdapter } from "./adapter.js";
import { AutoBridge } from "../core/infra/bridge/auto-bridge.js";
import { LiveBridge } from "../core/infra/bridge/live-bridge.js";
import { ScriptBridge } from "./script.js";

/**
 * Composition root: wires the canonical LiveBridge and ScriptBridge into
 * an AutoBridge fallback adapter and starts the live server.
 */
export function createBridge(httpPort = 54321): BridgeAdapter {
  const live = new LiveBridge("127.0.0.1", httpPort);
  live.start();
  return new AutoBridge(live, new ScriptBridge());
}

export type { BridgeAdapter } from "./adapter.js";
export { AutoBridge } from "../core/infra/bridge/auto-bridge.js";
export { LiveBridge } from "../core/infra/bridge/live-bridge.js";
export { ScriptBridge } from "./script.js";
