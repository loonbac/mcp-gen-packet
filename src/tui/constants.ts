import { join } from "node:path";

export function getMcpServerEntry(projectPath: string) {
  return {
    MCP_PTB: {
      command: "node",
      args: [join(projectPath, "dist", "index.js")],
      cwd: projectPath,
    },
  };
}

export const CLIENT_CONFIG_PATHS: Record<string, string> = {};