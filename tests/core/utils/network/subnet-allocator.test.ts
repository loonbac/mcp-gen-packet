import { describe, it, expect } from "vitest";
import { SubnetAllocator } from "../../../../src/core/utils/network/subnet-allocator.js";

describe("SubnetAllocator", () => {
  it("generates sequential subnets via returned allocator instances", () => {
    const allocator0 = new SubnetAllocator();
    const alloc1 = allocator0.next();
    expect(alloc1.subnet).toBe("10.0.1.0");

    const alloc2 = alloc1.allocator.next();
    expect(alloc2.subnet).toBe("10.0.2.0");

    const alloc3 = alloc2.allocator.next();
    expect(alloc3.subnet).toBe("10.0.3.0");
  });

  it("ensures immutability: calling next() on original allocator does not mutate it", () => {
    const root = new SubnetAllocator();
    const allocA = root.next();
    const allocB = root.next();

    expect(allocA.subnet).toBe("10.0.1.0");
    expect(allocB.subnet).toBe("10.0.1.0");
    expect(root.nextIndex).toBe(1);
  });

  it("isolates distinct allocator instances with independent progressions", () => {
    const allocatorA = new SubnetAllocator();
    const allocatorB = new SubnetAllocator();

    let curA = allocatorA;
    for (let i = 0; i < 5; i++) {
      curA = curA.next().allocator;
    }

    const allocB1 = allocatorB.next();
    expect(allocB1.subnet).toBe("10.0.1.0");
    expect(curA.next().subnet).toBe("10.0.6.0");
  });

  it("supports custom prefix and initial nextIndex", () => {
    const custom = new SubnetAllocator("172.16", 10);
    expect(custom.prefix).toBe("172.16");
    expect(custom.nextIndex).toBe(10);

    const step1 = custom.next();
    expect(step1.subnet).toBe("172.16.10.0");
    expect(step1.allocator.prefix).toBe("172.16");

    const step2 = step1.allocator.next();
    expect(step2.subnet).toBe("172.16.11.0");
  });
});
