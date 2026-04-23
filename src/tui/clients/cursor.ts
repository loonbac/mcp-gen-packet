import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { MCPClient } from "./types.js";

function getConfigPath(): string {
  return join(homedir(), ".cursor", "mcp.json");
}

export const cursorClient: MCPClient = {
  name: "Cursor",
  id: "cursor",

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
      // Cursor uses "mcpServers" with { command: "node", args: ["path"] } - NO cwd
      if (!config.mcpServers) config.mcpServers = {};
      config.mcpServers.MCP_PTB = {
        command: "node",
        args: [scriptPath],
      };

      // 4. Write backup FIRST
      writeFileSync(backupPath, raw, "utf-8");

      // 5. Write updated config
      writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

      // 6. VERIFY
      const verifyRaw = readFileSync(configPath, "utf-8");
      const verifyConfig = JSON.parse(verifyRaw);
      if (!verifyConfig.mcpServers?.MCP_PTB) {
        return { success: false, error: "Verificación fallida: MCP_PTB no encontrado después de escribir" };
      }

      return { success: true, backup: backupPath };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },
};