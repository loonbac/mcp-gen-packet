import { describe, it, expect } from "vitest";
import { removeStaleMcpPtb } from "../../../src/tui/engine/remove-stale-mcp-ptb.js";

describe("removeStaleMcpPtb", () => {
  it("removes MCP_PTB from mcp, mcpServers, and servers containers", () => {
    const input = {
      mcp: { MCP_PTB: { command: "node", args: ["/old"] }, otherTool: { command: "python" } },
      mcpServers: { MCP_PTB: { command: "node" }, existingServer: { command: "go" } },
      servers: { MCP_PTB: { cwd: "/stale" }, keepServer: { cwd: "/keep" } },
    };

    const result = removeStaleMcpPtb(input);

    expect(result.mcp).toEqual({ otherTool: { command: "python" } });
    expect(result.mcpServers).toEqual({ existingServer: { command: "go" } });
    expect(result.servers).toEqual({ keepServer: { cwd: "/keep" } });
    expect((result.mcp as Record<string, unknown>).MCP_PTB).toBeUndefined();
    expect((result.mcpServers as Record<string, unknown>).MCP_PTB).toBeUndefined();
    expect((result.servers as Record<string, unknown>).MCP_PTB).toBeUndefined();
  });

  it("retains sibling keys across containers and top-level root", () => {
    const input = {
      version: "1.0.0",
      description: "Sample project config",
      mcpServers: {
        MCP_PTB: { command: "node" },
        siblingOne: { command: "npx" },
        siblingTwo: { command: "uvx" },
      },
      unrelated: [1, 2, 3],
    };

    const result = removeStaleMcpPtb(input);

    expect(result.version).toBe("1.0.0");
    expect(result.description).toBe("Sample project config");
    expect(result.unrelated).toEqual([1, 2, 3]);
    expect(result.mcpServers).toEqual({
      siblingOne: { command: "npx" },
      siblingTwo: { command: "uvx" },
    });
  });

  it("handles falsy, null, or empty stale entries cleanly", () => {
    const input = {
      mcp: { MCP_PTB: null },
      mcpServers: { MCP_PTB: undefined },
      servers: { MCP_PTB: "" },
    };

    const result = removeStaleMcpPtb(input);

    expect(result.mcp).toEqual({});
    expect(result.mcpServers).toEqual({});
    expect(result.servers).toEqual({});
    expect("MCP_PTB" in (result.mcp as object)).toBe(false);
    expect("MCP_PTB" in (result.mcpServers as object)).toBe(false);
    expect("MCP_PTB" in (result.servers as object)).toBe(false);
  });

  it("does not mutate input objects (pure immutability)", () => {
    const input = {
      mcpServers: {
        MCP_PTB: { command: "node" },
        sibling: { command: "rust" },
      },
    };

    const frozenInput = Object.freeze({
      mcpServers: Object.freeze({
        MCP_PTB: Object.freeze({ command: "node" }),
        sibling: Object.freeze({ command: "rust" }),
      }),
    });

    const result = removeStaleMcpPtb(frozenInput);

    expect(result).not.toBe(frozenInput);
    expect(result.mcpServers).not.toBe(frozenInput.mcpServers);
    expect((result.mcpServers as Record<string, unknown>).MCP_PTB).toBeUndefined();
    expect((result.mcpServers as Record<string, unknown>).sibling).toEqual({ command: "rust" });
    // Verify original object still has MCP_PTB
    expect(frozenInput.mcpServers.MCP_PTB).toBeDefined();
  });

  it("handles empty or missing containers without throwing or creating them", () => {
    const emptyInput = {};
    const resultEmpty = removeStaleMcpPtb(emptyInput);
    expect(resultEmpty).toEqual({});
    expect("mcp" in resultEmpty).toBe(false);
    expect("mcpServers" in resultEmpty).toBe(false);
    expect("servers" in resultEmpty).toBe(false);

    const inputWithEmptyContainer = { mcpServers: {} };
    const resultWithEmpty = removeStaleMcpPtb(inputWithEmptyContainer);
    expect(resultWithEmpty.mcpServers).toEqual({});

    const inputWithNonObjectContainer = { mcpServers: "not-an-object", mcp: null };
    const resultWithNonObject = removeStaleMcpPtb(inputWithNonObjectContainer as unknown as Record<string, unknown>);
    expect(resultWithNonObject.mcpServers).toBe("not-an-object");
    expect(resultWithNonObject.mcp).toBeNull();
  });
});
