import { LINK_MAP, linkTypeCatalog } from "../data/link-data.js";

export function listLinkTypes(): string[] {
  return [...new Set(Object.values(LINK_MAP).map((id) => {
    const entry = [...linkTypeCatalog.values()].find((e) => e.id === id);
    return entry?.name ?? "";
  }))].filter(Boolean);
}
