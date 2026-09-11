import * as fs from "node:fs";
import { join, dirname } from "node:path";
import type { MCPClient, ClientInjectionResult } from "./mcp-client.js";
import type { ClientDescriptor, ClientPatchContext, ClientConfig } from "./client-descriptor.js";
import { removeStaleMcpPtb } from "./remove-stale-mcp-ptb.js";
import { patchJsonConfig, type PatchOptions } from "../../core/utils/fs/patch-json-config.js";

/**
 * Pure factory creating an `MCPClient` from a declarative `ClientDescriptor`.
 * Coordinates configuration detection, path normalization, stale key cleanup,
 * directory creation, transactional patching, and verification.
 */
export function injectClient<TConfig = ClientConfig>(
  descriptor: ClientDescriptor<TConfig>,
): MCPClient {
  return {
    name: descriptor.name,
    id: descriptor.id,

    detect(): boolean {
      if (descriptor.detect) {
        return descriptor.detect();
      }
      const configPath = descriptor.resolveConfigPath();
      if (!configPath) {
        return false;
      }
      return fs.existsSync(configPath);
    },

    configPath(): string | null {
      return descriptor.resolveConfigPath();
    },

    async inject(projectPath: string): Promise<ClientInjectionResult> {
      try {
        const configPath = descriptor.resolveConfigPath();
        if (!configPath) {
          return {
            success: false,
            error: `No se pudo resolver la ruta de configuración para el cliente ${descriptor.name} (${descriptor.id})`,
          };
        }

        if (descriptor.ensureDir) {
          const parentDir = dirname(configPath);
          if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
          }
        }

        const normalizedProjectPath = projectPath.replace(/\\/g, "/");
        const scriptPath = join(projectPath, "dist", "index.js").replace(/\\/g, "/");
        const context: ClientPatchContext = {
          projectPath: normalizedProjectPath,
          scriptPath,
        };

        const patchFn = (current: TConfig): TConfig => {
          // 1. Remove stale MCP_PTB definitions across containers if current is an object
          const cleaned =
            typeof current === "object" && current !== null
              ? (removeStaleMcpPtb(current as Record<string, unknown>) as TConfig)
              : current;

          // 2. Apply descriptor-specific patch
          return descriptor.patch(cleaned, context);
        };

        const patchOptions: PatchOptions<TConfig> = {
          initial: descriptor.initial,
          verify: descriptor.verify,
          deserialize: descriptor.customSerializer?.deserialize,
          serialize: descriptor.customSerializer?.serialize,
        };

        const result = patchJsonConfig<TConfig>(configPath, patchFn, patchOptions);
        if (result.success) {
          return {
            success: true,
            backup: result.backup ?? `${configPath}.bak`,
          };
        }
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: message };
      }
    },
  };
}

export const createClientFromDescriptor = injectClient;
