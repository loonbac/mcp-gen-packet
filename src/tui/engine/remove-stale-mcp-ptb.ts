const TARGET_CONTAINERS = ["mcp", "mcpServers", "servers"] as const;
const STALE_KEY = "MCP_PTB";

/**
 * Pure function that removes `MCP_PTB` from `mcp`, `mcpServers`, and `servers`
 * containers if present, returning a cloned object without in-place mutation.
 */
export function removeStaleMcpPtb<T extends Record<string, unknown>>(current: Readonly<T>): T {
  const result: Record<string, unknown> = { ...current };

  for (const containerKey of TARGET_CONTAINERS) {
    const container = result[containerKey];
    if (container && typeof container === "object" && !Array.isArray(container)) {
      if (STALE_KEY in container) {
        const clonedContainer = { ...(container as Record<string, unknown>) };
        delete clonedContainer[STALE_KEY];
        result[containerKey] = clonedContainer;
      }
    }
  }

  return result as T;
}
