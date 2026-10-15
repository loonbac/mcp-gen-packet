import type { ClientDescriptor } from "../../engine/client-descriptor.js";

export interface CreateMcpServersDescriptorOptions {
  readonly id: string;
  readonly name: string;
  readonly resolveConfigPath: () => string | null;
  readonly allowMissing?: boolean;
  readonly detect?: () => boolean;
  readonly extraServerFields?: Record<string, unknown>;
}

/**
 * Pure factory creating a declarative `ClientDescriptor` for standard multi-server JSON clients
 * (Cursor, Gemini CLI, Windsurf, Kimi, Kiro, Qwen, Antigravity, Command Code) storing configuration under `mcpServers.MCP_PTB`.
 */
export function createMcpServersDescriptor(
  options: CreateMcpServersDescriptorOptions,
): ClientDescriptor {
  return {
    id: options.id,
    name: options.name,
    resolveConfigPath: options.resolveConfigPath,
    format: "mcpServers",
    ...(options.detect ? { detect: options.detect } : {}),
    ...(options.allowMissing ? { initial: () => ({}) } : {}),
    patch: (current, { scriptPath }) => ({
      ...current,
      mcpServers: {
        ...((current.mcpServers as Record<string, unknown>) ?? {}),
        MCP_PTB: {
          ...(options.extraServerFields ?? {}),
          command: "node",
          args: [scriptPath],
        },
      },
    }),
    verify: (config) => Boolean((config.mcpServers as Record<string, unknown> | undefined)?.MCP_PTB),
  };
}
