import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { homedir } from "node:os";
import { join } from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import {
  parseCodexToml,
  stringifyCodexToml,
} from "../../../src/tui/clients/codecs/codex-toml.js";
import {
  codexDescriptor,
  getCodexConfigPath,
} from "../../../src/tui/clients/descriptors/codex.js";
import { codexClient } from "../../../src/tui/clients/codex.js";
import { injectClient } from "../../../src/tui/engine/inject-client.js";
import {
  ALL_CLIENTS,
  getAvailableClients,
} from "../../../src/tui/clients/index.js";

describe("Codex TOML Codec (parseCodexToml & stringifyCodexToml)", () => {
  describe("parseCodexToml", () => {
    it("returns empty object for empty or whitespace-only input", () => {
      expect(parseCodexToml("")).toEqual({});
      expect(parseCodexToml("   \n\n  \t  \n")).toEqual({});
    });

    it("strips full-line comments and handles whitespace tolerance", () => {
      const input = `
        # This is a full comment
        # Another comment
        key = "value"
      `;
      const result = parseCodexToml(input);
      expect(result).toEqual({ key: "value" });
    });

    it("strips inline comments while preserving string contents", () => {
      const input = `
        theme = "dark" # Theme comment
        url = "http://localhost:54321/#anchor" # Trailing comment
      `;
      const result = parseCodexToml(input);
      expect(result).toEqual({
        theme: "dark",
        url: "http://localhost:54321/#anchor",
      });
    });

    it("parses scalar strings with double and single quotes", () => {
      const input = `
        double = "hello world"
        single = 'single quoted'
      `;
      const result = parseCodexToml(input);
      expect(result).toEqual({
        double: "hello world",
        single: "single quoted",
      });
    });

    it("parses booleans and numbers correctly", () => {
      const input = `
        active = true
        disabled = false
        port = 8080
        ratio = 3.14
      `;
      const result = parseCodexToml(input);
      expect(result).toEqual({
        active: true,
        disabled: false,
        port: 8080,
        ratio: 3.14,
      });
    });

    it("parses string arrays with double and single quotes", () => {
      const input = `
        command = ["node", "/path/to/dist/index.js"]
        aliases = ['pt', 'cisco']
      `;
      const result = parseCodexToml(input);
      expect(result).toEqual({
        command: ["node", "/path/to/dist/index.js"],
        aliases: ["pt", "cisco"],
      });
    });

    it("parses single sections into nested objects", () => {
      const input = `
        [general]
        name = "packet-tracer"
        version = "1.0.0"
      `;
      const result = parseCodexToml(input);
      expect(result).toEqual({
        general: {
          name: "packet-tracer",
          version: "1.0.0",
        },
      });
    });

    it("parses multi-level dotted sections ([section.sub.leaf]) into deep nested objects", () => {
      const input = `
        [mcp.servers.MCP_PTB]
        command = ["node", "/project/dist/index.js"]
      `;
      const result = parseCodexToml(input);
      expect(result).toEqual({
        mcp: {
          servers: {
            MCP_PTB: {
              command: ["node", "/project/dist/index.js"],
            },
          },
        },
      });
    });

    it("preserves multiple independent and nested sections", () => {
      const input = `
        appName = "MCP Suite"

        [editor]
        theme = "dark"
        fontSize = 14

        [mcp.servers.MCP_PTB]
        command = ["node", "/dist/index.js"]

        [logging]
        level = "debug"
      `;
      const result = parseCodexToml(input);
      expect(result).toEqual({
        appName: "MCP Suite",
        editor: {
          theme: "dark",
          fontSize: 14,
        },
        mcp: {
          servers: {
            MCP_PTB: {
              command: ["node", "/dist/index.js"],
            },
          },
        },
        logging: {
          level: "debug",
        },
      });
    });
  });

  describe("stringifyCodexToml", () => {
    it("returns empty string for empty object", () => {
      expect(stringifyCodexToml({})).toBe("");
    });

    it("serializes top-level scalar values and arrays", () => {
      const input = {
        name: "codex-config",
        active: true,
        count: 5,
        tags: ["a", "b"],
      };
      const output = stringifyCodexToml(input);
      expect(output).toContain('name = "codex-config"');
      expect(output).toContain("active = true");
      expect(output).toContain("count = 5");
      expect(output).toContain('tags = ["a", "b"]');
    });

    it("serializes sections with proper headers", () => {
      const input = {
        editor: {
          theme: "dark",
        },
      };
      const output = stringifyCodexToml(input);
      expect(output).toContain("[editor]");
      expect(output).toContain('theme = "dark"');
    });

    it("serializes nested multi-level sections with array brackets", () => {
      const input = {
        mcp: {
          servers: {
            MCP_PTB: {
              command: ["node", "/dist/index.js"],
            },
          },
        },
      };
      const output = stringifyCodexToml(input);
      expect(output).toContain("[mcp.servers.MCP_PTB]");
      expect(output).toContain('command = ["node", "/dist/index.js"]');
    });
  });

  describe("Round-Trip Fidelity & Section Preservation", () => {
    it("round-trips complex configurations preserving unrelated sections", () => {
      const original = {
        appName: "Codex Editor",
        editor: {
          theme: "monokai",
          fontSize: 16,
        },
        mcp: {
          servers: {
            MCP_PTB: {
              command: ["node", "/opt/mcp/dist/index.js"],
            },
          },
        },
        tools: {
          autoSave: true,
        },
      };

      const serialized = stringifyCodexToml(original);
      const parsed = parseCodexToml(serialized);

      expect(parsed).toEqual(original);
    });

    it("preserves unrelated sections when adding or updating MCP_PTB", () => {
      const initialToml = `
        [settings]
        telemetry = false

        [other_section]
        key = "value"
      `;
      const config = parseCodexToml(initialToml);

      // Inject MCP_PTB
      if (!config.mcp) config.mcp = {};
      const mcp = config.mcp as Record<string, unknown>;
      if (!mcp.servers) mcp.servers = {};
      (mcp.servers as Record<string, unknown>).MCP_PTB = {
        command: ["node", "/new/path/dist/index.js"],
      };

      const serialized = stringifyCodexToml(config);
      const roundtripped = parseCodexToml(serialized);

      expect(roundtripped.settings).toEqual({ telemetry: false });
      expect(roundtripped.other_section).toEqual({ key: "value" });
      expect(
        (roundtripped.mcp as Record<string, unknown>)?.servers,
      ).toEqual({
        MCP_PTB: {
          command: ["node", "/new/path/dist/index.js"],
        },
      });
    });
  });
});

