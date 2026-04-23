import { describe, it, expect } from "vitest";

import { getInterfaces } from "../../src/catalogs/interfaces";

describe("2.4 Interface Map", () => {
  it("should return GigabitEthernet interfaces for 2911 router", () => {
    const interfaces = getInterfaces("2911");
    expect(interfaces).toContain("GigabitEthernet0/0");
    expect(interfaces).toContain("GigabitEthernet0/1");
    expect(interfaces).toContain("GigabitEthernet0/2");
  });

  it("should return FastEthernet interfaces for 2960-24TT switch", () => {
    const interfaces = getInterfaces("2960-24TT");
    // 2960-24TT has FastEthernet0/1 through FastEthernet0/24
    expect(interfaces).toContain("FastEthernet0/1");
    expect(interfaces).toContain("FastEthernet0/24");
    // Also has 2 GigabitEthernet ports
    expect(interfaces).toContain("GigabitEthernet0/1");
    expect(interfaces).toContain("GigabitEthernet0/2");
  });

  it("should return FastEthernet0 for PC-PT", () => {
    const interfaces = getInterfaces("PC-PT");
    expect(interfaces).toContain("FastEthernet0");
  });

  it("should return FastEthernet0 for Server-PT", () => {
    const interfaces = getInterfaces("Server-PT");
    expect(interfaces).toContain("FastEthernet0");
  });

  it("should return empty array for unknown model (not error)", () => {
    const interfaces = getInterfaces("UNKNOWN-MODEL-999");
    expect(interfaces).toEqual([]);
  });

  it("should return sorted interface names", () => {
    const interfaces = getInterfaces("2911");
    // Check that interfaces are sorted alphabetically
    const sorted = [...interfaces].sort();
    expect(interfaces).toEqual(sorted);
  });

  it("should return interface list for Router-PT", () => {
    const interfaces = getInterfaces("Router-PT");
    expect(interfaces.length).toBeGreaterThan(0);
  });

  it("should return interface list for Switch-PT", () => {
    const interfaces = getInterfaces("Switch-PT");
    expect(interfaces.length).toBeGreaterThan(0);
  });
});