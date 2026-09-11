import { linkTypeCatalog } from "../data/link-data.js";

export function isLinkType(name: string): boolean {
  return linkTypeCatalog.has(name);
}
