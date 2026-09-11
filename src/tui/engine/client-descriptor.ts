export type ClientFormat = "mcpServers" | "mcp" | "servers" | "custom";

export type ClientConfig = Record<string, unknown>;

export interface ClientPatchContext {
  readonly projectPath: string;
  readonly scriptPath: string;
}

export interface CustomSerializer<TConfig = ClientConfig> {
  readonly deserialize: (raw: string) => TConfig;
  readonly serialize: (value: TConfig) => string;
}

export interface ClientDescriptor<TConfig = ClientConfig> {
  readonly id: string;
  readonly name: string;
  readonly resolveConfigPath: () => string | null;
  /**
   * Declarative target format category ("mcpServers" | "mcp" | "servers" | "custom").
   * Required for all client descriptors.
   */
  readonly format: ClientFormat;
  readonly patch: (current: TConfig, context: ClientPatchContext) => TConfig;
  readonly verify?: (config: TConfig) => boolean;
  readonly ensureDir?: boolean;
  readonly initial?: () => TConfig;
  readonly customSerializer?: CustomSerializer<TConfig>;
  readonly detect?: () => boolean;
}

/**
 * Resolves the declarative format category of a descriptor,
 * falling back to the normative default "mcpServers" when omitted.
 */
export function resolveDescriptorFormat(
  descriptor: { readonly format?: ClientFormat },
): ClientFormat {
  return descriptor.format ?? "mcpServers";
}

export { injectClient, createClientFromDescriptor } from "./inject-client.js";