describe("Codex Descriptor & Client Façade", () => {
  it("defines correct metadata and config path", () => {
    expect(codexDescriptor.id).toBe("codex");
    expect(codexDescriptor.name).toBe("Codex");
    expect(codexDescriptor.format).toBe("custom");
    expect(codexDescriptor.resolveConfigPath()).toBe(
      join(homedir(), ".codex", "config.toml"),
    );
    expect(getCodexConfigPath()).toBe(join(homedir(), ".codex", "config.toml"));
  });

  it("patches configuration correctly into mcp.servers.MCP_PTB", () => {
    const context = {
      projectPath: "/my/project",
      scriptPath: "/my/project/dist/index.js",
    };
    const initialConfig = {
      editor: { theme: "light" },
    };

    const patched = codexDescriptor.patch(initialConfig, context);
    expect(patched.editor).toEqual({ theme: "light" });
    expect(
      (patched.mcp as Record<string, unknown>)?.servers,
    ).toEqual({
      MCP_PTB: {
        command: ["node", "/my/project/dist/index.js"],
      },
    });
  });

  it("verifies non-empty output and rejects empty configuration", () => {
    expect(codexDescriptor.verify?.({ mcp: {} })).toBe(true);
    expect(codexDescriptor.verify?.({ other: "val" })).toBe(true);
    expect(codexDescriptor.verify?.({})).toBe(false);
  });

  it("delegates MCPClient methods to descriptor", () => {
    expect(codexClient.id).toBe("codex");
    expect(codexClient.name).toBe("Codex");
    expect(codexClient.configPath()).toBe(
      join(homedir(), ".codex", "config.toml"),
    );
    expect(typeof codexClient.detect).toBe("function");
    expect(typeof codexClient.inject).toBe("function");
  });
});

