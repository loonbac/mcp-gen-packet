// ── Shared tool execution wrapper ──

import type { BridgeAdapter } from "../../bridge/adapter.js";
import type { ToolResult } from "../../types/protocol.js";

/**
 * Creates an execute function for a tool that dispatches to the bridge.
 */
export function createToolExecutor(
  methodName: string,
  bridge: BridgeAdapter,
  params: Record<string, unknown>,
): Promise<ToolResult> {
  return bridge.execute(methodName, params);
}