import { describe, it, expect } from "vitest";
import { calcIp } from "../../../../src/core/utils/network/calc-ip.js";

describe("calcIp", () => {
  it("replaces the fourth octet with the given host index (.1, .15)", () => {
    expect(calcIp("192.168.1.0", 1)).toBe("192.168.1.1");
    expect(calcIp("192.168.1.0", 15)).toBe("192.168.1.15");
  });

  it("replaces fourth octet preserving arbitrary first three octets (.254)", () => {
    expect(calcIp("10.200.45.0", 254)).toBe("10.200.45.254");
  });

  it("handles boundary host indices (0, 255)", () => {
    expect(calcIp("192.168.1.100", 0)).toBe("192.168.1.0");
    expect(calcIp("192.168.1.100", 255)).toBe("192.168.1.255");
  });

  it("preserves arbitrary IPv4 addresses across multiple subnets", () => {
    expect(calcIp("10.0.0.0", 10)).toBe("10.0.0.10");
    expect(calcIp("172.16.254.12", 99)).toBe("172.16.254.99");
  });

  it("does not mutate the input baseIp string and behaves purely", () => {
    const baseIp = "172.16.0.0";
    const res1 = calcIp(baseIp, 5);
    const res2 = calcIp(baseIp, 5);
    expect(res1).toBe("172.16.0.5");
    expect(res2).toBe("172.16.0.5");
    expect(baseIp).toBe("172.16.0.0");
  });
});
