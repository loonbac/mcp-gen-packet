import { describe, it, expect } from "vitest";
import { homedir } from "node:os";
import { join } from "node:path";
import { cursorDescriptor, cursorClient } from "../../../src/tui/clients/cursor.js";
import { geminiDescriptor, geminiClient } from "../../../src/tui/clients/gemini.js";
import { windsurfDescriptor, windsurfClient } from "../../../src/tui/clients/windsurf.js";
import { kimiDescriptor, kimiClient } from "../../../src/tui/clients/kimi.js";

describe("Batch 1 MCP Client Descriptors (Cursor, Gemini, Windsurf, Kimi)", () => {
  const home = homedir();
  const mockContext = {
    projectPath: "C:/Projects/test-project",
    scriptPath: "C:/Projects/test-project/dist/index.js",
  };

  describe("metadata and path resolution", () => {
    it("should resolve correct metadata and config path for Cursor", () => {
      expect(cursorDescriptor.id).toBe("cursor");
      expect(cursorDescriptor.name).toBe("Cursor");
      expect(cursorDescriptor.format).toBe("mcpServers");
      expect(cursorDescriptor.resolveConfigPath()).toBe(join(home, ".cursor", "mcp.json"));
      expect(cursorDescriptor.initial).toBeUndefined();
    });

    it("should resolve correct metadata and config path for Gemini", () => {
      expect(geminiDescriptor.id).toBe("gemini");
      expect(geminiDescriptor.name).toBe("Gemini CLI");
      expect(geminiDescriptor.format).toBe("mcpServers");
      expect(geminiDescriptor.resolveConfigPath()).toBe(join(home, ".gemini", "settings.json"));
      expect(geminiDescriptor.initial).toBeUndefined();
    });

    it("should resolve correct metadata, config path, and initial state for Windsurf", () => {
      expect(windsurfDescriptor.id).toBe("windsurf");
      expect(windsurfDescriptor.name).toBe("Windsurf");
      expect(windsurfDescriptor.format).toBe("mcpServers");
      expect(windsurfDescriptor.resolveConfigPath()).toBe(
        join(home, ".codeium", "windsurf", "mcp_config.json"),
      );
      expect(windsurfDescriptor.initial?.()).toEqual({});
    });

    it("should resolve correct metadata, config path, and initial state for Kimi", () => {
      expect(kimiDescriptor.id).toBe("kimi");
      expect(kimiDescriptor.name).toBe("Kimi");
      expect(kimiDescriptor.format).toBe("mcpServers");
      expect(kimiDescriptor.resolveConfigPath()).toBe(join(home, ".kimi", "mcp.json"));
      expect(kimiDescriptor.initial?.()).toEqual({});
    });
  });

  describe("patch transformations and verification predicate", () => {
    const descriptors = [
      { name: "Cursor", descriptor: cursorDescriptor },
      { name: "Gemini", descriptor: geminiDescriptor },
      { name: "Windsurf", descriptor: windsurfDescriptor },
      { name: "Kimi", descriptor: kimiDescriptor },
    ];

    for (const { name, descriptor } of descriptors) {
      it(`should patch mcpServers.MCP_PTB without cwd and preserve siblings for ${name}`, () => {
        const current = {
          existingRoot: 123,
          mcpServers: {
            otherServer: { command: "other", args: [] },
          },
        };

        const patched = descriptor.patch(current, mockContext) as Record<string, any>;

        expect(patched.existingRoot).toBe(123);
        expect(patched.mcpServers.otherServer).toEqual({ command: "other", args: [] });
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
      { name: "Cursor", descriptor: cursorDescriptor },
      { name: "Gemini", descriptor: geminiDescriptor },
      { name: "Windsurf", descriptor: windsurfDescriptor },
      { name: "Kimi", descriptor: kimiDescriptor },
    ];

    for (const { name, descriptor } of descriptors) {
      it(`should create mcpServers container when missing for ${name}`, () => {
        const patched = descriptor.patch({}, mockContext) as Record<string, any>;
        expect(patched.mcpServers).toBeDefined();
        expect(patched.mcpServers.MCP_PTB.command).toBe("node");
        expect(patched.mcpServers.MCP_PTB.args).toEqual(["C:/Projects/test-project/dist/index.js"]);
      });

      it(`should handle forward-slash normalized Windows paths for ${name}`, () => {
        const windowsContext = {
          projectPath: "D:/Repositories/my-agent",
          scriptPath: "D:/Repositories/my-agent/dist/index.js",
        };
        const patched = descriptor.patch({}, windowsContext) as Record<string, any>;
        expect(patched.mcpServers.MCP_PTB.args[0]).toBe("D:/Repositories/my-agent/dist/index.js");
        expect(patched.mcpServers.MCP_PTB.args[0]).not.toContain("\\");
      });
    }
  });

  describe("client facades", () => {
    it("should expose MCPClient properties delegating to descriptor", () => {
      expect(cursorClient.id).toBe("cursor");
      expect(cursorClient.name).toBe("Cursor");
      expect(cursorClient.configPath()).toBe(cursorDescriptor.resolveConfigPath());

      expect(geminiClient.id).toBe("gemini");
      expect(geminiClient.name).toBe("Gemini CLI");
      expect(geminiClient.configPath()).toBe(geminiDescriptor.resolveConfigPath());

      expect(windsurfClient.id).toBe("windsurf");
      expect(windsurfClient.name).toBe("Windsurf");
      expect(windsurfClient.configPath()).toBe(windsurfDescriptor.resolveConfigPath());

      expect(kimiClient.id).toBe("kimi");
      expect(kimiClient.name).toBe("Kimi");
      expect(kimiClient.configPath()).toBe(kimiDescriptor.resolveConfigPath());
    });
  });
});
