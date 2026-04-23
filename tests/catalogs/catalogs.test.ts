import { describe, it, expect } from "vitest";

// These imports will fail until we implement the catalog modules
import { deviceCatalog, getDeviceType, getDevicesByCategory, DEVICE_CATEGORIES } from "../../src/catalogs/devices";
import { moduleCatalog, getModuleType, getModulesByType } from "../../src/catalogs/modules";
import { linkTypeCatalog, getLinkTypeId, LINK_TYPE_ALIASES } from "../../src/catalogs/links";

describe("2.1 Device Catalog", () => {
  it("should have more than 140 device models", () => {
    // PTBuilder allDeviceTypes has 153 entries
    expect(deviceCatalog.size).toBeGreaterThan(140);
  });

  it("should lookup valid device model and return correct type id", () => {
    // 2911 is a router (type 0)
    const type = getDeviceType("2911");
    expect(type).toBe(0);
  });

  it("should lookup another valid router model", () => {
    // 2811 is also a router (type 0)
    const type = getDeviceType("2811");
    expect(type).toBe(0);
  });

  it("should lookup switch model and return correct type id", () => {
    // 2960-24TT is a switch (type 1)
    const type = getDeviceType("2960-24TT");
    expect(type).toBe(1);
  });

  it("should return undefined for invalid device model", () => {
    const type = getDeviceType("9999");
    expect(type).toBeUndefined();
  });

  it("should return undefined for empty string", () => {
    const type = getDeviceType("");
    expect(type).toBeUndefined();
  });

  it("should classify devices by category", () => {
    // Routers (type 0)
    const routers = getDevicesByCategory(0);
    expect(routers).toContain("2911");
    expect(routers).toContain("2811");
    expect(routers).toContain("Router-PT");

    // Switches (type 1)
    const switches = getDevicesByCategory(1);
    expect(switches).toContain("2960-24TT");
    expect(switches).toContain("Switch-PT");

    // Cloud (type 2)
    const clouds = getDevicesByCategory(2);
    expect(clouds).toContain("Cloud-PT");
  });

  it("should have DEVICE_CATEGORIES mapping", () => {
    expect(DEVICE_CATEGORIES[0]).toBe("router");
    expect(DEVICE_CATEGORIES[1]).toBe("switch");
    expect(DEVICE_CATEGORIES[2]).toBe("cloud");
    expect(DEVICE_CATEGORIES[8]).toBe("pc");
    expect(DEVICE_CATEGORIES[9]).toBe("server");
  });
});

describe("2.1 Module Catalog", () => {
  it("should have more than 100 modules", () => {
    // PTBuilder allModuleTypes has 163 entries
    expect(moduleCatalog.size).toBeGreaterThan(100);
  });

  it("should lookup valid module and return type id", () => {
    // WIC-1T is a module (type 2)
    const type = getModuleType("WIC-1T");
    expect(type).toBe(2);
  });

  it("should lookup another valid module", () => {
    // NM-1FE-TX is type 1
    const type = getModuleType("NM-1FE-TX");
    expect(type).toBe(1);
  });

  it("should return undefined for invalid module model", () => {
    const type = getModuleType("INVALID-MODULE");
    expect(type).toBeUndefined();
  });

  it("should group modules by type", () => {
    const type1Modules = getModulesByType(1);
    expect(type1Modules.length).toBeGreaterThan(0);
    expect(type1Modules).toContain("NM-1E");

    const type2Modules = getModulesByType(2);
    expect(type2Modules.length).toBeGreaterThan(0);
    expect(type2Modules).toContain("WIC-1T");
  });
});

describe("2.1 Link Type Catalog", () => {
  it("should have more than 15 link type entries", () => {
    // PTBuilder allLinkTypes has 18 entries including aliases
    expect(linkTypeCatalog.size).toBeGreaterThan(15);
  });

  it("should lookup link by name and return numeric ID", () => {
    const id = getLinkTypeId("ethernet-straight");
    expect(id).toBe(8100);
  });

  it("should lookup link by alias 'straight' and return same ID", () => {
    const idStraight = getLinkTypeId("straight");
    const idEthernetStraight = getLinkTypeId("ethernet-straight");
    expect(idStraight).toBe(idEthernetStraight);
  });

  it("should lookup 'cross' and 'ethernet-cross' as aliases", () => {
    expect(getLinkTypeId("cross")).toBe(getLinkTypeId("ethernet-cross"));
  });

  it("should return undefined for unknown link type", () => {
    const id = getLinkTypeId("unknown-link-type");
    expect(id).toBeUndefined();
  });

  it("should have LINK_TYPE_ALIASES mapping", () => {
    expect(LINK_TYPE_ALIASES["straight"]).toBe("ethernet-straight");
    expect(LINK_TYPE_ALIASES["ethernet-straight"]).toBe("straight");
    expect(LINK_TYPE_ALIASES["cross"]).toBe("ethernet-cross");
    expect(LINK_TYPE_ALIASES["ethernet-cross"]).toBe("cross");
  });
});