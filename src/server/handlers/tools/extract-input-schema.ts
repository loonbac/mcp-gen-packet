import type { z } from "zod";
import type { Tool } from "../../../tools/index.js";

/**
 * Extract the input schema from a tool as a ZodRawShape.
 * Converts the tool's Zod schema into the shape format expected by MCP SDK.
 */
export function extractInputSchema(tool: Tool): z.ZodRawShape {
  const typedTool = tool as Tool & { inputSchema: z.ZodObject<z.ZodRawShape> };
  return typedTool.inputSchema.shape;
}
