import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { MCPClient } from "./types.js";

function getConfigDir(): string {
  return join(homedir(), ".claude", "mcp");
}

function getConfigPath(): string {
  return join(getConfigDir(), "MCP_PTB.json");
}

export const claudeClient: MCPClient = {
  name: "Claude Code",
  id: "claude",

  detect(): boolean {
    return existsSync(getConfigPath());
  },

  configPath(): string | null {
    return getConfigPath();
  },

  async inject(projectPath: string): Promise<{ success: boolean; backup?: string; error?: string }> {
    const configDir = getConfigDir();
    const configPath = getConfigPath();
    const backupPath = configPath + ".bak";

    try {
      // Ensure directory exists
      if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
      }

      // 1. Read existing config (if it exists)
      let raw = "";
      if (existsSync(configPath)) {
        raw = readFileSync(configPath, "utf-8");
      }

      // 2. Parse existing config (if any) and clean
      let config: Record<string, unknown> = {};
      if (raw) {
        config = JSON.parse(raw);
        // Clean existing MCP_PTB entry
        if (config.MCP_PTB) delete config.MCP_PTB;
      }

      // 3. Build correct entry
      const scriptPath = join(projectPath, "dist", "index.js").replace(/\\/g, "/");
      // Claude Code uses SEPARATE file per server: { "command": "node", "args": ["path"] }
      config = {
        command: "node",
        args: [scriptPath],
      };

      // 4. Write backup (only if there was an existing config)
      if (raw) {
        writeFileSync(backupPath, raw, "utf-8");
      }

      // 5. Write updated config
      writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

      // 6. VERIFY: Re-read and confirm MCP_PTB content is correct
      if (!existsSync(configPath)) {
        return { success: false, error: "Verificación fallida: archivo de configuración no encontrado después de escribir" };
      }
      const verifyRaw = readFileSync(configPath, "utf-8");
      const verifyConfig = JSON.parse(verifyRaw);
      if (!verifyConfig.command || !verifyConfig.args) {
        return { success: false, error: "Verificación fallida: configuración de Claude no tiene el formato esperado" };
      }

      return { success: true, backup: backupPath || undefined };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },
};
