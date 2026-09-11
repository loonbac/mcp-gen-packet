import type { LinkTypeEntry } from "../../core/types/catalog.js";

// ── Link types from PTBuilder ──
export const LINK_MAP: Record<string, number> = {
  "ethernet-straight": 8100,
  "ethernet-cross": 8101,
  "straight": 8100,
  "cross": 8101,
  "roll": 8102,
  "fiber": 8103,
  "phone": 8104,
  "cable": 8105,
  "serial": 8106,
  "auto": 8107,
  "console": 8108,
  "wireless": 8109,
  "coaxial": 8110,
  "octal": 8111,
  "cellular": 8112,
  "usb": 8113,
  "custom_io": 8114,
};

// Two-way alias mapping
export const LINK_TYPE_ALIASES: Record<string, string> = {
  "straight": "ethernet-straight",
  "ethernet-straight": "straight",
  "cross": "ethernet-cross",
  "ethernet-cross": "cross",
};

// Aliases that map to the same ID
const ALIAS_MAP: Record<string, string[]> = {
  "straight": ["ethernet-straight"],
  "cross": ["ethernet-cross"],
};

function buildLinkTypeCatalog(): Map<string, LinkTypeEntry> {
  const catalog = new Map<string, LinkTypeEntry>();
  for (const [name, id] of Object.entries(LINK_MAP)) {
    const canonical = Object.keys(LINK_MAP).find((k) => LINK_MAP[k] === id && ALIAS_MAP[k]) ?? name;
    const aliases = Object.keys(LINK_MAP).filter((k) => LINK_MAP[k] === id && k !== canonical);
    if (!catalog.has(canonical)) {
      catalog.set(canonical, { name: canonical, id, aliases });
    }
    if (!catalog.has(name)) {
      catalog.set(name, { name: canonical, id, aliases });
    }
  }
  return catalog;
}

export const linkTypeCatalog: Map<string, LinkTypeEntry> = buildLinkTypeCatalog();
