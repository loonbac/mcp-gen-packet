import { describe, it, expect } from "vitest";

// Canonical data modules
import {
  linkTypeCatalog as canonicalLinkTypeCatalog,
  LINK_TYPE_ALIASES as canonicalLinkTypeAliases,
  LINK_MAP as canonicalLinkMap,
} from "../../src/catalogs/data/link-data.js";
import { modelInterfaces as canonicalModelInterfaces } from "../../src/catalogs/data/interface-data.js";

// Canonical link queries
import { getLinkTypeId as canonicalGetLinkTypeId } from "../../src/catalogs/queries/get-link-type-id.js";
import { isLinkType as canonicalIsLinkType } from "../../src/catalogs/queries/is-link-type.js";
import { listLinkTypes as canonicalListLinkTypes } from "../../src/catalogs/queries/list-link-types.js";
import { resolveLinkType as canonicalResolveLinkType } from "../../src/catalogs/queries/resolve-link-type.js";

// Canonical interface queries
import { getInterfaces as canonicalGetInterfaces } from "../../src/catalogs/queries/get-interfaces.js";
import { hasInterfaces as canonicalHasInterfaces } from "../../src/catalogs/queries/has-interfaces.js";
import { listModelsWithInterfaces as canonicalListModelsWithInterfaces } from "../../src/catalogs/queries/list-models-with-interfaces.js";

// Barrels and Façades
import * as queryBarrel from "../../src/catalogs/queries/index.js";
import * as linksFacade from "../../src/catalogs/links.js";
import * as interfacesFacade from "../../src/catalogs/interfaces.js";
import * as catalogsIndex from "../../src/catalogs/index.js";

