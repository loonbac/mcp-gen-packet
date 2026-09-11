/**
 * Backward-compatible façade for LiveBridge.
 *
 * Canonical implementation is in src/core/infra/bridge/live-bridge.ts
 * and canonical port contracts are in src/core/ports/bridge-port.ts.
 */
export { LiveBridge } from "../core/infra/bridge/live-bridge.js";
export type { LiveBridgeOptions, LiveBridgeServerPort } from "../core/infra/bridge/live-bridge.js";
export type { BridgeStatus } from "../core/ports/bridge-port.js";