describe("Client Registry (ALL_CLIENTS & getAvailableClients)", () => {
  it("preserves exact historical client order across all 12 clients", () => {
    expect(ALL_CLIENTS).toHaveLength(12);

    const expectedIds = [
      "opencode",
      "claude",
      "vscode",
      "cursor",
      "gemini",
      "codex",
      "windsurf",
      "kilocode",
      "kimi",
      "kiro",
      "qwen",
      "antigravity",
    ];

    const actualIds = ALL_CLIENTS.map((c) => c.id);
    expect(actualIds).toEqual(expectedIds);

    const expectedNames = [
      "OpenCode",
      "Claude Code",
      "VS Code",
      "Cursor",
      "Gemini CLI",
      "Codex",
      "Windsurf",
      "Kilocode",
      "Kimi",
      "Kiro IDE",
      "Qwen Code",
      "Antigravity",
    ];
    const actualNames = ALL_CLIENTS.map((c) => c.name);
    expect(actualNames).toEqual(expectedNames);
  });

  it("filters available clients based on detect() return value", () => {
    const originalDetects = ALL_CLIENTS.map((c) => c.detect);

    try {
      // Mock all detect to false
      for (const client of ALL_CLIENTS) {
        client.detect = () => false;
      }
      expect(getAvailableClients()).toEqual([]);

      // Mock first two to true
      ALL_CLIENTS[0].detect = () => true;
      ALL_CLIENTS[1].detect = () => true;
      const available = getAvailableClients();
      expect(available).toHaveLength(2);
      expect(available.map((c) => c.id)).toEqual(["opencode", "claude"]);
    } finally {
      // Restore original detect implementations
      for (let i = 0; i < ALL_CLIENTS.length; i++) {
        ALL_CLIENTS[i].detect = originalDetects[i];
      }
    }
  });
});

describe("Codex Injection Triangulation", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(join(os.tmpdir(), "codex-triangulation-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it("injects Codex configuration into an existing complex TOML file preserving unrelated sections", async () => {
    const configPath = join(tempDir, "config.toml");
    const complexToml = [
      'appName = "Codex Suite"',
      "",
      "[settings]",
      "telemetry = false",
      "autoSave = true",
      "",
      "[editor]",
      'theme = "nord"',
      "fontSize = 14",
    ].join("\n");

    fs.writeFileSync(configPath, complexToml, "utf-8");

    const client = injectClient({
      ...codexDescriptor,
      resolveConfigPath: () => configPath,
    });

    const result = await client.inject("/workspace/my-pt-project");

    expect(result.success).toBe(true);
    expect(result.backup).toBe(configPath + ".bak");

    // Backup byte fidelity
    expect(fs.readFileSync(configPath + ".bak", "utf-8")).toBe(complexToml);

    // Written content preserves unrelated sections
    const writtenRaw = fs.readFileSync(configPath, "utf-8");
    const written = parseCodexToml(writtenRaw);

    expect(written.appName).toBe("Codex Suite");
    expect(written.settings).toEqual({ telemetry: false, autoSave: true });
    expect(written.editor).toEqual({ theme: "nord", fontSize: 14 });
    expect(
      (written.mcp as Record<string, unknown>)?.servers,
    ).toEqual({
      MCP_PTB: {
        command: ["node", "/workspace/my-pt-project/dist/index.js"],
      },
    });
  });

  it("purges stale container entries and updates MCP_PTB on subsequent injection", async () => {
    const configPath = join(tempDir, "config.toml");
    const initialToml = [
      "[mcp.servers.MCP_PTB]",
      'command = ["node", "/old/path/dist/index.js"]',
      "",
      "[mcpServers.MCP_PTB]",
      'command = "node"',
    ].join("\n");

    fs.writeFileSync(configPath, initialToml, "utf-8");

    const client = injectClient({
      ...codexDescriptor,
      resolveConfigPath: () => configPath,
    });

    const result = await client.inject("/new/path/project");

    expect(result.success).toBe(true);

    const written = parseCodexToml(fs.readFileSync(configPath, "utf-8"));
    expect(
      (written.mcp as Record<string, unknown>)?.servers,
    ).toEqual({
      MCP_PTB: {
        command: ["node", "/new/path/project/dist/index.js"],
      },
    });
    // Stale mcpServers container should not contain MCP_PTB
    expect(
      (written.mcpServers as Record<string, unknown> | undefined)?.MCP_PTB,
    ).toBeUndefined();
  });

  it("handles missing configuration file returning failure without throwing", async () => {
    const nonExistentPath = join(tempDir, "does-not-exist.toml");
    const client = injectClient({
      ...codexDescriptor,
      resolveConfigPath: () => nonExistentPath,
    });

    const result = await client.inject("/test/project");
    expect(result.success).toBe(false);
    expect(result.error).toContain("No existe el archivo de configuración");
  });

  it("captures verification failure if serializer produces empty configuration", async () => {
    const configPath = join(tempDir, "config.toml");
    fs.writeFileSync(configPath, '[settings]\nkey = "val"\n', "utf-8");

    const client = injectClient({
      ...codexDescriptor,
      resolveConfigPath: () => configPath,
      customSerializer: {
        deserialize: parseCodexToml,
        serialize: () => "", // Intentionally produces empty string
      },
    });

    const result = await client.inject("/test/project");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Verificación fallida");
  });
});

