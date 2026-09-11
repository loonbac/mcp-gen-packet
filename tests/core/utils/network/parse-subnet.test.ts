import { describe, it, expect } from "vitest";
import { parseSubnet } from "../../../../src/core/utils/network/parse-subnet.js";

describe("parseSubnet", () => {
  it("parses CIDR notation with prefix", () => {
    const result = parseSubnet("192.168.1.0/24");
    expect(result).toEqual({
      baseIp: "192.168.1.0",
      prefix: 24,
      hostIndexBase: 0,
    });
    expect(typeof result.prefix).toBe("number");
    expect(result.hostIndexBase).toBe(0);
  });

  it("normalizes host IP in subnet to network address (forcing fourth octet to 0)", () => {
    const result = parseSubnet("10.0.5.42/16");
    expect(result).toEqual({
      baseIp: "10.0.5.0",
      prefix: 16,
      hostIndexBase: 0,
    });
  });

  it("handles subnet strings without CIDR suffix (prefix undefined)", () => {
    const result = parseSubnet("172.16.10.0");
    expect(result).toEqual({
      baseIp: "172.16.10.0",
      prefix: undefined,
      hostIndexBase: 0,
    });
  });

  it("normalizes fourth octet even without CIDR suffix", () => {
    const result = parseSubnet("192.168.1.99");
    expect(result).toEqual({
      baseIp: "192.168.1.0",
      prefix: undefined,
      hostIndexBase: 0,
    });
  });

  it("correctly parses varying CIDR prefixes like /8 and /30 as integers", () => {
    const r8 = parseSubnet("10.1.2.3/8");
    expect(r8.prefix).toBe(8);
    expect(r8.baseIp).toBe("10.1.2.0");

    const r30 = parseSubnet("192.168.0.1/30");
    expect(r30.prefix).toBe(30);
    expect(r30.baseIp).toBe("192.168.0.0");
  });
});
