import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { createLocalMcpDescriptor } from "../../../src/tui/clients/descriptors/create-local-mcp-descriptor.js";
import { opencodeDescriptor } from "../../../src/tui/clients/descriptors/opencode.js";
import { kilocodeDescriptor } from "../../../src/tui/clients/descriptors/kilocode.js";
import { opencodeClient } from "../../../src/tui/clients/opencode.js";
import { kilocodeClient } from "../../../src/tui/clients/kilocode.js";
import { injectClient } from "../../../src/tui/engine/inject-client.js";
import { removeStaleMcpPtb } from "../../../src/tui/engine/remove-stale-mcp-ptb.js";
import { resolveDescriptorFormat } from "../../../src/tui/engine/client-descriptor.js";

describe("Sub-Slice S3b.3: Local Command Array Clients (OpenCode, Kilocode)", () => {
  const home = homedir();
  const mockContext = {
    projectPath: "C:/Projects/test-project",
    scriptPath: "C:/Projects/test-project/dist/index.js",
  };

  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "mcp-local-descriptors-test-"));
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("createLocalMcpDescriptor factory", () => {
    it("should produce a descriptor with format 'mcp' and expected payload shape", () => {
      const descriptor = createLocalMcpDescriptor({
        id: "test-client",
        name: "Test Client",
        resolveConfigPath: () => "/custom/path/config.json",
      });

      expect(descriptor.id).toBe("test-client");
      expect(descriptor.name).toBe("Test Client");
      expect(descriptor.format).toBe("mcp");
      expect(descriptor.resolveConfigPath()).toBe("/custom/path/config.json");
      expect(descriptor.initial).toBeUndefined();

      const patched = descriptor.patch({}, mockContext) as Record<string, any>;
      expect(patched.mcp).toBeDefined();
      expect(patched.mcp.MCP_PTB).toEqual({
        command: ["node", "C:/Projects/test-project/dist/index.js"],
        type: "local",
      });
    });

    it("should support allowMissing option to configure initial empty object factory", () => {
      const descriptorWithMissing = createLocalMcpDescriptor({
        id: "missing-ok",
        name: "Missing OK",
        resolveConfigPath: () => "/some/path.json",
        allowMissing: true,
      });

      expect(descriptorWithMissing.initial).toBeDefined();
      expect(descriptorWithMissing.initial?.()).toEqual({});
    });

    it("should preserve sibling properties and existing mcp entries during patch", () => {
      const descriptor = createLocalMcpDescriptor({
        id: "preserve-test",
        name: "Preserve Test",
        resolveConfigPath: () => "/path.json",
      });

      const current = {
        theme: "dark",
        mcp: {
          existingServer: {
            command: ["python", "server.py"],
            type: "local",
          },
        },
      };

      const patched = descriptor.patch(current, mockContext) as Record<string, any>;
      expect(patched.theme).toBe("dark");
      expect(patched.mcp.existingServer).toEqual({
        command: ["python", "server.py"],
        type: "local",
      });
      expect(patched.mcp.MCP_PTB).toEqual({
        command: ["node", "C:/Projects/test-project/dist/index.js"],
        type: "local",
      });
    });

    it("should verify presence of mcp.MCP_PTB", () => {
      const descriptor = createLocalMcpDescriptor({
        id: "verify-test",
        name: "Verify Test",
        resolveConfigPath: () => "/path.json",
      });

      expect(descriptor.verify?.({ mcp: { MCP_PTB: { command: ["node", "index.js"] } } })).toBe(true);
      expect(descriptor.verify?.({ mcp: {} })).toBe(false);
      expect(descriptor.verify?.({})).toBe(false);
      expect(descriptor.verify?.({ mcp: { MCP_PTB: null } })).toBe(false);
    });
  });

  describe("OpenCode descriptor and client", () => {
    it("should resolve correct metadata and config path for OpenCode", () => {
      expect(opencodeDescriptor.id).toBe("opencode");
      expect(opencodeDescriptor.name).toBe("OpenCode");
      expect(opencodeDescriptor.format).toBe("mcp");
      expect(opencodeDescriptor.resolveConfigPath()).toBe(
        join(home, ".config", "opencode", "opencode.json"),
      );
      expect(opencodeDescriptor.initial).toBeUndefined();
    });

    it("should patch mcp.MCP_PTB with command array and local type", () => {
      const current = { existing: true };
      const patched = opencodeDescriptor.patch(current, mockContext) as Record<string, any>;

      expect(patched.existing).toBe(true);
      expect(patched.mcp.MCP_PTB).toEqual({
        command: ["node", "C:/Projects/test-project/dist/index.js"],
        type: "local",
      });
    });

    it("should expose MCPClient facade delegating to descriptor", () => {
      expect(opencodeClient.id).toBe("opencode");
      expect(opencodeClient.name).toBe("OpenCode");
      expect(opencodeClient.configPath()).toBe(opencodeDescriptor.resolveConfigPath());
      expect(resolveDescriptorFormat(opencodeDescriptor)).toBe("mcp");
    });
  });

  describe("Kilocode descriptor and client", () => {
    it("should resolve correct metadata, config path, and initial factory for Kilocode", () => {
      expect(kilocodeDescriptor.id).toBe("kilocode");
      expect(kilocodeDescriptor.name).toBe("Kilocode");
      expect(kilocodeDescriptor.format).toBe("mcp");
      expect(kilocodeDescriptor.resolveConfigPath()).toBe(
        join(home, ".config", "kilo", "opencode.json"),
      );
      expect(kilocodeDescriptor.initial?.()).toEqual({});
    });

    it("should patch mcp.MCP_PTB with command array and local type", () => {
      const current = { kiloSetting: "enabled" };
      const patched = kilocodeDescriptor.patch(current, mockContext) as Record<string, any>;

      expect(patched.kiloSetting).toBe("enabled");
      expect(patched.mcp.MCP_PTB).toEqual({
        command: ["node", "C:/Projects/test-project/dist/index.js"],
        type: "local",
      });
    });

    it("should expose MCPClient facade delegating to descriptor", () => {
      expect(kilocodeClient.id).toBe("kilocode");
      expect(kilocodeClient.name).toBe("Kilocode");
      expect(kilocodeClient.configPath()).toBe(kilocodeDescriptor.resolveConfigPath());
      expect(resolveDescriptorFormat(kilocodeDescriptor)).toBe("mcp");
    });
  });

  describe("triangulation: stale keys, normalization, and edge error handling", () => {
    it("should clean stale mcpServers.MCP_PTB or servers.MCP_PTB prior to local array patch", () => {
      const currentWithStale = {
        mcpServers: { MCP_PTB: { command: "node", args: ["old.js"] } },
        servers: { MCP_PTB: { command: "node", args: ["old2.js"] } },
        mcp: { other: { command: ["cmd"], type: "local" } },
      };

      const cleaned = removeStaleMcpPtb(currentWithStale);
      const patched = opencodeDescriptor.patch(cleaned, mockContext) as Record<string, any>;

      expect(patched.mcpServers?.MCP_PTB).toBeUndefined();
      expect(patched.servers?.MCP_PTB).toBeUndefined();
      expect(patched.mcp.other).toEqual({ command: ["cmd"], type: "local" });
      expect(patched.mcp.MCP_PTB).toEqual({
        command: ["node", "C:/Projects/test-project/dist/index.js"],
        type: "local",
      });
    });

    it("should normalize backslashes in scriptPath for command array", () => {
      const windowsBackslashContext = {
        projectPath: "D:\\Workspace\\agent",
        scriptPath: "D:/Workspace/agent/dist/index.js",
      };

      const patched = kilocodeDescriptor.patch({}, windowsBackslashContext) as Record<string, any>;
      expect(patched.mcp.MCP_PTB.command[1]).toBe("D:/Workspace/agent/dist/index.js");
      expect(patched.mcp.MCP_PTB.command[1]).not.toContain("\\");
    });

    it("should return error without unhandled exception when OpenCode config file does not exist", async () => {
      const nonExistentPath = join(testDir, "does-not-exist.json");
      const client = injectClient(
        createLocalMcpDescriptor({
          id: "opencode-missing-test",
          name: "OpenCode Missing Test",
          resolveConfigPath: () => nonExistentPath,
        }),
      );

      const result = await client.inject("/workspace/project");
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain("No existe el archivo de configuración");
    });

    it("should return error without unhandled exception when config file contains malformed JSON", async () => {
      const malformedPath = join(testDir, "malformed.json");
      writeFileSync(malformedPath, "{ invalid json content", "utf-8");

      const client = injectClient(
        createLocalMcpDescriptor({
          id: "opencode-malformed-test",
          name: "OpenCode Malformed Test",
          resolveConfigPath: () => malformedPath,
        }),
      );

      const result = await client.inject("/workspace/project");
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should successfully initialize and inject into a missing file for Kilocode allowMissing descriptor", async () => {
      const missingConfigPath = join(testDir, "sub", "kilo-config.json");
      const client = injectClient(
        createLocalMcpDescriptor({
          id: "kilocode-missing-ok-test",
          name: "Kilocode Missing OK Test",
          resolveConfigPath: () => missingConfigPath,
          allowMissing: true,
        }),
      );

      const result = await client.inject("/workspace/project");
      expect(result.success).toBe(true);
      expect(existsSync(missingConfigPath)).toBe(true);

      const parsed = JSON.parse(readFileSync(missingConfigPath, "utf-8"));
      expect(parsed.mcp.MCP_PTB).toEqual({
        command: ["node", "/workspace/project/dist/index.js"],
        type: "local",
      });
    });

    it("should return error without unhandled exception when verification fails", async () => {
      const configPath = join(testDir, "verify-fail.json");
      writeFileSync(configPath, JSON.stringify({ mcp: {} }), "utf-8");

      const descriptor = {
        ...createLocalMcpDescriptor({
          id: "verify-fail-client",
          name: "Verify Fail Client",
          resolveConfigPath: () => configPath,
        }),
        verify: () => false,
      };

      const client = injectClient(descriptor);
      const result = await client.inject("/workspace/project");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Verificación fallida");
    });
  });
});
