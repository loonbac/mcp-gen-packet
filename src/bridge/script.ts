import type { BridgeAdapter } from "./adapter.js";
import type { ExecutionMode, ToolResult } from "../types/protocol.js";
import { buildScript } from "./script-builder.js";
import { buildBootstrapScript } from "./bootstrap.js";

export class ScriptBridge implements BridgeAdapter {
  isConnected(): boolean {
    return false;
  }

  getMode(): ExecutionMode {
    return "script";
  }

  bootstrapScript(): string {
    return buildBootstrapScript("http://127.0.0.1:54321");
  }

  start(): void { /* No-op */ }
  stop(): void { /* No-op */ }

  async execute(method: string, params: Record<string, unknown>): Promise<ToolResult> {
    const code = buildScript(method, params);
    return { mode: "script", data: { method, params }, code };
  }
}
