import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { MCPClient } from "./types.js";

function getConfigPath(): string {
  return join(homedir(), ".config", "opencode", "opencode.json");
}

export const opencodeClient: MCPClient = {
  name: "OpenCode",
  id: "opencode",

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

      // 2. CLEAN: Remove any existing MCP_PTB entry (handles all possible keys)
      if (config.mcp?.MCP_PTB) delete config.mcp.MCP_PTB;
      if (config.mcpServers?.MCP_PTB) delete config.mcpServers.MCP_PTB;
      if (config.servers?.MCP_PTB) delete config.servers.MCP_PTB;

      // 3. Build correct entry
      const scriptPath = join(projectPath, "dist", "index.js").replace(/\\/g, "/");
      // OpenCode uses "mcp" key with { command: [cmd, args], type: "local" } format
      if (!config.mcp) config.mcp = {};
      config.mcp.MCP_PTB = {
        command: ["node", scriptPath],
        type: "local",
      };

      // 4. Write backup FIRST (before modifying config)
      writeFileSync(backupPath, raw, "utf-8");

      // 5. Write updated config
      writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

      // 6. VERIFY: Re-read and confirm MCP_PTB exists
      const verifyRaw = readFileSync(configPath, "utf-8");
      const verifyConfig = JSON.parse(verifyRaw);
      if (!verifyConfig.mcp?.MCP_PTB) {
        return { success: false, error: "Verificación fallida: MCP_PTB no encontrado después de escribir" };
      }

      return { success: true, backup: backupPath };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },
};