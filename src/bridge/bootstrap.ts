// ── Bootstrap script builder façade ──
// Canonical generator: src/core/utils/pt/bootstrap-script.ts (AGENTS.md micro-modular alignment).
// Generates the ES5 IIFE that polls GET /next. Result POST is handled by the
// user's bridge.html pump (design D7); __mcpPost removed (design D13).

import { getBootstrapScript } from "../core/utils/pt/bootstrap-script.js";

export { getBootstrapScript };
export type { BootstrapScriptOptions } from "../core/utils/pt/bootstrap-script.js";

/**
 * Backward-compatible bridge bootstrap script builder.
 * Delegates to the canonical getBootstrapScript utility.
 */
export function buildBootstrapScript(baseUrl: string): string {
  return getBootstrapScript({ baseUrl });
}
