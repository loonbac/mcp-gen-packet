import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { homedir, tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import {
  vscodeDescriptor,
  getVscodeConfigPath,
} from "../../../src/tui/clients/descriptors/vscode.js";
import {
  claudeDescriptor,
  getClaudeConfigPath,
  getClaudeConfigDir,
} from "../../../src/tui/clients/descriptors/claude.js";
import { vscodeClient } from "../../../src/tui/clients/vscode.js";
import { claudeClient } from "../../../src/tui/clients/claude.js";
import { injectClient } from "../../../src/tui/engine/inject-client.js";
import { resolveDescriptorFormat } from "../../../src/tui/engine/client-descriptor.js";

describe("Sub-Slice S3c.1: Specialized Descriptors & Clients (VS Code, Claude Code)", () => {
  const home = homedir();
  const mockContext = {
    projectPath: "C:/Projects/agent-harness",
    scriptPath: "C:/Projects/agent-harness/dist/index.js",
  };

  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "mcp-specialized-descriptors-test-"));
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("VS Code descriptor and client", () => {
    it("should provide correct static metadata for VS Code", () => {
      expect(vscodeDescriptor.id).toBe("vscode");
      expect(vscodeDescriptor.name).toBe("VS Code");
      expect(vscodeDescriptor.format).toBe("servers");
      expect(vscodeDescriptor.initial).toBeUndefined();
    });

    it("should resolve platform-specific config paths for Windows, macOS, and Linux", () => {
      // Windows with APPDATA
      const winCustom = getVscodeConfigPath("win32", { APPDATA: "C:\\Users\\dev\\AppData\\Roaming" }, "C:\\Users\\dev");
      expect(winCustom).toBe(join("C:\\Users\\dev\\AppData\\Roaming", "Code", "User", "mcp.json"));

      // Windows fallback without APPDATA
      const winFallback = getVscodeConfigPath("win32", {}, "C:\\Users\\dev");
      expect(winFallback).toBe(join("C:\\Users\\dev", "AppData", "Roaming", "Code", "User", "mcp.json"));

      // macOS darwin
      const macPath = getVscodeConfigPath("darwin", {}, "/Users/dev");
      expect(macPath).toBe(join("/Users/dev", "Library", "Application Support", "Code", "User", "mcp.json"));

      // Linux with XDG_CONFIG_HOME
      const linuxXdg = getVscodeConfigPath("linux", { XDG_CONFIG_HOME: "/custom/config" }, "/home/dev");
      expect(linuxXdg).toBe(join("/custom/config", "Code", "User", "mcp.json"));

      // Linux fallback without XDG_CONFIG_HOME
      const linuxFallback = getVscodeConfigPath("linux", {}, "/home/dev");
      expect(linuxFallback).toBe(join("/home/dev", ".config", "Code", "User", "mcp.json"));

      // Default descriptor resolveConfigPath resolves to Code/User/mcp.json
      const resolved = vscodeDescriptor.resolveConfigPath();
      expect(resolved).not.toBeNull();
      expect(resolved).toContain(join("Code", "User", "mcp.json"));
    });

    it("should patch servers.MCP_PTB with command, args, and normalized cwd", () => {
      const current = {
        editor: "vim",
        servers: {
          existingServer: { command: "python", args: ["server.py"] },
        },
      };

      const patched = vscodeDescriptor.patch(current, mockContext) as Record<string, any>;

      expect(patched.editor).toBe("vim");
      expect(patched.servers.existingServer).toEqual({ command: "python", args: ["server.py"] });
      expect(patched.servers.MCP_PTB).toEqual({
        command: "node",
        args: ["C:/Projects/agent-harness/dist/index.js"],
        cwd: "C:/Projects/agent-harness",
      });
    });

    it("should normalize backslashes in cwd when given Windows paths", () => {
      const windowsContext = {
        projectPath: "D:\\Dev\\Projects\\mcp-tool",
        scriptPath: "D:\\Dev\\Projects\\mcp-tool\\dist\\index.js",
      };

      const patched = vscodeDescriptor.patch({}, windowsContext) as Record<string, any>;
      expect(patched.servers.MCP_PTB.cwd).toBe("D:/Dev/Projects/mcp-tool");
      expect(patched.servers.MCP_PTB.cwd).not.toContain("\\");
    });

    it("should verify presence of servers.MCP_PTB", () => {
      expect(vscodeDescriptor.verify?.({ servers: { MCP_PTB: { command: "node" } } })).toBe(true);
      expect(vscodeDescriptor.verify?.({ servers: {} })).toBe(false);
      expect(vscodeDescriptor.verify?.({})).toBe(false);
      expect(vscodeDescriptor.verify?.({ servers: { MCP_PTB: null } })).toBe(false);
    });

    it("should expose vscodeClient facade delegating to descriptor", () => {
      expect(vscodeClient.id).toBe("vscode");
      expect(vscodeClient.name).toBe("VS Code");
      expect(vscodeClient.configPath()).toBe(vscodeDescriptor.resolveConfigPath());
    });

    it("should inject successfully into existing VS Code config and create backup", async () => {
      const configPath = join(testDir, "Code", "User", "mcp.json");
      mkdirSync(dirname(configPath), { recursive: true });
      writeFileSync(
        configPath,
        JSON.stringify({ servers: { prior: { command: "go" } } }, null, 2),
        "utf-8",
      );

      const client = injectClient({
        ...vscodeDescriptor,
        resolveConfigPath: () => configPath,
      });

      const result = await client.inject("/workspace/project");
      expect(result.success).toBe(true);
      expect(result.backup).toBeDefined();
      expect(existsSync(result.backup!)).toBe(true);

      const updated = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(updated.servers.prior).toEqual({ command: "go" });
      expect(updated.servers.MCP_PTB).toEqual({
        command: "node",
        args: ["/workspace/project/dist/index.js"],
        cwd: "/workspace/project",
      });
    });
  });

  describe("Claude Code descriptor and client", () => {
    it("should provide correct static metadata and isolated path for Claude Code", () => {
      expect(claudeDescriptor.id).toBe("claude");
      expect(claudeDescriptor.name).toBe("Claude Code");
      expect(claudeDescriptor.format).toBe("custom");
      expect(claudeDescriptor.ensureDir).toBe(true);
      expect(claudeDescriptor.initial?.()).toEqual({});

      expect(getClaudeConfigDir("/home/testuser")).toBe(join("/home/testuser", ".claude", "mcp"));
      expect(getClaudeConfigPath("/home/testuser")).toBe(
        join("/home/testuser", ".claude", "mcp", "MCP_PTB.json"),
      );
      expect(claudeDescriptor.resolveConfigPath()).toBe(
        join(home, ".claude", "mcp", "MCP_PTB.json"),
      );
    });

    it("should patch root object with command and args array", () => {
      const patched = claudeDescriptor.patch({}, mockContext) as Record<string, any>;
      expect(patched).toEqual({
        command: "node",
        args: ["C:/Projects/agent-harness/dist/index.js"],
      });
    });

    it("should verify root object contains command and non-empty args array", () => {
      expect(
        claudeDescriptor.verify?.({
          command: "node",
          args: ["dist/index.js"],
        }),
      ).toBe(true);
      expect(claudeDescriptor.verify?.({ command: "node" })).toBe(false);
      expect(claudeDescriptor.verify?.({ args: ["dist/index.js"] })).toBe(false);
      expect(claudeDescriptor.verify?.({ command: "node", args: [] })).toBe(false);
      expect(claudeDescriptor.verify?.({})).toBe(false);
      expect(claudeDescriptor.verify?.(null as any)).toBe(false);
    });

    it("should expose claudeClient facade delegating to descriptor", () => {
      expect(claudeClient.id).toBe("claude");
      expect(claudeClient.name).toBe("Claude Code");
      expect(claudeClient.configPath()).toBe(claudeDescriptor.resolveConfigPath());
    });

    it("should inject into missing file and create directory recursively reporting backup metadata without creating physical backup", async () => {
      const isolatedClaudePath = join(testDir, ".claude", "mcp", "MCP_PTB.json");

      const client = injectClient({
        ...claudeDescriptor,
        resolveConfigPath: () => isolatedClaudePath,
      });

      const result = await client.inject("/workspace/project");
      expect(result.success).toBe(true);
      expect(result.backup).toBe(isolatedClaudePath + ".bak");
      expect(existsSync(isolatedClaudePath)).toBe(true);
      expect(existsSync(isolatedClaudePath + ".bak")).toBe(false);

      const written = JSON.parse(readFileSync(isolatedClaudePath, "utf-8"));
      expect(written).toEqual({
        command: "node",
        args: ["/workspace/project/dist/index.js"],
      });
    });

    it("should resolve explicit and normative default format correctly", () => {
      expect(resolveDescriptorFormat(claudeDescriptor)).toBe("custom");
      expect(resolveDescriptorFormat(vscodeDescriptor)).toBe("servers");
      expect(resolveDescriptorFormat({ format: undefined })).toBe("mcpServers");
    });

    it("should create backup when injecting into an existing Claude Code file with empty object", async () => {
      const isolatedClaudePath = join(testDir, ".claude", "mcp", "MCP_PTB.json");
      const dir = join(testDir, ".claude", "mcp");
      mkdirSync(dir, { recursive: true });
      writeFileSync(isolatedClaudePath, "{}", "utf-8");

      const client = injectClient({
        ...claudeDescriptor,
        resolveConfigPath: () => isolatedClaudePath,
      });

      const result = await client.inject("/workspace/project");
      expect(result.success).toBe(true);
      expect(result.backup).toBeDefined();
      expect(existsSync(result.backup!)).toBe(true);
      expect(readFileSync(result.backup!, "utf-8")).toBe("{}");

      const written = JSON.parse(readFileSync(isolatedClaudePath, "utf-8"));
      expect(written).toEqual({
        command: "node",
        args: ["/workspace/project/dist/index.js"],
      });
    });

    it("should create backup when injecting into an existing Claude Code file with previous config", async () => {
      const isolatedClaudePath = join(testDir, ".claude", "mcp", "MCP_PTB.json");
      const dir = join(testDir, ".claude", "mcp");
      mkdirSync(dir, { recursive: true });
      writeFileSync(isolatedClaudePath, JSON.stringify({ old: "config" }), "utf-8");

      const client = injectClient({
        ...claudeDescriptor,
        resolveConfigPath: () => isolatedClaudePath,
      });

      const result = await client.inject("/workspace/project");
      expect(result.success).toBe(true);
      expect(result.backup).toBeDefined();
      expect(existsSync(result.backup!)).toBe(true);
      expect(readFileSync(result.backup!, "utf-8")).toBe(JSON.stringify({ old: "config" }));

      const written = JSON.parse(readFileSync(isolatedClaudePath, "utf-8"));
      expect(written).toEqual({
        command: "node",
        args: ["/workspace/project/dist/index.js"],
      });
    });
  });

  describe("triangulation: stale keys, platform edge cases, and path normalization", () => {
    it("should clean stale mcp and mcpServers keys when injecting VS Code configuration", async () => {
      const vscodeConfigPath = join(testDir, "Code", "User", "mcp.json");
      mkdirSync(join(testDir, "Code", "User"), { recursive: true });
      const currentWithStale = {
        mcp: { MCP_PTB: { command: "old" } },
        mcpServers: { MCP_PTB: { command: "old" } },
        servers: { MCP_PTB: { command: "old" }, otherServer: { command: "stay" } },
      };
      writeFileSync(vscodeConfigPath, JSON.stringify(currentWithStale), "utf-8");

      const client = injectClient({
        ...vscodeDescriptor,
        resolveConfigPath: () => vscodeConfigPath,
      });

      const result = await client.inject("/workspace/project");
      expect(result.success).toBe(true);

      const written = JSON.parse(readFileSync(vscodeConfigPath, "utf-8"));
      expect((written as any).mcp?.MCP_PTB).toBeUndefined();
      expect((written as any).mcpServers?.MCP_PTB).toBeUndefined();
      expect((written as any).servers?.otherServer).toEqual({ command: "stay" });
      expect((written as any).servers?.MCP_PTB).toEqual({
        command: "node",
        args: ["/workspace/project/dist/index.js"],
        cwd: "/workspace/project",
      });
    });

    it("should return error without throwing when VS Code config file is missing", async () => {
      const missingPath = join(testDir, "Code", "User", "mcp.json");
      const client = injectClient({
        ...vscodeDescriptor,
        resolveConfigPath: () => missingPath,
      });

      const result = await client.inject("/workspace/project");
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain("No existe el archivo de configuración");
    });

    it("should fail gracefully if verification predicate returns false", async () => {
      const failingDescriptor = {
        ...claudeDescriptor,
        resolveConfigPath: () => join(testDir, ".claude", "mcp", "MCP_PTB.json"),
        verify: () => false,
      };

      const client = injectClient(failingDescriptor);
      const result = await client.inject("/workspace/project");

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain("Verificación fallida");
    });
  });
});
