import { z } from "zod";
import type { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";

export const ANALYZE_TRACE_PROMPT_NAME = "analyze_trace" as const;

export const ANALYZE_TRACE_PROMPT_DESCRIPTION =
  "Genera una guía para interpretar una salida de traceroute." as const;

export const ExplainTraceInputSchema = z.object({
  traceOutput: z.string().min(1),
});

export type ExplainTraceInput = z.infer<typeof ExplainTraceInputSchema>;

export const analyzeTraceArgsShape = {
  traceOutput: z.string().min(1).describe("Salida textual del traceroute"),
};

export const promptDefinitions = [
  {
    name: ANALYZE_TRACE_PROMPT_NAME,
    description: ANALYZE_TRACE_PROMPT_DESCRIPTION,
    arguments: [
      {
        name: "traceOutput",
        description: "Salida textual del traceroute",
        required: true,
      },
    ],
  },
] as const;

export const analyzeTracePromptDefinition = promptDefinitions[0];

/**
 * Pure function returning the prompt message structure for a supported prompt name.
 * Throws if the prompt name is unsupported or if arguments fail schema validation.
 */
export function getPrompt(name: string, args: unknown): GetPromptResult {
  if (name === ANALYZE_TRACE_PROMPT_NAME) {
    const parsed = ExplainTraceInputSchema.parse(args ?? {});
    return {
      description: "Prompt para análisis de traceroute",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Analiza esta traza de red y explica posibles cuellos de botella:\n\n${parsed.traceOutput}`,
          },
        },
      ],
    };
  }

  throw new Error(`Prompt no soportado: ${name}`);
}
