import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ANALYZE_TRACE_PROMPT_NAME,
  ANALYZE_TRACE_PROMPT_DESCRIPTION,
  analyzeTraceArgsShape,
  getPrompt,
} from "./analyze-trace-prompt.js";

/**
 * Register all prompt handlers on the given McpServer instance.
 */
export function registerPrompts(server: McpServer): void {
  server.prompt(
    ANALYZE_TRACE_PROMPT_NAME,
    ANALYZE_TRACE_PROMPT_DESCRIPTION,
    analyzeTraceArgsShape,
    (args) => getPrompt(ANALYZE_TRACE_PROMPT_NAME, args),
  );
}
