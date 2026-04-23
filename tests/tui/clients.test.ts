import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

describe("MCP Client Adapters", () => {
  const mockProjectPath = "/test/project";

  describe("opencodeClient", () => {
    it("should detect when config exists", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const { opencodeClient } = await import("../../src/tui/clients/opencode.js");

      expect(opencodeClient.detect()).toBe(true);
    });

    it("should not detect when config missing", async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      const { opencodeClient } = await import("../../src/tui/clients/opencode.js");

      expect(opencodeClient.detect()).toBe(false);
    });

    it("should inject config successfully", async () => {
      const mockConfig = { mcpServers: {} };
      vi.mocked(existsSync).mockReturnValue(true);
      // Sequential reads: first returns original config, second (verify) returns updated config
      vi.mocked(readFileSync)
        .mockReturnValueOnce(JSON.stringify(mockConfig))
        .mockReturnValueOnce(JSON.stringify({ ...mockConfig, mcp: { MCP_PTB: { command: ["node", "/test/project/dist/index.js"], type: "local" } } }));
      vi.mocked(writeFileSync).mockReturnValue(undefined);

      const { opencodeClient } = await import("../../src/tui/clients/opencode.js");
      const result = await opencodeClient.inject(mockProjectPath);

      expect(result.success).toBe(true);
      expect(writeFileSync).toHaveBeenCalled();
    });

    it("should handle inject failure", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation(() => { throw new Error("Read error"); });

      const { opencodeClient } = await import("../../src/tui/clients/opencode.js");
      const result = await opencodeClient.inject(mockProjectPath);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("claudeClient", () => {
    it("should detect when config exists", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(mkdirSync).mockReturnValue(undefined);
      const { claudeClient } = await import("../../src/tui/clients/claude.js");

      expect(claudeClient.detect()).toBe(true);
    });

    it("should not detect when config missing", async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      const { claudeClient } = await import("../../src/tui/clients/claude.js");

      expect(claudeClient.detect()).toBe(false);
    });

    it("should inject config to separate file", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      // Sequential reads: first returns empty config (claude doesn't read existing), then verify
      vi.mocked(readFileSync)
        .mockReturnValueOnce(JSON.stringify({}))
        .mockReturnValueOnce(JSON.stringify({ command: "node", args: ["/test/project/dist/index.js"] }));
      vi.mocked(writeFileSync).mockReturnValue(undefined);
      vi.mocked(mkdirSync).mockReturnValue(undefined);

      const { claudeClient } = await import("../../src/tui/clients/claude.js");
      const result = await claudeClient.inject(mockProjectPath);

      expect(result.success).toBe(true);
    });
  });

  describe("cursorClient", () => {
    it("should detect when config exists", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const { cursorClient } = await import("../../src/tui/clients/cursor.js");

      expect(cursorClient.detect()).toBe(true);
    });

    it("should inject config successfully", async () => {
      const mockConfig = { mcpServers: {} };
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync)
        .mockReturnValueOnce(JSON.stringify(mockConfig))
        .mockReturnValueOnce(JSON.stringify({ ...mockConfig, mcpServers: { MCP_PTB: { command: "node", args: ["/test/project/dist/index.js"] } } }));
      vi.mocked(writeFileSync).mockReturnValue(undefined);

      const { cursorClient } = await import("../../src/tui/clients/cursor.js");
      const result = await cursorClient.inject(mockProjectPath);

      expect(result.success).toBe(true);
    });
  });

  describe("vscodeClient", () => {
    it("should detect when config exists", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const { vscodeClient } = await import("../../src/tui/clients/vscode.js");

      expect(vscodeClient.detect()).toBe(true);
    });

    it("should inject using 'servers' key for VS Code", async () => {
      const mockConfig = { servers: {} };
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync)
        .mockReturnValueOnce(JSON.stringify(mockConfig))
        .mockReturnValueOnce(JSON.stringify({ ...mockConfig, servers: { MCP_PTB: { command: "node", args: ["/test/project/dist/index.js"], cwd: mockProjectPath } } }));
      vi.mocked(writeFileSync).mockReturnValue(undefined);

      const { vscodeClient } = await import("../../src/tui/clients/vscode.js");
      const result = await vscodeClient.inject(mockProjectPath);

      expect(result.success).toBe(true);
      expect(writeFileSync).toHaveBeenCalled();
    });
  });

  describe("geminiClient", () => {
    it("should detect when config exists", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const { geminiClient } = await import("../../src/tui/clients/gemini.js");

      expect(geminiClient.detect()).toBe(true);
    });

    it("should inject config successfully", async () => {
      const mockConfig = { mcpServers: {} };
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync)
        .mockReturnValueOnce(JSON.stringify(mockConfig))
        .mockReturnValueOnce(JSON.stringify({ ...mockConfig, mcpServers: { MCP_PTB: { command: "node", args: ["/test/project/dist/index.js"] } } }));
      vi.mocked(writeFileSync).mockReturnValue(undefined);

      const { geminiClient } = await import("../../src/tui/clients/gemini.js");
      const result = await geminiClient.inject(mockProjectPath);

      expect(result.success).toBe(true);
    });
  });

  describe("codexClient", () => {
    it("should detect when config exists", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const { codexClient } = await import("../../src/tui/clients/codex.js");

      expect(codexClient.detect()).toBe(true);
    });

    it("should inject config successfully", async () => {
      const mockConfig = {};
      vi.mocked(existsSync).mockReturnValue(true);
      // First read is empty, second read (verify) is the TOML output
      const writtenToml = `mcp = "[object Object]"
`;
      vi.mocked(readFileSync)
        .mockReturnValueOnce("")
        .mockReturnValueOnce(writtenToml);
      vi.mocked(writeFileSync).mockReturnValue(undefined);

      const { codexClient } = await import("../../src/tui/clients/codex.js");
      const result = await codexClient.inject(mockProjectPath);

      expect(result.success).toBe(true);
    });
  });

  describe("windsurfClient", () => {
    it("should detect when config exists", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const { windsurfClient } = await import("../../src/tui/clients/windsurf.js");

      expect(windsurfClient.detect()).toBe(true);
    });

    it("should inject config successfully", async () => {
      const mockConfig = { mcpServers: {} };
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync)
        .mockReturnValueOnce(JSON.stringify(mockConfig))
        .mockReturnValueOnce(JSON.stringify({ ...mockConfig, mcpServers: { MCP_PTB: { command: "node", args: ["/test/project/dist/index.js"] } } }));
      vi.mocked(writeFileSync).mockReturnValue(undefined);

      const { windsurfClient } = await import("../../src/tui/clients/windsurf.js");
      const result = await windsurfClient.inject(mockProjectPath);

      expect(result.success).toBe(true);
    });
  });

  describe("kilocodeClient", () => {
    it("should detect when config exists", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const { kilocodeClient } = await import("../../src/tui/clients/kilocode.js");

      expect(kilocodeClient.detect()).toBe(true);
    });

    it("should inject config successfully", async () => {
      const mockConfig = {};
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync)
        .mockReturnValueOnce(JSON.stringify(mockConfig))
        .mockReturnValueOnce(JSON.stringify({ mcp: { MCP_PTB: { command: ["node", "/test/project/dist/index.js"], type: "local" } } }));
      vi.mocked(writeFileSync).mockReturnValue(undefined);

      const { kilocodeClient } = await import("../../src/tui/clients/kilocode.js");
      const result = await kilocodeClient.inject(mockProjectPath);

      expect(result.success).toBe(true);
    });
  });

  describe("kimiClient", () => {
    it("should detect when config exists", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const { kimiClient } = await import("../../src/tui/clients/kimi.js");

      expect(kimiClient.detect()).toBe(true);
    });

    it("should inject config successfully", async () => {
      const mockConfig = { mcpServers: {} };
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync)
        .mockReturnValueOnce(JSON.stringify(mockConfig))
        .mockReturnValueOnce(JSON.stringify({ ...mockConfig, mcpServers: { MCP_PTB: { command: "node", args: ["/test/project/dist/index.js"] } } }));
      vi.mocked(writeFileSync).mockReturnValue(undefined);

      const { kimiClient } = await import("../../src/tui/clients/kimi.js");
      const result = await kimiClient.inject(mockProjectPath);

      expect(result.success).toBe(true);
    });
  });

  describe("kiroClient", () => {
    it("should detect when config exists", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const { kiroClient } = await import("../../src/tui/clients/kiro.js");

      expect(kiroClient.detect()).toBe(true);
    });

    it("should inject config successfully", async () => {
      const mockConfig = { mcpServers: {} };
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync)
        .mockReturnValueOnce(JSON.stringify(mockConfig))
        .mockReturnValueOnce(JSON.stringify({ ...mockConfig, mcpServers: { MCP_PTB: { command: "node", args: ["/test/project/dist/index.js"] } } }));
      vi.mocked(writeFileSync).mockReturnValue(undefined);

      const { kiroClient } = await import("../../src/tui/clients/kiro.js");
      const result = await kiroClient.inject(mockProjectPath);

      expect(result.success).toBe(true);
    });
  });

  describe("qwenClient", () => {
    it("should detect when config exists", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const { qwenClient } = await import("../../src/tui/clients/qwen.js");

      expect(qwenClient.detect()).toBe(true);
    });

    it("should inject config successfully", async () => {
      const mockConfig = { mcpServers: {} };
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync)
        .mockReturnValueOnce(JSON.stringify(mockConfig))
        .mockReturnValueOnce(JSON.stringify({ ...mockConfig, mcpServers: { MCP_PTB: { command: "node", args: ["/test/project/dist/index.js"] } } }));
      vi.mocked(writeFileSync).mockReturnValue(undefined);

      const { qwenClient } = await import("../../src/tui/clients/qwen.js");
      const result = await qwenClient.inject(mockProjectPath);

      expect(result.success).toBe(true);
    });
  });

  describe("antigravityClient", () => {
    it("should detect when config exists", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const { antigravityClient } = await import("../../src/tui/clients/antigravity.js");

      expect(antigravityClient.detect()).toBe(true);
    });

    it("should inject config successfully", async () => {
      const mockConfig = { mcpServers: {} };
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync)
        .mockReturnValueOnce(JSON.stringify(mockConfig))
        .mockReturnValueOnce(JSON.stringify({ ...mockConfig, mcpServers: { MCP_PTB: { command: "node", args: ["/test/project/dist/index.js"] } } }));
      vi.mocked(writeFileSync).mockReturnValue(undefined);

      const { antigravityClient } = await import("../../src/tui/clients/antigravity.js");
      const result = await antigravityClient.inject(mockProjectPath);

      expect(result.success).toBe(true);
    });
  });

  describe("getAvailableClients", () => {
    it("should return only detected clients", async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      const { getAvailableClients } = await import("../../src/tui/clients/index.js");

      const available = getAvailableClients();
      expect(Array.isArray(available)).toBe(true);
    });

    it("should return all clients when all configs exist", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const { getAvailableClients, ALL_CLIENTS } = await import("../../src/tui/clients/index.js");

      const available = getAvailableClients();
      expect(available.length).toBe(ALL_CLIENTS.length);
    });
  });
});
