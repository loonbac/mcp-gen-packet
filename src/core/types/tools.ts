import type { ExecutionMode } from "./bridge.js";

export interface ToolResult<T = unknown> {
  mode: ExecutionMode;
  data: T;
  code?: string; // Only in script mode
}
