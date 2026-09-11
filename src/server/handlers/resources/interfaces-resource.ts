import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import { modelInterfaces } from "../../../catalogs/data/interface-data.js";
import { formatJsonResource } from "./format-resource.js";

export const INTERFACES_RESOURCE_URI = "pt://catalog/interfaces";
export const INTERFACES_RESOURCE_NAME = "Interface map from PTBuilder";

/**
 * Snapshot reader for PTBuilder interface map resource.
 */
export async function readInterfacesResource(): Promise<ReadResourceResult> {
  const interfaces: Record<string, string[]> = {};
  for (const [model, ifaces] of modelInterfaces.entries()) {
    interfaces[model] = ifaces;
  }
  return formatJsonResource(INTERFACES_RESOURCE_URI, interfaces);
}
