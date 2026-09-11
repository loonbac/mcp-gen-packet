import { linkTypeCatalog } from "../data/link-data.js";

export function resolveLinkType(name: string): string | undefined {
  return linkTypeCatalog.get(name)?.name;
}
