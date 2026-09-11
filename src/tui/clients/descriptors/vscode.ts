import { homedir, platform } from "node:os";
import { join } from "node:path";
import type { ClientDescriptor } from "../../engine/client-descriptor.js";

/**
 * Pure function resolving VS Code configuration path according to platform conventions.
 */
export function getVscodeConfigPath(
  p: NodeJS.Platform = platform(),
  env: NodeJS.ProcessEnv = process.env,
  home: string = homedir(),
): string {
  if (p === "win32") {
    return join(env.APPDATA || join(home, "AppData", "Roaming"), "Code", "User", "mcp.json");
  } else if (p === "darwin") {
    return join(home, "Library", "Application Support", "Code", "User", "mcp.json");
  } else {
    return join(env.XDG_CONFIG_HOME || join(home, ".config"), "Code", "User", "mcp.json");
  }
}

/**
 * Declarative descriptor for VS Code.
 * Configures servers under `servers.MCP_PTB` including command, args, and normalized `cwd`.
 */
export const vscodeDescriptor: ClientDescriptor = {
  id: "vscode",
  name: "VS Code",
  format: "servers",
  resolveConfigPath: () => getVscodeConfigPath(),
  patch: (current, { scriptPath, projectPath }) => ({
    ...current,
    servers: {
      ...((current.servers as Record<string, unknown> | undefined) ?? {}),
      MCP_PTB: {
        command: "node",
        args: [scriptPath],
        cwd: projectPath.replace(/\\/g, "/"),
      },
    },
  }),
  verify: (config) => Boolean((config.servers as Record<string, unknown> | undefined)?.MCP_PTB),
};
