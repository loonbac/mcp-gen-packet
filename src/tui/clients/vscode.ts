import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { platform, homedir } from "node:os";
import { join } from "node:path";
import type { MCPClient } from "./types.js";

function getConfigPath(): string {
  const home = homedir();
  const p = platform();
  if (p === "win32") {
    return join(process.env.APPDATA || join(home, "AppData", "Roaming"), "Code", "User", "mcp.json");
  } else if (p === "darwin") {
    return join(home, "Library", "Application Support", "Code", "User", "mcp.json");
  } else {
    return join(process.env.XDG_CONFIG_HOME || join(home, ".config"), "Code", "User", "mcp.json");
  }
}

export const vscodeClient: MCPClient = {
  name: "VS Code",
  id: "vscode",

  detect(): boolean {
    return existsSync(getConfigPath());
  },

  configPath(): string | null {
    return getConfigPath();
  },

  async inject(projectPath: string): Promise<{ success: boolean; backup?: string; error?: string }> {
    const configPath = getConfigPath();
    const backupPath = configPath + ".bak";

    try {
      // 1. Read existing config
      const raw = readFileSync(configPath, "utf-8");
      const config = JSON.parse(raw);

      // 2. CLEAN: Remove any existing MCP_PTB entry
      if (config.mcp?.MCP_PTB) delete config.mcp.MCP_PTB;
      if (config.mcpServers?.MCP_PTB) delete config.mcpServers.MCP_PTB;
      if (config.servers?.MCP_PTB) delete config.servers.MCP_PTB;

      // 3. Build correct entry
      const scriptPath = join(projectPath, "dist", "index.js").replace(/\\/g, "/");
      // VS Code uses "servers" (not mcpServers) with { command: "node", args: ["path"], cwd: "path" }
      if (!config.servers) config.servers = {};
      config.servers.MCP_PTB = {
        command: "node",
        args: [scriptPath],
        cwd: projectPath.replace(/\\/g, "/"),
      };

      // 4. Write backup FIRST
      writeFileSync(backupPath, raw, "utf-8");

      // 5. Write updated config
      writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

      // 6. VERIFY
      const verifyRaw = readFileSync(configPath, "utf-8");
      const verifyConfig = JSON.parse(verifyRaw);
      if (!verifyConfig.servers?.MCP_PTB) {
        return { success: false, error: "Verificación fallida: MCP_PTB no encontrado después de escribir" };
      }

      return { success: true, backup: backupPath };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },
};