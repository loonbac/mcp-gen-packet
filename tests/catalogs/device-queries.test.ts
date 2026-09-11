import { describe, it, expect } from "vitest";
import { getDeviceType } from "../../src/catalogs/queries/get-device-type.js";
import { getDeviceCategory } from "../../src/catalogs/queries/get-device-category.js";
import { getDevicesByCategory } from "../../src/catalogs/queries/get-devices-by-category.js";
import { isDeviceModel } from "../../src/catalogs/queries/is-device-model.js";
import { listDeviceModels } from "../../src/catalogs/queries/list-device-models.js";
import {
  deviceCatalog,
  DEVICE_CATEGORIES,
  DEVICE_TYPE_MAP,
  CATEGORY_NAMES,
} from "../../src/catalogs/data/device-data.js";

describe("Device Data and Atomic Queries (R1)", () => {
  describe("getDeviceType", () => {
    it("should lookup type ID for valid router model", () => {
      expect(getDeviceType("2911")).toBe(0);
      expect(getDeviceType("2811")).toBe(0);
    });

    it("should lookup type ID for valid switch model", () => {
      expect(getDeviceType("2960-24TT")).toBe(1);
    });

    it("should return undefined for unknown or empty models", () => {
      expect(getDeviceType("nonexistent-model")).toBeUndefined();
      expect(getDeviceType("")).toBeUndefined();
    });

    it("should be case-sensitive and respect whitespace", () => {
      expect(getDeviceType("router-pt")).toBeUndefined();
      expect(getDeviceType("Router-PT")).toBe(0);
      expect(getDeviceType("  2911  ")).toBeUndefined();
    });

    it("should handle nullish inputs safely without throwing", () => {
      expect(getDeviceType(null as unknown as string)).toBeUndefined();
      expect(getDeviceType(undefined as unknown as string)).toBeUndefined();
    });
  });

  describe("getDeviceCategory", () => {
    it("should lookup category for router", () => {
      expect(getDeviceCategory("2911")).toBe("router");
    });

    it("should lookup category for PC", () => {
      expect(getDeviceCategory("PC-PT")).toBe("pc");
    });

    it("should return undefined for unknown device model", () => {
      expect(getDeviceCategory("unknown-device")).toBeUndefined();
    });

    it("should be case-sensitive", () => {
      expect(getDeviceCategory("pc-pt")).toBeUndefined();
    });
  });

  describe("getDevicesByCategory", () => {
    it("should filter devices by numeric category (type ID 0 -> router)", () => {
      const routers = getDevicesByCategory(0);
      expect(routers).toContain("2911");
      expect(routers).toContain("2811");
      expect(routers).toContain("Router-PT");
    });

    it("should filter devices by string category ('switch')", () => {
      const switches = getDevicesByCategory("switch");
      expect(switches).toContain("2960-24TT");
      expect(switches).toContain("Switch-PT");
    });

    it("should fallback to 'other' for unknown numeric category", () => {
      const others = getDevicesByCategory(9999);
      // Models like DLC100 (type 29) are categorized as 'other'
      expect(others).toContain("DLC100");
    });

    it("should return fresh arrays on successive calls and prevent external mutation", () => {
      const res1 = getDevicesByCategory(0);
      const res2 = getDevicesByCategory(0);
      expect(res1).toEqual(res2);
      expect(res1).not.toBe(res2);

      // Mutating res1 should not affect res2 or deviceCatalog
      res1.push("HACKED-DEVICE");
      const res3 = getDevicesByCategory(0);
      expect(res3).not.toContain("HACKED-DEVICE");
    });
  });

  describe("isDeviceModel", () => {
    it("should return true for existing device models", () => {
      expect(isDeviceModel("2911")).toBe(true);
      expect(isDeviceModel("PC-PT")).toBe(true);
    });

    it("should return false for unknown model", () => {
      expect(isDeviceModel("unknown-model")).toBe(false);
      expect(isDeviceModel("")).toBe(false);
      expect(isDeviceModel("   ")).toBe(false);
    });

    it("should handle nullish inputs safely", () => {
      expect(isDeviceModel(null as unknown as string)).toBe(false);
      expect(isDeviceModel(undefined as unknown as string)).toBe(false);
    });
  });

  describe("listDeviceModels", () => {
    it("should return array with >140 items matching deviceCatalog insertion order", () => {
      const models = listDeviceModels();
      expect(models.length).toBeGreaterThan(140);
      expect(models).toEqual([...deviceCatalog.keys()]);
    });

    it("should return a fresh array copy on each call and prevent external mutation", () => {
      const list1 = listDeviceModels();
      const list2 = listDeviceModels();
      expect(list1).toEqual(list2);
      expect(list1).not.toBe(list2);

      list1.push("MUTATED_MODEL");
      expect(listDeviceModels()).not.toContain("MUTATED_MODEL");
    });
  });

  describe("Static Data Module Integrity", () => {
    it("should export DEVICE_TYPE_MAP, DEVICE_CATEGORIES, CATEGORY_NAMES, and deviceCatalog", () => {
      expect(DEVICE_TYPE_MAP).toBeDefined();
      expect(DEVICE_CATEGORIES).toBeDefined();
      expect(CATEGORY_NAMES).toBeDefined();
      expect(deviceCatalog).toBeInstanceOf(Map);
      expect(deviceCatalog.size).toBeGreaterThan(140);
    });

    it("should preserve DeviceEntry structure with model, typeId, category", () => {
      const entry = deviceCatalog.get("2911");
      expect(entry).toEqual({
        model: "2911",
        typeId: 0,
        category: "router",
      });
    });
  });
});