describe("Link and Interface Catalogs: Data, Atomic Queries & Façades (S5b)", () => {
  describe("R3: Link Data and Atomic Queries", () => {
    it("should export LINK_MAP, LINK_TYPE_ALIASES, and pre-indexed linkTypeCatalog", () => {
      expect(canonicalLinkMap).toBeDefined();
      expect(canonicalLinkTypeAliases).toBeDefined();
      expect(canonicalLinkTypeCatalog.size).toBeGreaterThan(15);
      expect(canonicalLinkTypeCatalog.get("straight")?.id).toBe(8100);
      expect(canonicalLinkTypeCatalog.get("ethernet-straight")?.id).toBe(8100);
    });

    it("should lookup link type ID by canonical name and alias", () => {
      expect(canonicalGetLinkTypeId("ethernet-straight")).toBe(8100);
      expect(canonicalGetLinkTypeId("straight")).toBe(8100);
      expect(canonicalGetLinkTypeId("ethernet-cross")).toBe(8101);
      expect(canonicalGetLinkTypeId("cross")).toBe(8101);
      expect(canonicalGetLinkTypeId("roll")).toBe(8102);
      expect(canonicalGetLinkTypeId("custom_io")).toBe(8114);
    });

    it("should return undefined for unknown link types or empty strings", () => {
      expect(canonicalGetLinkTypeId("unknown-link-type")).toBeUndefined();
      expect(canonicalGetLinkTypeId("")).toBeUndefined();
    });

    it("should verify bidirectional aliases in LINK_TYPE_ALIASES", () => {
      expect(canonicalLinkTypeAliases["straight"]).toBe("ethernet-straight");
      expect(canonicalLinkTypeAliases["ethernet-straight"]).toBe("straight");
      expect(canonicalLinkTypeAliases["cross"]).toBe("ethernet-cross");
      expect(canonicalLinkTypeAliases["ethernet-cross"]).toBe("cross");
    });

    it("should resolve canonical link names via resolveLinkType", () => {
      expect(canonicalResolveLinkType("straight")).toBe("straight");
      expect(canonicalResolveLinkType("ethernet-straight")).toBe("straight");
      expect(canonicalResolveLinkType("cross")).toBe("cross");
      expect(canonicalResolveLinkType("ethernet-cross")).toBe("cross");
      expect(canonicalResolveLinkType("fiber")).toBe("fiber");
      expect(canonicalResolveLinkType("nonexistent")).toBeUndefined();
    });

    it("should validate link types via isLinkType", () => {
      expect(canonicalIsLinkType("straight")).toBe(true);
      expect(canonicalIsLinkType("ethernet-straight")).toBe(true);
      expect(canonicalIsLinkType("serial")).toBe(true);
      expect(canonicalIsLinkType("wireless")).toBe(true);
      expect(canonicalIsLinkType("not-a-link")).toBe(false);
      expect(canonicalIsLinkType("")).toBe(false);
    });

    it("should return deduplicated canonical link types via listLinkTypes", () => {
      const list = canonicalListLinkTypes();
      expect(list.length).toBe(15);
      expect(new Set(list).size).toBe(15);
      expect(list[0]).toBe("straight");
      expect(list[1]).toBe("cross");
      expect(list).toContain("roll");
      expect(list).toContain("custom_io");
      expect(list).not.toContain("ethernet-straight");
      expect(list).not.toContain("ethernet-cross");
      expect(list).not.toContain("");
    });
  });

  describe("R4: Interface Data and Atomic Queries", () => {
    it("should export modelInterfaces Map preserving entries", () => {
      expect(canonicalModelInterfaces.size).toBeGreaterThan(20);
      expect(canonicalModelInterfaces.has("2911")).toBe(true);
      expect(canonicalModelInterfaces.has("PC-PT")).toBe(true);
    });

    it("should query router and switch interfaces via getInterfaces", () => {
      const r2911 = canonicalGetInterfaces("2911");
      expect(r2911).toEqual([
        "GigabitEthernet0/0", "GigabitEthernet0/1", "GigabitEthernet0/2",
        "Serial0/0/0", "Serial0/0/1",
      ]);

      const s2960 = canonicalGetInterfaces("2960-24TT");
      expect(s2960).toContain("FastEthernet0/1");
      expect(s2960).toContain("FastEthernet0/24");
      expect(s2960).toContain("GigabitEthernet0/1");
      expect(s2960).toContain("GigabitEthernet0/2");
      expect(s2960.length).toBe(26);
    });

    it("should query end-device interfaces via getInterfaces", () => {
      expect(canonicalGetInterfaces("PC-PT")).toEqual(["FastEthernet0"]);
      expect(canonicalGetInterfaces("Server-PT")).toEqual(["FastEthernet0"]);
      expect(canonicalGetInterfaces("Laptop-PT")).toEqual(["FastEthernet0", "Wireless0"]);
      expect(canonicalGetInterfaces("TabletPC-PT")).toEqual(["Wireless0"]);
      expect(canonicalGetInterfaces("SMARTPHONE-PT")).toEqual(["Wireless0"]);
      expect(canonicalGetInterfaces("Printer-PT")).toEqual(["FastEthernet0"]);
    });

    it("should return empty array for unknown models without throwing", () => {
      expect(canonicalGetInterfaces("UNKNOWN-MODEL-999")).toEqual([]);
      expect(canonicalGetInterfaces("")).toEqual([]);
      expect(canonicalGetInterfaces("null")).toEqual([]);
    });

    it("should verify interface presence via hasInterfaces", () => {
      expect(canonicalHasInterfaces("2911")).toBe(true);
      expect(canonicalHasInterfaces("2960-24TT")).toBe(true);
      expect(canonicalHasInterfaces("PC-PT")).toBe(true);
      expect(canonicalHasInterfaces("NONEXISTENT-MODEL")).toBe(false);
      expect(canonicalHasInterfaces("")).toBe(false);
    });

    it("should list all models with interfaces via listModelsWithInterfaces", () => {
      const models = canonicalListModelsWithInterfaces();
      expect(models.length).toBe(canonicalModelInterfaces.size);
      expect(models).toContain("2911");
      expect(models).toContain("2960-24TT");
      expect(models).toContain("PC-PT");
      expect(models).toContain("Linksys-WRT300N");
    });
  });

  describe("Façades and Barrel Identity Contracts", () => {
    it("should export identical symbols from links.ts façade", () => {
      expect(linksFacade.LINK_TYPE_ALIASES).toBe(canonicalLinkTypeAliases);
      expect(linksFacade.linkTypeCatalog).toBe(canonicalLinkTypeCatalog);
      expect(linksFacade.getLinkTypeId).toBe(canonicalGetLinkTypeId);
      expect(linksFacade.isLinkType).toBe(canonicalIsLinkType);
      expect(linksFacade.listLinkTypes).toBe(canonicalListLinkTypes);
      expect(linksFacade.resolveLinkType).toBe(canonicalResolveLinkType);
    });

    it("should export identical symbols from interfaces.ts façade", () => {
      expect(interfacesFacade.modelInterfaces).toBe(canonicalModelInterfaces);
      expect(interfacesFacade.getInterfaces).toBe(canonicalGetInterfaces);
      expect(interfacesFacade.hasInterfaces).toBe(canonicalHasInterfaces);
      expect(interfacesFacade.listModelsWithInterfaces).toBe(canonicalListModelsWithInterfaces);
    });

    it("should re-export all 16 atomic queries from queries/index.ts", () => {
      expect(queryBarrel.getLinkTypeId).toBe(canonicalGetLinkTypeId);
      expect(queryBarrel.isLinkType).toBe(canonicalIsLinkType);
      expect(queryBarrel.listLinkTypes).toBe(canonicalListLinkTypes);
      expect(queryBarrel.resolveLinkType).toBe(canonicalResolveLinkType);
      expect(queryBarrel.getInterfaces).toBe(canonicalGetInterfaces);
      expect(queryBarrel.hasInterfaces).toBe(canonicalHasInterfaces);
      expect(queryBarrel.listModelsWithInterfaces).toBe(canonicalListModelsWithInterfaces);
    });

    it("should re-export link and interface symbols through catalogs/index.ts", () => {
      expect(catalogsIndex.LINK_TYPE_ALIASES).toBe(canonicalLinkTypeAliases);
      expect(catalogsIndex.linkTypeCatalog).toBe(canonicalLinkTypeCatalog);
      expect(catalogsIndex.getLinkTypeId).toBe(canonicalGetLinkTypeId);
      expect(catalogsIndex.isLinkType).toBe(canonicalIsLinkType);
      expect(catalogsIndex.listLinkTypes).toBe(canonicalListLinkTypes);
      expect(catalogsIndex.resolveLinkType).toBe(canonicalResolveLinkType);
      expect(catalogsIndex.modelInterfaces).toBe(canonicalModelInterfaces);
      expect(catalogsIndex.getInterfaces).toBe(canonicalGetInterfaces);
      expect(catalogsIndex.hasInterfaces).toBe(canonicalHasInterfaces);
      expect(catalogsIndex.listModelsWithInterfaces).toBe(canonicalListModelsWithInterfaces);
    });
  });

  describe("Triangulation & Edge Cases", () => {
    it("should enforce case-sensitivity for link and interface lookups", () => {
      expect(canonicalGetLinkTypeId("Straight")).toBeUndefined();
      expect(canonicalGetLinkTypeId("ETHERNET-STRAIGHT")).toBeUndefined();
      expect(canonicalResolveLinkType("Straight")).toBeUndefined();
      expect(canonicalIsLinkType("Cross")).toBe(false);

      expect(canonicalGetInterfaces("pc-pt")).toEqual([]);
      expect(canonicalHasInterfaces("pc-pt")).toBe(false);
      expect(canonicalGetInterfaces("2911 ")).toEqual([]);
    });

    it("should handle whitespace inputs safely without trimming or false positives", () => {
      expect(canonicalGetLinkTypeId(" straight ")).toBeUndefined();
      expect(canonicalResolveLinkType(" straight ")).toBeUndefined();
      expect(canonicalIsLinkType(" straight ")).toBe(false);
      expect(canonicalGetInterfaces("  2911  ")).toEqual([]);
      expect(canonicalHasInterfaces("  2911  ")).toBe(false);
    });

    it("should return fresh array instances to protect against external mutation", () => {
      const unknown1 = canonicalGetInterfaces("NONEXISTENT_1");
      const unknown2 = canonicalGetInterfaces("NONEXISTENT_2");
      expect(unknown1).toEqual([]);
      expect(unknown1).not.toBe(unknown2);

      unknown1.push("MUTATED_INTERFACE");
      expect(canonicalGetInterfaces("NONEXISTENT_1")).toEqual([]);

      const models1 = canonicalListModelsWithInterfaces();
      const models2 = canonicalListModelsWithInterfaces();
      expect(models1).toEqual(models2);
      expect(models1).not.toBe(models2);

      const links1 = canonicalListLinkTypes();
      const links2 = canonicalListLinkTypes();
      expect(links1).toEqual(links2);
      expect(links1).not.toBe(links2);
    });
  });
});
