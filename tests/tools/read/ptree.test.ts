import { describe, it, expect } from "vitest";
import { parse, filterSecrets, formatIos } from "../../../src/tools/read/ptree";

// Observed PT activityTree flat-tagged format (spike-validated, design D10).
// Every element is `<NODE ID="..." VALUE="..."/>` (attributes only); the document
// root carries ID="DEVICE_ACTIVITY_TREE". Sections are container NODEs addressed
// by their ID; leaves carry their text in VALUE.
const SAMPLE_XML = [
  '<DEVICE_ACTIVITY_TREE ID="DEVICE_ACTIVITY_TREE" VALUE="">',
  '  <NODE ID="hostname" VALUE="R1"/>',
  '  <NODE ID="model" VALUE="2911"/>',
  '  <NODE ID="interfaces" VALUE="">',
  '    <NODE ID="GigabitEthernet0/0" VALUE="">',
  '      <NODE ID="ip address" VALUE="10.0.0.1 255.255.255.0"/>',
  '      <NODE ID="status" VALUE="up"/>',
  '      <NODE ID="protocol" VALUE="up"/>',
  '    </NODE>',
  '    <NODE ID="GigabitEthernet0/1" VALUE="">',
  '      <NODE ID="ip address" VALUE="10.0.1.1 255.255.255.0"/>',
  '      <NODE ID="status" VALUE="down"/>',
  '      <NODE ID="protocol" VALUE="down"/>',
  '    </NODE>',
  '  </NODE>',
  '  <NODE ID="vlans" VALUE="">',
  '    <NODE ID="10" VALUE="Sales"/>',
  '    <NODE ID="20" VALUE="Engineering"/>',
  '  </NODE>',
  '  <NODE ID="routes" VALUE="">',
  '    <NODE ID="0.0.0.0 0.0.0.0" VALUE="via 10.0.0.254"/>',
  '  </NODE>',
  '  <NODE ID="ssid" VALUE="">',
  '    <NODE ID="CorpWiFi" VALUE="WPA2"/>',
  '  </NODE>',
  '  <NODE ID="dhcp pool" VALUE="">',
  '    <NODE ID="POOL1" VALUE="10.0.0.0/24"/>',
  '  </NODE>',
  '  <NODE ID="password" VALUE="cisco123"/>',
  '  <NODE ID="enable secret" VALUE="secret123"/>',
  '  <NODE ID="banner motd" VALUE="Authorized access only"/>',
  '  <NODE ID="crypto key" VALUE="generate rsa"/>',
  "</DEVICE_ACTIVITY_TREE>",
].join("\n");

describe("4.2 ptree.parse", () => {
  it("builds a nested ConfigTree from flat-tagged XML", () => {
    const tree = parse(SAMPLE_XML);
    expect(tree.id).toBe("DEVICE_ACTIVITY_TREE");
    expect(tree.children.length).toBeGreaterThan(0);

    const ids = tree.children.map((c) => c.id);
    expect(ids).toContain("interfaces");
    expect(ids).toContain("vlans");
    expect(ids).toContain("routes");
    expect(ids).toContain("ssid");
    expect(ids).toContain("dhcp pool");
  });

  it("nests child nodes under their parent container", () => {
    const tree = parse(SAMPLE_XML);
    const ifaceContainer = tree.children.find((c) => c.id === "interfaces");
    expect(ifaceContainer).toBeDefined();
    expect(ifaceContainer!.children.length).toBe(2);
    expect(ifaceContainer!.children[0].id).toBe("GigabitEthernet0/0");
    const ipAddr = ifaceContainer!.children[0].children.find((c) => c.id === "ip address");
    expect(ipAddr).toBeDefined();
    expect(ipAddr!.value).toBe("10.0.0.1 255.255.255.0");
  });

  it("captures value on leaf nodes", () => {
    const tree = parse(SAMPLE_XML);
    const vlans = tree.children.find((c) => c.id === "vlans");
    expect(vlans).toBeDefined();
    const v10 = vlans!.children.find((c) => c.id === "10");
    expect(v10).toBeDefined();
    expect(v10!.value).toBe("Sales");
  });
});

describe("4.4 ptree.filterSecrets", () => {
  it("drops nodes matching /password|secret|banner|crypto key/i when includeSecrets=false", () => {
    const tree = parse(SAMPLE_XML);
    const filtered = filterSecrets(tree, false);

    const allIds = collectIds(filtered);
    expect(allIds).not.toContain("password");
    expect(allIds).not.toContain("enable secret");
    expect(allIds).not.toContain("banner motd");
    expect(allIds).not.toContain("crypto key");

    // Non-secret nodes preserved
    expect(allIds).toContain("hostname");
    expect(allIds).toContain("interfaces");
    expect(allIds).toContain("vlans");
  });

  it("keeps secret nodes when includeSecrets=true", () => {
    const tree = parse(SAMPLE_XML);
    const filtered = filterSecrets(tree, true);

    const allIds = collectIds(filtered);
    expect(allIds).toContain("password");
    expect(allIds).toContain("enable secret");
    expect(allIds).toContain("banner motd");
    expect(allIds).toContain("crypto key");
  });
});

describe("4.6 ptree.formatIos", () => {
  it("emits IOS-like sections: interfaces, vlans, routes, dot11/ssid, dhcp", () => {
    const tree = parse(SAMPLE_XML);
    const out = formatIos(tree);

    expect(out).toContain("interfaces");
    expect(out).toContain("vlans");
    expect(out).toContain("routes");
    expect(out).toContain("dot11/ssid");
    expect(out).toContain("dhcp");
  });

  it("renders interface name and ip/mask when non-zero", () => {
    const tree = parse(SAMPLE_XML);
    const out = formatIos(tree);

    expect(out).toContain("GigabitEthernet0/0");
    expect(out).toContain("10.0.0.1");
    expect(out).toContain("255.255.255.0");
  });

  it("renders vlan id+name", () => {
    const tree = parse(SAMPLE_XML);
    const out = formatIos(tree);

    expect(out).toContain("10");
    expect(out).toContain("Sales");
  });
});

function collectIds(tree: { id: string; children: unknown[] }): string[] {
  const out: string[] = [tree.id];
  for (const c of tree.children as { id: string; children: unknown[] }[]) {
    out.push(...collectIds(c));
  }
  return out;
}
