export interface ParsedSubnet {
  readonly baseIp: string;
  readonly prefix: number | undefined;
  readonly hostIndexBase: 0;
}

/**
 * Parses an IPv4 CIDR string or plain IP string, normalizes the fourth
 * octet to "0", extracts base network IP, and parses optional prefix length.
 */
export function parseSubnet(subnet: string): ParsedSubnet {
  const [ipPart, prefixPart] = subnet.split("/");
  const parts = ipPart.split(".");
  parts[3] = "0";
  const prefix = prefixPart !== undefined ? Number.parseInt(prefixPart, 10) : undefined;
  return {
    baseIp: parts.join("."),
    prefix,
    hostIndexBase: 0,
  };
}
