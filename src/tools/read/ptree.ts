// ── ptree: depth-aware regex scanner for PT activityTree XML ──
// Design D10: flat-tagged `<NODE ID="..." VALUE="..."/>` format parsed into a
// nested ConfigTree via a single regex token stream + stack. Robust if nesting
// appears (open/close tags). The document root element becomes the tree root.

export interface ConfigNode {
  id: string;
  value?: string;
  children: ConfigNode[];
}

export type ConfigTree = ConfigNode;

// Matches opening tags (any element name, with optional self-close) and closing
// tags, in document order. Group 1/2/3 = open (name, attrs, selfClose); group 4 = close.
const TOKEN_RE = /<([A-Za-z_][A-Za-z0-9_]*)\b([^>]*?)(\/?)>|<\/([A-Za-z_][A-Za-z0-9_]*)>/gi;

function extractAttr(attrs: string, name: string): string | undefined {
  const m = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i").exec(attrs);
  return m ? m[1] : undefined;
}

export function parse(xml: string): ConfigTree {
  let root: ConfigNode | null = null;
  const stack: ConfigNode[] = [];

  TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TOKEN_RE.exec(xml)) !== null) {
    if (match[1] !== undefined) {
      // Opening tag
      const selfClose = match[3] === "/";
      const id = extractAttr(match[2], "ID") ?? "";
      const value = extractAttr(match[2], "VALUE");

      const node: ConfigNode = { id, children: [] };
      if (value !== undefined) node.value = value;

      if (root === null) {
        root = node;
      } else {
        stack[stack.length - 1].children.push(node);
      }

      if (!selfClose) {
        stack.push(node);
      }
    } else {
      // Closing tag — pop if the stack is non-empty
      if (stack.length > 0) stack.pop();
    }
  }

  return root ?? { id: "__empty__", children: [] };
}

const SECRET_RE = /password|secret|banner|crypto key/i;

export function filterSecrets(tree: ConfigTree, includeSecrets: boolean): ConfigTree {
  if (includeSecrets) return tree;

  function walk(node: ConfigNode): ConfigNode | null {
    if (node.id && SECRET_RE.test(node.id)) return null;
    const children = node.children.map(walk).filter((c): c is ConfigNode => c !== null);
    return { ...node, children };
  }

  return walk(tree) ?? { id: "__empty__", children: [] };
}

// ── IOS-like formatter ──
// Produces a best-effort IOS text view with sections: interfaces, vlans, routes,
// dot11/ssid, dhcp. Section detection is by the child node's ID attribute.

function formatInterfaces(node: ConfigNode, lines: string[]): void {
  lines.push("interfaces");
  for (const iface of node.children) {
    const ipNode = iface.children.find((c) => c.id.toLowerCase().includes("ip"));
    const statusNode = iface.children.find((c) => c.id.toLowerCase() === "status");
    const protoNode = iface.children.find((c) => c.id.toLowerCase() === "protocol");
    let line = `  ${iface.id}`;
    if (ipNode?.value && ipNode.value !== "0.0.0.0") line += ` ip ${ipNode.value}`;
    if (statusNode?.value) line += ` ${statusNode.value}`;
    if (protoNode?.value) line += `/${protoNode.value}`;
    lines.push(line);
  }
}

function formatVlans(node: ConfigNode, lines: string[]): void {
  lines.push("vlans");
  for (const vlan of node.children) {
    lines.push(`  ${vlan.id} ${vlan.value ?? ""}`.trim());
  }
}

function formatRoutes(node: ConfigNode, lines: string[]): void {
  lines.push("routes");
  for (const route of node.children) {
    lines.push(`  ${route.id} ${route.value ?? ""}`.trim());
  }
}

function formatDot11(node: ConfigNode, lines: string[]): void {
  lines.push("dot11/ssid");
  for (const ssid of node.children) {
    lines.push(`  ${ssid.id} ${ssid.value ?? ""}`.trim());
  }
}

function formatDhcp(node: ConfigNode, lines: string[]): void {
  lines.push("dhcp");
  for (const pool of node.children) {
    lines.push(`  ${pool.id} ${pool.value ?? ""}`.trim());
  }
}

export function formatIos(tree: ConfigTree): string {
  const lines: string[] = [];
  lines.push("!");

  for (const section of tree.children) {
    const id = section.id.toLowerCase();
    if (id.includes("interface")) {
      formatInterfaces(section, lines);
    } else if (id.includes("vlan")) {
      formatVlans(section, lines);
    } else if (id.includes("route")) {
      formatRoutes(section, lines);
    } else if (id.includes("dot11") || id.includes("ssid")) {
      formatDot11(section, lines);
    } else if (id.includes("dhcp")) {
      formatDhcp(section, lines);
    }
  }

  lines.push("!");
  return lines.join("\n");
}
