import { describe, it, expect } from "vitest";
import { getModuleType } from "../../src/catalogs/queries/get-module-type.js";
import { isModuleModel } from "../../src/catalogs/queries/is-module-model.js";
import { listModuleModels } from "../../src/catalogs/queries/list-module-models.js";
import { getModulesByType } from "../../src/catalogs/queries/get-modules-by-type.js";
import {
  moduleCatalog,
  MODULE_MAP,
} from "../../src/catalogs/data/module-data.js";

describe("Module Data and Atomic Queries (R2)", () => {
  describe("getModuleType", () => {
    it("should lookup module type ID for valid module models", () => {
      expect(getModuleType("WIC-1T")).toBe(2);
      expect(getModuleType("NM-1FE-TX")).toBe(1);
    });

    it("should return undefined for unknown module models", () => {
      expect(getModuleType("INVALID-MODULE")).toBeUndefined();
      expect(getModuleType("")).toBeUndefined();
      expect(getModuleType("   ")).toBeUndefined();
    });

    it("should be case-sensitive", () => {
      expect(getModuleType("wic-1t")).toBeUndefined();
      expect(getModuleType("WIC-1T")).toBe(2);
    });

    it("should handle nullish inputs safely", () => {
      expect(getModuleType(null as unknown as string)).toBeUndefined();
      expect(getModuleType(undefined as unknown as string)).toBeUndefined();
    });
  });

  describe("isModuleModel", () => {
    it("should validate existence of known module models", () => {
      expect(isModuleModel("WIC-1T")).toBe(true);
      expect(isModuleModel("NM-1FE-TX")).toBe(true);
    });

    it("should return false for unknown module model", () => {
      expect(isModuleModel("NONEXISTENT")).toBe(false);
      expect(isModuleModel("")).toBe(false);
      expect(isModuleModel("   ")).toBe(false);
    });

    it("should handle nullish inputs safely", () => {
      expect(isModuleModel(null as unknown as string)).toBe(false);
      expect(isModuleModel(undefined as unknown as string)).toBe(false);
    });
  });

  describe("listModuleModels", () => {
    it("should return fresh array with >100 items matching moduleCatalog insertion order", () => {
      const models = listModuleModels();
      expect(models.length).toBeGreaterThan(100);
      expect(models).toEqual([...moduleCatalog.keys()]);
    });

    it("should return a fresh array copy on each call and prevent mutation", () => {
      const list1 = listModuleModels();
      const list2 = listModuleModels();
      expect(list1).toEqual(list2);
      expect(list1).not.toBe(list2);

      list1.push("MUTATED_MODULE");
      expect(listModuleModels()).not.toContain("MUTATED_MODULE");
    });
  });

  describe("getModulesByType", () => {
    it("should filter modules by numeric type ID", () => {
      const type1 = getModulesByType(1);
      expect(type1.length).toBeGreaterThan(0);
      expect(type1).toContain("NM-1E");

      const type2 = getModulesByType(2);
      expect(type2.length).toBeGreaterThan(0);
      expect(type2).toContain("WIC-1T");
    });

    it("should return empty array for non-existent type ID", () => {
      expect(getModulesByType(9999)).toEqual([]);
    });

    it("should return fresh arrays on each call and prevent mutation", () => {
      const res1 = getModulesByType(1);
      const res2 = getModulesByType(1);
      expect(res1).toEqual(res2);
      expect(res1).not.toBe(res2);

      res1.push("HACKED_MODULE");
      expect(getModulesByType(1)).not.toContain("HACKED_MODULE");
    });
  });

  describe("Static Module Data Module Integrity", () => {
    it("should export MODULE_MAP and moduleCatalog", () => {
      expect(MODULE_MAP).toBeDefined();
      expect(moduleCatalog).toBeInstanceOf(Map);
      expect(moduleCatalog.size).toBeGreaterThan(100);
    });

    it("should preserve ModuleEntry structure with model and typeId", () => {
      const entry = moduleCatalog.get("WIC-1T");
      expect(entry).toEqual({
        model: "WIC-1T",
        typeId: 2,
      });
    });
  });
});
