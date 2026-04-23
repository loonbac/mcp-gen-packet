import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { MCPClient } from "./types.js";

function getConfigPath(): string {
  return join(homedir(), ".config", "kilo", "opencode.json");
}

export const kilocodeClient: MCPClient = {
  name: "Kilocode",
  id: "kilocode",

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
      // 1. Read existing config (if it exists)
      let raw = "";
      if (existsSync(configPath)) {
        raw = readFileSync(configPath, "utf-8");
      }

      // 2. Parse and clean existing config
      let config: Record<string, unknown> = {};
      if (raw) {
        config = JSON.parse(raw);
        // CLEAN: Remove any existing MCP_PTB entry
        if ((config.mcp as Record<string, unknown>)?.MCP_PTB) delete (config.mcp as Record<string, unknown>).MCP_PTB;
        if ((config.mcpServers as Record<string, unknown>)?.MCP_PTB) delete (config.mcpServers as Record<string, unknown>).MCP_PTB;
        if ((config.servers as Record<string, unknown>)?.MCP_PTB) delete (config.servers as Record<string, unknown>).MCP_PTB;
      }

      // 3. Build correct entry
      const scriptPath = join(projectPath, "dist", "index.js").replace(/\\/g, "/");
      // Kilocode uses "mcp" key like OpenCode: { command: ["node", args], type: "local" }
      if (!config.mcp) config.mcp = {};
      (config.mcp as Record<string, unknown>).MCP_PTB = {
        command: ["node", scriptPath],
        type: "local",
      };

      // 4. Write backup FIRST (only if there was an existing config)
      if (raw) {
        writeFileSync(backupPath, raw, "utf-8");
      }

      // 5. Write updated config
      writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

      // 6. VERIFY
      if (!existsSync(configPath)) {
        return { success: false, error: "Verificación fallida: archivo de configuración no encontrado después de escribir" };
      }
      const verifyRaw = readFileSync(configPath, "utf-8");
      const verifyConfig = JSON.parse(verifyRaw);
      if (!(verifyConfig.mcp as Record<string, unknown>)?.MCP_PTB) {
        return { success: false, error: "Verificación fallida: MCP_PTB no encontrado después de escribir" };
      }

      return { success: true, backup: backupPath || undefined };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },
};
