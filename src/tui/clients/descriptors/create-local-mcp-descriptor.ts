import type { ClientDescriptor } from "../../engine/client-descriptor.js";

export interface CreateLocalMcpDescriptorOptions {
  readonly id: string;
  readonly name: string;
  readonly resolveConfigPath: () => string | null;
  readonly allowMissing?: boolean;
}

/**
 * Pure factory creating a declarative `ClientDescriptor` for local command array MCP clients
 * (e.g., OpenCode, Kilocode) that store their server configurations under `mcp.MCP_PTB`
 * using the `{ command: ["node", scriptPath], type: "local" }` format.
 */
export function createLocalMcpDescriptor(
  options: CreateLocalMcpDescriptorOptions,
): ClientDescriptor {
  return {
    id: options.id,
    name: options.name,
    resolveConfigPath: options.resolveConfigPath,
    format: "mcp",
    ...(options.allowMissing ? { initial: () => ({}) } : {}),
    patch: (current, { scriptPath }) => ({
      ...current,
      mcp: {
        ...((current.mcp as Record<string, unknown>) ?? {}),
        MCP_PTB: {
          command: ["node", scriptPath],
          type: "local",
        },
      },
    }),
    verify: (config) => Boolean((config.mcp as Record<string, unknown> | undefined)?.MCP_PTB),
  };
}
