import { describe, it, expect } from "vitest";
import { homedir } from "node:os";
import { join } from "node:path";
import { removeStaleMcpPtb } from "../../../src/tui/engine/remove-stale-mcp-ptb.js";
import { kiroDescriptor, kiroClient } from "../../../src/tui/clients/kiro.js";
import { qwenDescriptor, qwenClient } from "../../../src/tui/clients/qwen.js";
import { antigravityDescriptor, antigravityClient } from "../../../src/tui/clients/antigravity.js";

describe("Batch 2 MCP Client Descriptors (Kiro, Qwen, Antigravity)", () => {
  const home = homedir();
  const mockContext = {
    projectPath: "C:/Projects/test-project",
    scriptPath: "C:/Projects/test-project/dist/index.js",
  };

  describe("metadata, path resolution, and initialization policy", () => {
    it("should resolve correct metadata, config path, and initial state for Kiro", () => {
      expect(kiroDescriptor.id).toBe("kiro");
      expect(kiroDescriptor.name).toBe("Kiro IDE");
      expect(kiroDescriptor.format).toBe("mcpServers");
      expect(kiroDescriptor.resolveConfigPath()).toBe(
        join(home, ".kiro", "settings", "mcp.json"),
      );
      expect(kiroDescriptor.initial?.()).toEqual({});
    });

    it("should resolve correct metadata, config path, and initial state for Qwen", () => {
      expect(qwenDescriptor.id).toBe("qwen");
      expect(qwenDescriptor.name).toBe("Qwen Code");
      expect(qwenDescriptor.format).toBe("mcpServers");
      expect(qwenDescriptor.resolveConfigPath()).toBe(
        join(home, ".qwen", "settings.json"),
      );
      expect(qwenDescriptor.initial?.()).toEqual({});
    });

    it("should resolve correct metadata, config path, and initial state for Antigravity", () => {
      expect(antigravityDescriptor.id).toBe("antigravity");
      expect(antigravityDescriptor.name).toBe("Antigravity");
      expect(antigravityDescriptor.format).toBe("mcpServers");
      expect(antigravityDescriptor.resolveConfigPath()).toBe(
        join(home, ".gemini", "antigravity", "mcp_config.json"),
      );
      expect(antigravityDescriptor.initial?.()).toEqual({});
    });
  });

  describe("patch transformations and verification predicate", () => {
    const descriptors = [
      { name: "Kiro", descriptor: kiroDescriptor },
      { name: "Qwen", descriptor: qwenDescriptor },
      { name: "Antigravity", descriptor: antigravityDescriptor },
    ];

    for (const { name, descriptor } of descriptors) {
      it(`should patch mcpServers.MCP_PTB without cwd and preserve siblings for ${name}`, () => {
        const current = {
          existingRoot: 456,
          mcpServers: {
            otherServer: { command: "other-cli", args: ["serve"] },
          },
        };

        const patched = descriptor.patch(current, mockContext) as Record<string, any>;

        expect(patched.existingRoot).toBe(456);
        expect(patched.mcpServers.otherServer).toEqual({
          command: "other-cli",
          args: ["serve"],
        });
        expect(patched.mcpServers.MCP_PTB).toEqual({
          command: "node",
          args: ["C:/Projects/test-project/dist/index.js"],
        });
        expect(patched.mcpServers.MCP_PTB.cwd).toBeUndefined();
      });

      it(`should verify presence of mcpServers.MCP_PTB for ${name}`, () => {
        expect(descriptor.verify?.({ mcpServers: { MCP_PTB: { command: "node" } } })).toBe(true);
        expect(descriptor.verify?.({ mcpServers: {} })).toBe(false);
        expect(descriptor.verify?.({})).toBe(false);
      });
    }
  });

  describe("triangulation: path normalization & edge states", () => {
    const descriptors = [
      { name: "Kiro", descriptor: kiroDescriptor },
      { name: "Qwen", descriptor: qwenDescriptor },
      { name: "Antigravity", descriptor: antigravityDescriptor },
    ];

    for (const { name, descriptor } of descriptors) {
      it(`should create mcpServers container when missing for ${name}`, () => {
        const patched = descriptor.patch({}, mockContext) as Record<string, any>;
        expect(patched.mcpServers).toBeDefined();
        expect(patched.mcpServers.MCP_PTB.command).toBe("node");
        expect(patched.mcpServers.MCP_PTB.args).toEqual([
          "C:/Projects/test-project/dist/index.js",
        ]);
      });

      it(`should preserve existing mcpServers entries when updating ${name}`, () => {
        const initial = {
          mcpServers: {
            existingServer: { command: "python", args: ["server.py"] },
          },
        };

        const patched = descriptor.patch(initial, mockContext) as Record<string, any>;
        expect(patched.mcpServers.existingServer).toEqual({
          command: "python",
          args: ["server.py"],
        });
        expect(patched.mcpServers.MCP_PTB).toBeDefined();
      });
    }
  });

  describe("triangulation: stale key removal", () => {
    const descriptors = [
      { name: "Kiro", descriptor: kiroDescriptor },
      { name: "Qwen", descriptor: qwenDescriptor },
      { name: "Antigravity", descriptor: antigravityDescriptor },
    ];

    for (const { name, descriptor } of descriptors) {
      it(`should purge stale servers.MCP_PTB and mcp.MCP_PTB prior to injection for ${name}`, () => {
        const contaminated = {
          mcp: {
            MCP_PTB: { command: "old-mcp" },
            otherMcp: { active: true },
          },
          servers: {
            MCP_PTB: { command: "old-servers" },
            otherServer: { active: true },
          },
          mcpServers: {
            MCP_PTB: { command: "old-mcp-server" },
            otherMcpServer: { active: true },
          },
        };

        const cleaned = removeStaleMcpPtb(contaminated);
        const patched = descriptor.patch(cleaned, mockContext) as Record<string, any>;

        expect(patched.mcp?.MCP_PTB).toBeUndefined();
        expect(patched.mcp?.otherMcp).toEqual({ active: true });
        expect(patched.servers?.MCP_PTB).toBeUndefined();
        expect(patched.servers?.otherServer).toEqual({ active: true });
        expect(patched.mcpServers.otherMcpServer).toEqual({ active: true });
        expect(patched.mcpServers.MCP_PTB).toEqual({
          command: "node",
          args: ["C:/Projects/test-project/dist/index.js"],
        });
      });
    }
  });

  describe("facade delegation to injectClient", () => {
    const clients = [
      { name: "Kiro", client: kiroClient, id: "kiro", expectedName: "Kiro IDE" },
      { name: "Qwen", client: qwenClient, id: "qwen", expectedName: "Qwen Code" },
      { name: "Antigravity", client: antigravityClient, id: "antigravity", expectedName: "Antigravity" },
    ];

    for (const { name, client, id, expectedName } of clients) {
      it(`should expose standard MCPClient interface for ${name}`, () => {
        expect(client.id).toBe(id);
        expect(client.name).toBe(expectedName);
        expect(typeof client.detect).toBe("function");
        expect(typeof client.configPath).toBe("function");
        expect(typeof client.inject).toBe("function");
      });
    }
  });
});
