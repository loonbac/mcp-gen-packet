import { describe, it, expect } from "vitest";

// Canonical data modules
import {
  deviceCatalog as canonicalDeviceCatalog,
  DEVICE_CATEGORIES as canonicalDeviceCategories,
} from "../../src/catalogs/data/device-data.js";
import { moduleCatalog as canonicalModuleCatalog } from "../../src/catalogs/data/module-data.js";

// Canonical queries
import { getDeviceType as canonicalGetDeviceType } from "../../src/catalogs/queries/get-device-type.js";
import { getDeviceCategory as canonicalGetDeviceCategory } from "../../src/catalogs/queries/get-device-category.js";
import { getDevicesByCategory as canonicalGetDevicesByCategory } from "../../src/catalogs/queries/get-devices-by-category.js";
import { isDeviceModel as canonicalIsDeviceModel } from "../../src/catalogs/queries/is-device-model.js";
import { listDeviceModels as canonicalListDeviceModels } from "../../src/catalogs/queries/list-device-models.js";
import { getModuleType as canonicalGetModuleType } from "../../src/catalogs/queries/get-module-type.js";
import { isModuleModel as canonicalIsModuleModel } from "../../src/catalogs/queries/is-module-model.js";
import { listModuleModels as canonicalListModuleModels } from "../../src/catalogs/queries/list-module-models.js";
import { getModulesByType as canonicalGetModulesByType } from "../../src/catalogs/queries/get-modules-by-type.js";

// Query barrel
import * as queryBarrel from "../../src/catalogs/queries/index.js";

// Façades
import * as devicesFacade from "../../src/catalogs/devices.js";
import * as modulesFacade from "../../src/catalogs/modules.js";

// Index barrel
import * as catalogsIndex from "../../src/catalogs/index.js";

describe("Device and Module Compatibility Façades Contract", () => {
  describe("devices.ts façade identity parity", () => {
    it("should export identical data references", () => {
      expect(devicesFacade.deviceCatalog).toBe(canonicalDeviceCatalog);
      expect(devicesFacade.DEVICE_CATEGORIES).toBe(canonicalDeviceCategories);
    });

    it("should export identical query function references", () => {
      expect(devicesFacade.getDeviceType).toBe(canonicalGetDeviceType);
      expect(devicesFacade.getDeviceCategory).toBe(canonicalGetDeviceCategory);
      expect(devicesFacade.getDevicesByCategory).toBe(canonicalGetDevicesByCategory);
      expect(devicesFacade.isDeviceModel).toBe(canonicalIsDeviceModel);
      expect(devicesFacade.listDeviceModels).toBe(canonicalListDeviceModels);
    });
  });

  describe("modules.ts façade identity parity", () => {
    it("should export identical data references", () => {
      expect(modulesFacade.moduleCatalog).toBe(canonicalModuleCatalog);
    });

    it("should export identical query function references", () => {
      expect(modulesFacade.getModuleType).toBe(canonicalGetModuleType);
      expect(modulesFacade.isModuleModel).toBe(canonicalIsModuleModel);
      expect(modulesFacade.listModuleModels).toBe(canonicalListModuleModels);
      expect(modulesFacade.getModulesByType).toBe(canonicalGetModulesByType);
    });
  });

  describe("queries/index.ts barrel parity", () => {
    it("should re-export all 9 implemented queries with identical references", () => {
      expect(queryBarrel.getDeviceType).toBe(canonicalGetDeviceType);
      expect(queryBarrel.getDeviceCategory).toBe(canonicalGetDeviceCategory);
      expect(queryBarrel.getDevicesByCategory).toBe(canonicalGetDevicesByCategory);
      expect(queryBarrel.isDeviceModel).toBe(canonicalIsDeviceModel);
      expect(queryBarrel.listDeviceModels).toBe(canonicalListDeviceModels);
      expect(queryBarrel.getModuleType).toBe(canonicalGetModuleType);
      expect(queryBarrel.isModuleModel).toBe(canonicalIsModuleModel);
      expect(queryBarrel.listModuleModels).toBe(canonicalListModuleModels);
      expect(queryBarrel.getModulesByType).toBe(canonicalGetModulesByType);
    });
  });

  describe("catalogs/index.ts re-export parity for devices and modules", () => {
    it("should re-export device symbols through the index barrel", () => {
      expect(catalogsIndex.DEVICE_CATEGORIES).toBe(canonicalDeviceCategories);
      expect(catalogsIndex.deviceCatalog).toBe(canonicalDeviceCatalog);
      expect(catalogsIndex.getDeviceType).toBe(canonicalGetDeviceType);
      expect(catalogsIndex.getDeviceCategory).toBe(canonicalGetDeviceCategory);
      expect(catalogsIndex.getDevicesByCategory).toBe(canonicalGetDevicesByCategory);
      expect(catalogsIndex.isDeviceModel).toBe(canonicalIsDeviceModel);
      expect(catalogsIndex.listDeviceModels).toBe(canonicalListDeviceModels);
    });

    it("should re-export module symbols through the index barrel", () => {
      expect(catalogsIndex.moduleCatalog).toBe(canonicalModuleCatalog);
      expect(catalogsIndex.getModuleType).toBe(canonicalGetModuleType);
      expect(catalogsIndex.isModuleModel).toBe(canonicalIsModuleModel);
      expect(catalogsIndex.listModuleModels).toBe(canonicalListModuleModels);
      expect(catalogsIndex.getModulesByType).toBe(canonicalGetModulesByType);
    });
  });
});
