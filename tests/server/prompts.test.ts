import { describe, it, expect, vi } from "vitest";
import { ZodError } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ANALYZE_TRACE_PROMPT_NAME,
  ANALYZE_TRACE_PROMPT_DESCRIPTION,
  ExplainTraceInputSchema,
  analyzeTraceArgsShape,
  analyzeTracePromptDefinition,
  promptDefinitions,
  getPrompt,
} from "../../src/server/handlers/prompts/analyze-trace-prompt.js";
import { registerPrompts } from "../../src/server/handlers/prompts/register-prompts.js";
import { createMcpServer } from "../../src/server.js";
import type { BridgeAdapter } from "../../src/bridge/adapter.js";

describe("Prompts Handler & Registration", () => {
  describe("Definición expuesta", () => {
    it("exports canonical prompt name and description", () => {
      expect(ANALYZE_TRACE_PROMPT_NAME).toBe("analyze_trace");
      expect(ANALYZE_TRACE_PROMPT_DESCRIPTION).toBe(
        "Genera una guía para interpretar una salida de traceroute.",
      );
    });

    it("exports promptDefinitions containing analyze_trace with proper schema metadata", () => {
      expect(Array.isArray(promptDefinitions)).toBe(true);
      expect(promptDefinitions).toHaveLength(1);

      const def = promptDefinitions[0];
      expect(def.name).toBe("analyze_trace");
      expect(def.description).toBe(
        "Genera una guía para interpretar una salida de traceroute.",
      );
      expect(def.arguments).toEqual([
        {
          name: "traceOutput",
          description: "Salida textual del traceroute",
          required: true,
        },
      ]);
      expect(analyzeTracePromptDefinition).toBe(def);
    });

    it("exports analyzeTraceArgsShape compatible with McpServer prompt registration", () => {
      expect(analyzeTraceArgsShape).toBeDefined();
      expect(typeof analyzeTraceArgsShape).toBe("object");
      expect(analyzeTraceArgsShape).toHaveProperty("traceOutput");
    });

    it("ExplainTraceInputSchema validates non-empty traceOutput and rejects empty/missing", () => {
      expect(
        ExplainTraceInputSchema.parse({ traceOutput: "1  192.168.1.1  1ms" }),
      ).toEqual({
        traceOutput: "1  192.168.1.1  1ms",
      });

      expect(() => ExplainTraceInputSchema.parse({})).toThrow(ZodError);
      expect(() => ExplainTraceInputSchema.parse({ traceOutput: "" })).toThrow(
        ZodError,
      );
      expect(() => ExplainTraceInputSchema.parse(null)).toThrow(ZodError);
    });
  });

  describe("getPrompt válido", () => {
    it("returns formatted prompt guide with user role and text content", () => {
      const trace = "1  10.0.0.1  0.8 ms\n2  10.0.0.2  1.5 ms";
      const result = getPrompt("analyze_trace", { traceOutput: trace });

      expect(result).toEqual({
        description: "Prompt para análisis de traceroute",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Analiza esta traza de red y explica posibles cuellos de botella:\n\n${trace}`,
            },
          },
        ],
      });
    });

    it("throws ZodError when traceOutput argument is empty or missing", () => {
      expect(() => getPrompt("analyze_trace", {})).toThrow(ZodError);
      expect(() => getPrompt("analyze_trace", { traceOutput: "" })).toThrow(
        ZodError,
      );
      expect(() => getPrompt("analyze_trace", null)).toThrow(ZodError);
    });
  });

  describe("Rechazo de prompt desconocido", () => {
    it("throws expected error on unknown prompt name", () => {
      expect(() => getPrompt("unknown_prompt", {})).toThrow(
        "Prompt no soportado: unknown_prompt",
      );
      expect(() => getPrompt("configure_device", {})).toThrow(
        "Prompt no soportado: configure_device",
      );
    });
  });

  describe("Registro en servidor dummy y servidor real", () => {
    it("registers analyze_trace on a dummy McpServer via server.prompt", () => {
      const mockPrompt = vi.fn();
      const dummyServer = {
        prompt: mockPrompt,
      } as unknown as McpServer;

      registerPrompts(dummyServer);

      expect(mockPrompt).toHaveBeenCalledTimes(1);
      expect(mockPrompt).toHaveBeenCalledWith(
        "analyze_trace",
        "Genera una guía para interpretar una salida de traceroute.",
        analyzeTraceArgsShape,
        expect.any(Function),
      );

      // Verify the registered callback delegates correctly to getPrompt
      const callback = mockPrompt.mock.calls[0][3];
      const result = callback({ traceOutput: "1  10.0.0.1  1ms" });
      expect(result).toEqual({
        description: "Prompt para análisis de traceroute",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: "Analiza esta traza de red y explica posibles cuellos de botella:\n\n1  10.0.0.1  1ms",
            },
          },
        ],
      });
    });

    it("registers cleanly on a real McpServer instance without error", () => {
      const realServer = new McpServer({
        name: "test-server",
        version: "1.0.0",
      });

      expect(() => registerPrompts(realServer)).not.toThrow();
    });

    it("createMcpServer integrates prompt registration without breaking resources or tools", () => {
      const mockBridge: BridgeAdapter = {
        execute: vi.fn(),
        isConnected: vi.fn().mockReturnValue(true),
        getMode: vi.fn().mockReturnValue("live"),
        start: vi.fn(),
        stop: vi.fn(),
      };

      const server = createMcpServer(mockBridge);
      expect(server).toBeInstanceOf(McpServer);
    });
  });
});
