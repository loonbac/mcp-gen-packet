import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import { moduleCatalog } from "../../../catalogs/data/module-data.js";
import { formatJsonResource } from "./format-resource.js";

export const MODULES_RESOURCE_URI = "pt://catalog/modules";
export const MODULES_RESOURCE_NAME = "Module catalog from PTBuilder";

/**
 * Snapshot reader for PTBuilder module catalog resource.
 */
export async function readModulesResource(): Promise<ReadResourceResult> {
  const modules = [...moduleCatalog.values()].map((entry) => ({
    model: entry.model,
    typeId: entry.typeId,
  }));
  return formatJsonResource(MODULES_RESOURCE_URI, modules);
}
