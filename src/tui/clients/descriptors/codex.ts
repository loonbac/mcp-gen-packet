import { homedir } from "node:os";
import { join } from "node:path";
import type { ClientDescriptor } from "../../engine/client-descriptor.js";
import { parseCodexToml, stringifyCodexToml } from "../codecs/codex-toml.js";

export function getCodexConfigPath(): string {
  return join(homedir(), ".codex", "config.toml");
}

export const codexDescriptor: ClientDescriptor<Record<string, unknown>> = {
  id: "codex",
  name: "Codex",
  format: "custom",
  resolveConfigPath: getCodexConfigPath,

  customSerializer: {
    deserialize: parseCodexToml,
    serialize: stringifyCodexToml,
  },

  patch: (current, context) => {
    const mcp =
      current.mcp && typeof current.mcp === "object" && !Array.isArray(current.mcp)
        ? { ...(current.mcp as Record<string, unknown>) }
        : {};
    const servers =
      mcp.servers && typeof mcp.servers === "object" && !Array.isArray(mcp.servers)
        ? { ...(mcp.servers as Record<string, unknown>) }
        : {};

    servers.MCP_PTB = {
      command: ["node", context.scriptPath],
    };

    return {
      ...current,
      mcp: {
        ...mcp,
        servers,
      },
    };
  },

  verify: (config) => {
    return Boolean(config && typeof config === "object" && Object.keys(config).length > 0);
  },
};
