/**
 * Pure utility function to calculate an IPv4 host address by replacing
 * the fourth octet with the specified host index.
 */
export function calcIp(baseIp: string, hostIndex: number): string {
  const parts = baseIp.split(".");
  const ip = [...parts];
  ip[3] = String(hostIndex);
  return ip.join(".");
}
