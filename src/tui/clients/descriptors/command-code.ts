import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ClientDescriptor } from "../../engine/client-descriptor.js";

/**
 * Declarative descriptor for Command Code.
 * Configures servers under `mcpServers.MCP_PTB` in `~/.commandcode/mcp.json`
 * with the explicit stdio transport fields Command Code writes via `cmd mcp add`.
 */
export const commandCodeDescriptor: ClientDescriptor = {
  id: "command-code",
  name: "Command Code",
  format: "mcpServers",
  resolveConfigPath: () => join(homedir(), ".commandcode", "mcp.json"),
  detect: () => existsSync(join(homedir(), ".commandcode")),
  initial: () => ({}),
  patch: (current, { scriptPath }) => ({
    ...current,
    mcpServers: {
      ...((current.mcpServers as Record<string, unknown>) ?? {}),
      MCP_PTB: {
        transport: "stdio",
        enabled: true,
        command: "node",
        args: [scriptPath],
      },
    },
  }),
  verify: (config) =>
    Boolean(
      (config.mcpServers as Record<string, unknown> | undefined)?.MCP_PTB,
    ),
};
