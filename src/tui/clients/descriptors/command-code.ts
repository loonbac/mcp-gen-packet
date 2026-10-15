import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createMcpServersDescriptor } from "./create-mcp-servers-descriptor.js";

/**
 * Declarative descriptor for Command Code.
 * Configures servers under `mcpServers.MCP_PTB` in `~/.commandcode/mcp.json`
 * with explicit stdio transport fields (`transport: "stdio"`, `enabled: true`)
 * matching Command Code's native `cmd mcp add` configuration.
 * Detects client presence via `~/.commandcode` directory (detecting installed client without requiring prior configuration).
 * Uses the `createMcpServersDescriptor` factory - does NOT reimplement `patch` or `verify`.
 */
export const commandCodeDescriptor = createMcpServersDescriptor({
  id: "command-code",
  name: "Command Code",
  resolveConfigPath: () => join(homedir(), ".commandcode", "mcp.json"),
  allowMissing: true,
  detect: () => existsSync(join(homedir(), ".commandcode")),
  extraServerFields: {
    transport: "stdio",
    enabled: true,
  },
});
