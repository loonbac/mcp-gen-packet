import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import { deviceCatalog } from "../../../catalogs/data/device-data.js";
import { formatJsonResource } from "./format-resource.js";

export const DEVICES_RESOURCE_URI = "pt://catalog/devices";
export const DEVICES_RESOURCE_NAME = "Device catalog from PTBuilder";

/**
 * Snapshot reader for PTBuilder device catalog resource.
 */
export async function readDevicesResource(): Promise<ReadResourceResult> {
  const devices = [...deviceCatalog.values()].map((entry) => ({
    model: entry.model,
    typeId: entry.typeId,
    category: entry.category,
  }));
  return formatJsonResource(DEVICES_RESOURCE_URI, devices);
}
