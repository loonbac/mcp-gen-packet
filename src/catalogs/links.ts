import type { LinkTypeEntry } from "../types/protocol.js";

// ── Link types from PTBuilder ──
const LINK_MAP: Record<string, number> = {
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

export const linkTypeCatalog: Map<string, LinkTypeEntry> = new Map();

// Group by ID to build entries with aliases
const byId = new Map<number, { names: string[]; aliases: string[] }>();

for (const [name, id] of Object.entries(LINK_MAP)) {
  if (!byId.has(id)) {
    byId.set(id, { names: [], aliases: [] });
  }
  const group = byId.get(id)!;
  // "straight" is canonical for 8100, "ethernet-straight" is alias
  if (ALIAS_MAP[name]) {
    group.names.push(name);
    group.aliases.push(...ALIAS_MAP[name]);
  } else {
    group.names.push(name);
  }
}

for (const [name, id] of Object.entries(LINK_MAP)) {
  // Find the canonical name for this ID
  const canonical = Object.keys(LINK_MAP).find((k) => LINK_MAP[k] === id && ALIAS_MAP[k]) ?? name;
  const aliases = Object.keys(LINK_MAP).filter((k) => LINK_MAP[k] === id && k !== canonical);
  if (!linkTypeCatalog.has(canonical)) {
    linkTypeCatalog.set(canonical, { name: canonical, id, aliases });
  }
  // Also index by alias for lookup
  if (!linkTypeCatalog.has(name)) {
    linkTypeCatalog.set(name, { name: canonical, id, aliases });
  }
}

export function getLinkTypeId(name: string): number | undefined {
  return linkTypeCatalog.get(name)?.id;
}

export function isLinkType(name: string): boolean {
  return linkTypeCatalog.has(name);
}

export function listLinkTypes(): string[] {
  return [...new Set(Object.values(LINK_MAP).map((id) => {
    const entry = [...linkTypeCatalog.values()].find((e) => e.id === id);
    return entry?.name ?? "";
  }))].filter(Boolean);
}

export function resolveLinkType(name: string): string | undefined {
  return linkTypeCatalog.get(name)?.name;
}
