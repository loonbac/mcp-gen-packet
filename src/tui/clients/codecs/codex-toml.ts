/**
 * Pure codec for the bounded subset of TOML used by Codex configuration (~/.codex/config.toml).
 * Handles scalar strings, numbers, booleans, arrays, comments, whitespace tolerance,
 * and dotted nested sections with round-trip fidelity.
 */

function stripComment(line: string): string {
  let inDouble = false;
  let inSingle = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && !inSingle && line[i - 1] !== "\\") {
      inDouble = !inDouble;
    } else if (char === "'" && !inDouble && line[i - 1] !== "\\") {
      inSingle = !inSingle;
    } else if (char === "#" && !inDouble && !inSingle) {
      return line.slice(0, i).trim();
    }
  }
  return line.trim();
}

function parseArray(val: string): unknown[] {
  try {
    return JSON.parse(val);
  } catch {
    try {
      return JSON.parse(val.replace(/'/g, '"'));
    } catch {
      const inner = val.slice(1, -1).trim();
      if (!inner) return [];
      return inner.split(",").map((item) => {
        const trimmed = item.trim();
        if (
          (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
          (trimmed.startsWith("'") && trimmed.endsWith("'"))
        ) {
          return trimmed.slice(1, -1);
        }
        return trimmed;
      });
    }
  }
}

function parseValue(rawValue: string): unknown {
  if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
    return parseArray(rawValue);
  }
  if (
    (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
    (rawValue.startsWith("'") && rawValue.endsWith("'"))
  ) {
    return rawValue.slice(1, -1);
  }
  if (rawValue === "true") {
    return true;
  }
  if (rawValue === "false") {
    return false;
  }
  if (/^-?\d+(\.\d+)?$/.test(rawValue)) {
    return Number(rawValue);
  }
  return rawValue;
}

/**
 * Parses a TOML string into a nested JavaScript object.
 */
export function parseCodexToml(raw: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (!raw || raw.trim().length === 0) {
    return result;
  }

  const lines = raw.split("\n");
  let currentTarget: Record<string, unknown> = result;

  for (const rawLine of lines) {
    const line = stripComment(rawLine);
    if (!line) continue;

    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      const sectionPath = sectionMatch[1].split(".").map((s) => s.trim());
      let target = result;
      for (const part of sectionPath) {
        if (!target[part] || typeof target[part] !== "object" || Array.isArray(target[part])) {
          target[part] = {};
        }
        target = target[part] as Record<string, unknown>;
      }
      currentTarget = target;
      continue;
    }

    const kvMatch = line.match(/^([^=]+)=\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1].trim();
      const rawVal = kvMatch[2].trim();
      currentTarget[key] = parseValue(rawVal);
    }
  }

  return result;
}

function serializeValue(val: unknown): string {
  if (Array.isArray(val)) {
    return "[" + val.map((v) => JSON.stringify(v)).join(", ") + "]";
  }
  if (typeof val === "string") {
    return JSON.stringify(val);
  }
  if (typeof val === "boolean" || typeof val === "number") {
    return String(val);
  }
  if (typeof val === "object" && val !== null) {
    return JSON.stringify(val);
  }
  return `"${String(val)}"`;
}

function serializeSection(
  prefix: string,
  obj: Record<string, unknown>,
  lines: string[],
): void {
  const scalars: [string, unknown][] = [];
  const tables: [string, Record<string, unknown>][] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      tables.push([key, value as Record<string, unknown>]);
    } else {
      scalars.push([key, value]);
    }
  }

  if (prefix && scalars.length > 0) {
    lines.push(`[${prefix}]`);
    for (const [key, value] of scalars) {
      lines.push(`${key} = ${serializeValue(value)}`);
    }
    lines.push("");
  } else if (!prefix && scalars.length > 0) {
    for (const [key, value] of scalars) {
      lines.push(`${key} = ${serializeValue(value)}`);
    }
    lines.push("");
  } else if (prefix && tables.length === 0) {
    lines.push(`[${prefix}]`);
    lines.push("");
  }

  for (const [subKey, subTable] of tables) {
    const nextPrefix = prefix ? `${prefix}.${subKey}` : subKey;
    serializeSection(nextPrefix, subTable, lines);
  }
}

/**
 * Serializes a JavaScript object into a standard TOML string.
 */
export function stringifyCodexToml(obj: Record<string, unknown>): string {
  if (!obj || Object.keys(obj).length === 0) {
    return "";
  }

  const lines: string[] = [];
  serializeSection("", obj, lines);
  const output = lines.join("\n").trim();
  return output.length > 0 ? output + "\n" : "";
}
