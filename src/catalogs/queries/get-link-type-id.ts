import { linkTypeCatalog } from "../data/link-data.js";

export function getLinkTypeId(name: string): number | undefined {
  return linkTypeCatalog.get(name)?.id;
}
