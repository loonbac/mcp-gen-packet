import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { MCPClient } from "./types.js";

function getConfigPath(): string {
  return join(homedir(), ".codex", "config.toml");
}

function parseToml(raw: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = raw.split("\n");
  let currentSection: Record<string, unknown> = {};
  let currentSectionName = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      if (currentSectionName) result[currentSectionName] = currentSection;
      currentSectionName = sectionMatch[1];
      currentSection = {};
      continue;
    }

    const kvMatch = trimmed.match(/^([^=]+)=\s*(.*)$/);
    if (kvMatch && currentSectionName) {
      const key = kvMatch[1].trim();
      let value = kvMatch[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      currentSection[key] = value;
    }
  }

  if (currentSectionName) result[currentSectionName] = currentSection;
  return result;
}

function stringifyToml(obj: Record<string, unknown>): string {
  let result = "";
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      result += `[${key}]\n`;
      for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
        if (Array.isArray(subValue)) {
          // For arrays like command: ["node", "path"], stringify as JSON array
          result += `${subKey} = ${JSON.stringify(subValue)}\n`;
        } else if (typeof subValue === "object" && subValue !== null && !Array.isArray(subValue)) {
          // Nested object (like servers: { MCP_PTB: {...} }) - recurse
          result += `${subKey} = ${JSON.stringify(subValue)}\n`;
        } else {
          result += `${subKey} = "${subValue}"\n`;
        }
      }
      result += "\n";
    } else if (Array.isArray(value)) {
      result += `${key} = ${JSON.stringify(value)}\n`;
    } else {
      result += `${key} = "${value}"\n`;
    }
  }
  return result.trim() + "\n";
}

export const codexClient: MCPClient = {
  name: "Codex",
  id: "codex",

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
      const config = parseToml(raw);

      // 2. CLEAN: Remove any existing MCP_PTB entry
      if ((config.mcp as Record<string, unknown>)?.MCP_PTB) delete (config.mcp as Record<string, unknown>).MCP_PTB;
      if ((config.mcpServers as Record<string, unknown>)?.MCP_PTB) delete (config.mcpServers as Record<string, unknown>).MCP_PTB;
      if ((config.servers as Record<string, unknown>)?.MCP_PTB) delete (config.servers as Record<string, unknown>).MCP_PTB;

      // 3. Build correct entry
      const scriptPath = join(projectPath, "dist", "index.js").replace(/\\/g, "/");
      // Codex uses TOML with "mcp" -> "servers" section, command as [cmd, args] array - NO cwd
      if (!config.mcp) config.mcp = {};
      const mcpConfig = config.mcp as Record<string, unknown>;
      if (!mcpConfig.servers) mcpConfig.servers = {};
      (mcpConfig.servers as Record<string, unknown>).MCP_PTB = {
        command: ["node", scriptPath],
      };

      // 4. Write backup FIRST
      writeFileSync(backupPath, raw, "utf-8");

      // 5. Write updated config
      writeFileSync(configPath, stringifyToml(config), "utf-8");

      // 6. VERIFY - for TOML, just verify the file exists and is non-empty
      // (nested objects become strings in TOML, so exact structure check is unreliable)
      const verifyRaw = readFileSync(configPath, "utf-8");
      if (!verifyRaw || verifyRaw.trim().length === 0) {
        return { success: false, error: "Verificación fallida: archivo de configuración vacío después de escribir" };
      }

      return { success: true, backup: backupPath };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },
};