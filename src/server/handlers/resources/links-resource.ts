import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import { linkTypeCatalog } from "../../../catalogs/data/link-data.js";
import { formatJsonResource } from "./format-resource.js";

export const LINKS_RESOURCE_URI = "pt://catalog/links";
export const LINKS_RESOURCE_NAME = "Link types catalog from PTBuilder";

/**
 * Snapshot reader for PTBuilder link types catalog resource.
 */
export async function readLinksResource(): Promise<ReadResourceResult> {
  const links = [...linkTypeCatalog.values()].map((entry) => ({
    name: entry.name,
    id: entry.id,
    aliases: entry.aliases,
  }));
  return formatJsonResource(LINKS_RESOURCE_URI, links);
}
