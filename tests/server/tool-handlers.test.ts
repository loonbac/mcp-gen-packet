import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import type { BridgeAdapter } from "../../src/bridge/adapter.js";
import type { ToolResult } from "../../src/types/protocol.js";
import { allTools, type Tool } from "../../src/tools/index.js";
import { extractInputSchema } from "../../src/server/handlers/tools/extract-input-schema.js";
import { formatToolResult } from "../../src/server/handlers/tools/format-tool-result.js";
import { formatToolError } from "../../src/server/handlers/tools/format-tool-error.js";
import { createToolHandler } from "../../src/server/handlers/tools/create-tool-handler.js";
import { registerTools } from "../../src/server/handlers/tools/register-tools.js";
import { createMcpServer, startServer } from "../../src/server.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as bridgeModule from "../../src/bridge/index.js";

describe("S5d: MCP Tool Handlers & Server Composition Root", () => {
  const mockBridge: BridgeAdapter = {
    execute: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
    getMode: vi.fn().mockReturnValue("live"),
    start: vi.fn(),
    stop: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Phase S5d.1: extractInputSchema", () => {
    it("extracts .shape from tool.inputSchema as a ZodRawShape", () => {
      const sampleTool = allTools.find((t) => t.name === "packet_tracer_add_device");
      expect(sampleTool).toBeDefined();

      const shape = extractInputSchema(sampleTool!);
      expect(shape).toBeDefined();
      expect(typeof shape).toBe("object");
      expect(shape).toHaveProperty("model");
      expect(shape).toHaveProperty("name");
      expect(shape).toHaveProperty("x");
      expect(shape).toHaveProperty("y");
    });

    it("works for any tool with a ZodObject inputSchema", () => {
      for (const tool of allTools) {
        const shape = extractInputSchema(tool);
        expect(shape).toBeDefined();
        expect(typeof shape).toBe("object");
      }
    });

    it("extracts custom ZodObject shape correctly", () => {
      const customTool: Tool = {
        name: "custom_tool",
        description: "Custom test tool",
        inputSchema: z.object({
          paramA: z.string(),
          paramB: z.number(),
        }),
        execute: vi.fn(),
      };

      const shape = extractInputSchema(customTool);
      expect(shape).toHaveProperty("paramA");
      expect(shape).toHaveProperty("paramB");
    });
  });

  describe("Phase S5d.1: formatToolResult", () => {
    it("formats live/data result as { content: [{ type: 'text', text: JSON.stringify({ mode, data }) }] } without isError", () => {
      const liveResult: ToolResult = {
        mode: "live",
        data: { success: true, id: "R1" },
      };

      const formatted = formatToolResult(liveResult);
      expect(formatted).toEqual({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              mode: "live",
              data: { success: true, id: "R1" },
            }),
          },
        ],
      });
      expect(formatted).not.toHaveProperty("isError");
    });

    it("formats script mode with non-empty code as { content: [{ type: 'text', text: JSON.stringify({ mode, script }) }] } without isError", () => {
      const scriptResult: ToolResult = {
        mode: "script",
        data: null,
        code: "var dev = pt.addDevice('2911', 'R1', 100, 100);",
      };

      const formatted = formatToolResult(scriptResult);
      expect(formatted).toEqual({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              mode: "script",
              script: "var dev = pt.addDevice('2911', 'R1', 100, 100);",
            }),
          },
        ],
      });
      expect(formatted).not.toHaveProperty("isError");
    });

    it("formats script mode without code as data mode fallback", () => {
      const scriptNoCode: ToolResult = {
        mode: "script",
        data: { generated: true },
      };

      const formatted = formatToolResult(scriptNoCode);
      expect(formatted).toEqual({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              mode: "script",
              data: { generated: true },
            }),
          },
        ],
      });
      expect(formatted).not.toHaveProperty("isError");
    });
  });

  describe("Phase S5d.1: formatToolError", () => {
    it("formats Error instances into { content: [{ type: 'text', text: JSON.stringify({ error: message }) }], isError: true }", () => {
      const err = new Error("Device 'R1' already exists");
      const formatted = formatToolError(err);

      expect(formatted).toEqual({
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "Device 'R1' already exists" }),
          },
        ],
        isError: true,
      });
    });

    it("formats non-Error string primitives safely", () => {
      const formatted = formatToolError("Socket timeout on port 54321");

      expect(formatted).toEqual({
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "Socket timeout on port 54321" }),
          },
        ],
        isError: true,
      });
    });

    it("formats arbitrary non-Error objects safely", () => {
      const formatted = formatToolError({ code: "ECONNREFUSED" });

      expect(formatted).toEqual({
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "[object Object]" }),
          },
        ],
        isError: true,
      });
    });
  });

  describe("Phase S5d.3: createToolHandler", () => {
    it("executes tool.execute(bridge, args) and returns formatted result on success", async () => {
      const mockExecute = vi.fn().mockResolvedValue({
        mode: "live",
        data: { deviceId: "R1", created: true },
      });
      const dummyTool: Tool = {
        name: "test_tool",
        description: "Test tool",
        inputSchema: z.object({ name: z.string() }),
        execute: mockExecute,
      };

      const handler = createToolHandler(dummyTool, mockBridge);
      const result = await handler({ name: "R1" });

      expect(mockExecute).toHaveBeenCalledWith(mockBridge, { name: "R1" });
      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              mode: "live",
              data: { deviceId: "R1", created: true },
            }),
          },
        ],
      });
      expect(result).not.toHaveProperty("isError");
    });

    it("formats script mode code results from tool execution", async () => {
      const mockExecute = vi.fn().mockResolvedValue({
        mode: "script",
        data: null,
        code: "pt.addDevice('2911');",
      });
      const dummyTool: Tool = {
        name: "script_tool",
        description: "Script tool",
        inputSchema: z.object({}),
        execute: mockExecute,
      };

      const handler = createToolHandler(dummyTool, mockBridge);
      const result = await handler({});

      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              mode: "script",
              script: "pt.addDevice('2911');",
            }),
          },
        ],
      });
    });

    it("catches synchronous throws returning formatted error with isError: true without unhandled rejections", async () => {
      const dummyTool: Tool = {
        name: "throwing_tool",
        description: "Throws sync error",
        inputSchema: z.object({}),
        execute: () => {
          throw new Error("Synchronous explosion");
        },
      };

      const handler = createToolHandler(dummyTool, mockBridge);
      const result = await handler({});

      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "Synchronous explosion" }),
          },
        ],
        isError: true,
      });
    });

    it("catches promise rejections returning formatted error with isError: true without unhandled rejections", async () => {
      const dummyTool: Tool = {
        name: "rejecting_tool",
        description: "Rejects promise",
        inputSchema: z.object({}),
        execute: vi.fn().mockRejectedValue(new Error("Network bridge timeout")),
      };

      const handler = createToolHandler(dummyTool, mockBridge);
      const result = await handler({});

      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "Network bridge timeout" }),
          },
        ],
        isError: true,
      });
    });
  });

  describe("Phase S5d.3: registerTools", () => {
    it("binds all tools via server.tool(name, description, schema, handler)", () => {
      const dummyServer = {
        tool: vi.fn(),
      } as unknown as McpServer;

      registerTools(dummyServer, mockBridge);

      expect(dummyServer.tool).toHaveBeenCalledTimes(allTools.length);
      expect(dummyServer.tool).toHaveBeenCalledTimes(9);

      for (const tool of allTools) {
        expect(dummyServer.tool).toHaveBeenCalledWith(
          tool.name,
          tool.description,
          expect.any(Object),
          expect.any(Function),
        );
      }
    });

    it("accepts custom tool arrays for isolation and testing", () => {
      const dummyServer = {
        tool: vi.fn(),
      } as unknown as McpServer;

      const customTool: Tool = {
        name: "isolated_tool",
        description: "Isolated test tool",
        inputSchema: z.object({ x: z.number() }),
        execute: vi.fn(),
      };

      registerTools(dummyServer, mockBridge, [customTool]);

      expect(dummyServer.tool).toHaveBeenCalledTimes(1);
      expect(dummyServer.tool).toHaveBeenCalledWith(
        "isolated_tool",
        "Isolated test tool",
        expect.objectContaining({ x: expect.anything() }),
        expect.any(Function),
      );
    });
  });

  describe("Phase S5d.5: Server Composition Root & Bridge Injection", () => {
    it("createMcpServer(bridgeOverride) uses supplied bridge without creating default bridge", () => {
      const createBridgeSpy = vi.spyOn(bridgeModule, "createBridge");

      const server = createMcpServer(mockBridge);
      expect(server).toBeInstanceOf(McpServer);
      expect(createBridgeSpy).not.toHaveBeenCalled();

      createBridgeSpy.mockRestore();
    });

    it("createMcpServer() without override creates bridge on port 54321", () => {
      const createBridgeSpy = vi.spyOn(bridgeModule, "createBridge").mockReturnValue(mockBridge);

      const server = createMcpServer();
      expect(server).toBeInstanceOf(McpServer);
      expect(createBridgeSpy).toHaveBeenCalledWith(54321);

      createBridgeSpy.mockRestore();
    });

    it("startServer() binds stdio transport, logs diagnostics, and connects", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const connectMock = vi.fn().mockResolvedValue(undefined);

      vi.spyOn(bridgeModule, "createBridge").mockReturnValue(mockBridge);

      // Create a spy on McpServer.prototype.connect
      const origConnect = McpServer.prototype.connect;
      McpServer.prototype.connect = connectMock;

      try {
        await startServer();

        expect(connectMock).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith("[server] Starting MCP-PTB server...");
        expect(consoleErrorSpy).toHaveBeenCalledWith("[server] HTTP bridge listening on localhost:54321");
        expect(consoleErrorSpy).toHaveBeenCalledWith("[server] MCP-PTB server started");
      } finally {
        McpServer.prototype.connect = origConnect;
        consoleErrorSpy.mockRestore();
        vi.restoreAllMocks();
      }
    });
  });
});
