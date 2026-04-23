import type { MCPClient } from "./clients/types.js";

export interface ConfigureResult {
  success: boolean;
  clientName: string;
  error?: string;
}

export interface ConfigureSummary {
  configured: number;
  results: ConfigureResult[];
}

export async function configureClients(
  clients: MCPClient[],
  projectPath: string
): Promise<ConfigureSummary> {
  const results: ConfigureResult[] = [];

  for (const client of clients) {
    try {
      const result = await client.inject(projectPath);
      results.push({
        success: result.success,
        clientName: client.name,
        error: result.error,
      });
    } catch (e) {
      results.push({
        success: false,
        clientName: client.name,
        error: String(e),
      });
    }
  }

  return {
    configured: results.filter(r => r.success).length,
    results,
  };
}