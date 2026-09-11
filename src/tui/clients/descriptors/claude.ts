import { homedir } from "node:os";
import { join } from "node:path";
import type { ClientDescriptor } from "../../engine/client-descriptor.js";
import { injectClient } from "../../engine/inject-client.js";
import type { MCPClient } from "../types.js";

/**
 * Pure function resolving Claude Code MCP configuration directory.
 */
export function getClaudeConfigDir(home: string = homedir()): string {
  return join(home, ".claude", "mcp");
}

/**
 * Pure function resolving Claude Code MCP configuration file path.
 */
export function getClaudeConfigPath(home: string = homedir()): string {
  return join(getClaudeConfigDir(home), "MCP_PTB.json");
}

/**
 * Declarative descriptor for Claude Code.
 * Writes an isolated per-server JSON configuration file at `~/.claude/mcp/MCP_PTB.json`.
 */
export const claudeDescriptor: ClientDescriptor = {
  id: "claude",
  name: "Claude Code",
  format: "custom",
  ensureDir: true,
  initial: () => ({}),
  resolveConfigPath: () => getClaudeConfigPath(),
  patch: (_current, { scriptPath }) => ({
    command: "node",
    args: [scriptPath],
  }),
  verify: (config) => {
    const c = config as Record<string, unknown> | undefined;
    return Boolean(c && typeof c.command === "string" && Array.isArray(c.args) && c.args.length > 0);
  },
};

/**
 * Historical Claude client instance created via pure descriptor injection.
 */
export const claudeClient: MCPClient = injectClient(claudeDescriptor);

