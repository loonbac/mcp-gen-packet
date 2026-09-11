import { describe, it, expect, vi } from "vitest";
import { formatJsonResource } from "../../src/server/handlers/resources/format-resource.js";
import {
  DEVICES_RESOURCE_URI,
  DEVICES_RESOURCE_NAME,
  readDevicesResource,
} from "../../src/server/handlers/resources/devices-resource.js";
import {
  MODULES_RESOURCE_URI,
  MODULES_RESOURCE_NAME,
  readModulesResource,
} from "../../src/server/handlers/resources/modules-resource.js";
import {
  LINKS_RESOURCE_URI,
  LINKS_RESOURCE_NAME,
  readLinksResource,
} from "../../src/server/handlers/resources/links-resource.js";
import {
  INTERFACES_RESOURCE_URI,
  INTERFACES_RESOURCE_NAME,
  readInterfacesResource,
} from "../../src/server/handlers/resources/interfaces-resource.js";
import { registerCatalogResources } from "../../src/server/handlers/resources/register-resources.js";
import { deviceCatalog } from "../../src/catalogs/data/device-data.js";
import { moduleCatalog } from "../../src/catalogs/data/module-data.js";
import { linkTypeCatalog } from "../../src/catalogs/data/link-data.js";
import { modelInterfaces } from "../../src/catalogs/data/interface-data.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

describe("S5c: Dedicated MCP Resource Handlers & JSON Serialization", () => {
  describe("formatJsonResource", () => {
    it("formats data into an SDK ReadResourceResult envelope with 2-space pretty JSON", () => {
      const uri = "pt://catalog/test";
      const payload = { a: 1, b: "hello" };
      const result = formatJsonResource(uri, payload);

      expect(result).toEqual({
        contents: [
          {
            uri: "pt://catalog/test",
            mimeType: "application/json",
            text: JSON.stringify(payload, null, 2),
          },
        ],
      });
    });

    it("preserves exact URI and application/json MIME type", () => {
      const uri = "pt://catalog/custom-uri";
      const result = formatJsonResource(uri, [1, 2, 3]);

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe(uri);
      expect(result.contents[0].mimeType).toBe("application/json");
      expect(JSON.parse(result.contents[0].text)).toEqual([1, 2, 3]);
    });

    it("handles primitives, null, and empty collections correctly", () => {
      expect(formatJsonResource("uri://null", null).contents[0].text).toBe("null");
      expect(formatJsonResource("uri://empty-arr", []).contents[0].text).toBe("[]");
      expect(formatJsonResource("uri://empty-obj", {}).contents[0].text).toBe("{}");
    });
  });

  describe("devices-resource", () => {
    it("exports canonical URI and name constants", () => {
      expect(DEVICES_RESOURCE_URI).toBe("pt://catalog/devices");
      expect(DEVICES_RESOURCE_NAME).toBe("Device catalog from PTBuilder");
    });

    it("readDevicesResource returns formatted device snapshot matching deviceCatalog", async () => {
      const result = await readDevicesResource();
      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe(DEVICES_RESOURCE_URI);
      expect(result.contents[0].mimeType).toBe("application/json");

      const parsed = JSON.parse(result.contents[0].text);
      const expected = [...deviceCatalog.values()].map((entry) => ({
        model: entry.model,
        typeId: entry.typeId,
        category: entry.category,
      }));

      expect(parsed).toEqual(expected);
      expect(parsed.length).toBe(deviceCatalog.size);
      expect(parsed.length).toBeGreaterThan(140);
      expect(parsed[0]).toEqual({
        model: "802",
        typeId: 34,
        category: "other",
      });
    });

    it("returns consistent results on concurrent calls without shared mutation", async () => {
      const [res1, res2] = await Promise.all([
        readDevicesResource(),
        readDevicesResource(),
      ]);
      expect(res1).toEqual(res2);
      expect(res1.contents).not.toBe(res2.contents);
    });
  });

  describe("modules-resource", () => {
    it("exports canonical URI and name constants", () => {
      expect(MODULES_RESOURCE_URI).toBe("pt://catalog/modules");
      expect(MODULES_RESOURCE_NAME).toBe("Module catalog from PTBuilder");
    });

    it("readModulesResource returns formatted module snapshot matching moduleCatalog", async () => {
      const result = await readModulesResource();
      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe(MODULES_RESOURCE_URI);
      expect(result.contents[0].mimeType).toBe("application/json");

      const parsed = JSON.parse(result.contents[0].text);
      const expected = [...moduleCatalog.values()].map((entry) => ({
        model: entry.model,
        typeId: entry.typeId,
      }));

      expect(parsed).toEqual(expected);
      expect(parsed.length).toBe(moduleCatalog.size);
      expect(parsed.length).toBeGreaterThan(50);
      expect(parsed[0]).toEqual({
        model: "NM-1E",
        typeId: 1,
      });
    });

    it("returns consistent results on concurrent calls without shared mutation", async () => {
      const [res1, res2] = await Promise.all([
        readModulesResource(),
        readModulesResource(),
      ]);
      expect(res1).toEqual(res2);
      expect(res1.contents).not.toBe(res2.contents);
    });
  });

  describe("links-resource", () => {
    it("exports canonical URI and name constants", () => {
      expect(LINKS_RESOURCE_URI).toBe("pt://catalog/links");
      expect(LINKS_RESOURCE_NAME).toBe("Link types catalog from PTBuilder");
    });

    it("readLinksResource returns formatted link types snapshot with alias duplicates", async () => {
      const result = await readLinksResource();
      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe(LINKS_RESOURCE_URI);
      expect(result.contents[0].mimeType).toBe("application/json");

      const parsed = JSON.parse(result.contents[0].text);
      const expected = [...linkTypeCatalog.values()].map((entry) => ({
        name: entry.name,
        id: entry.id,
        aliases: entry.aliases,
      }));

      expect(parsed).toEqual(expected);
      expect(parsed.length).toBe(linkTypeCatalog.size);
      // Verify duplicate entries indexed by alias are preserved
      const straightEntries = parsed.filter(
        (e: { name: string }) => e.name === "straight",
      );
      expect(straightEntries.length).toBeGreaterThanOrEqual(2);
    });

    it("returns consistent results on concurrent calls without shared mutation", async () => {
      const [res1, res2] = await Promise.all([
        readLinksResource(),
        readLinksResource(),
      ]);
      expect(res1).toEqual(res2);
      expect(res1.contents).not.toBe(res2.contents);
    });
  });

  describe("interfaces-resource", () => {
    it("exports canonical URI and name constants", () => {
      expect(INTERFACES_RESOURCE_URI).toBe("pt://catalog/interfaces");
      expect(INTERFACES_RESOURCE_NAME).toBe("Interface map from PTBuilder");
    });

    it("readInterfacesResource returns formatted interface dictionary matching modelInterfaces", async () => {
      const result = await readInterfacesResource();
      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe(INTERFACES_RESOURCE_URI);
      expect(result.contents[0].mimeType).toBe("application/json");

      const parsed: Record<string, string[]> = JSON.parse(result.contents[0].text);
      const expected: Record<string, string[]> = {};
      for (const [model, ifaces] of modelInterfaces.entries()) {
        expected[model] = ifaces;
      }

      expect(parsed).toEqual(expected);
      expect(Object.keys(parsed).length).toBe(modelInterfaces.size);
      for (const [model, ifaces] of modelInterfaces.entries()) {
        expect(parsed[model]).toEqual(ifaces);
      }
    });

    it("returns consistent results on concurrent calls without shared mutation", async () => {
      const [res1, res2] = await Promise.all([
        readInterfacesResource(),
        readInterfacesResource(),
      ]);
      expect(res1).toEqual(res2);
      expect(res1.contents).not.toBe(res2.contents);
    });
  });

  describe("registerCatalogResources", () => {
    it("calls server.resource exactly 4 times in devices, modules, links, interfaces order", () => {
      const mockResource = vi.fn();
      const mockServer = {
        resource: mockResource,
      } as unknown as McpServer;

      registerCatalogResources(mockServer);

      expect(mockResource).toHaveBeenCalledTimes(4);

      expect(mockResource).toHaveBeenNthCalledWith(
        1,
        DEVICES_RESOURCE_NAME,
        DEVICES_RESOURCE_URI,
        readDevicesResource,
      );

      expect(mockResource).toHaveBeenNthCalledWith(
        2,
        MODULES_RESOURCE_NAME,
        MODULES_RESOURCE_URI,
        readModulesResource,
      );

      expect(mockResource).toHaveBeenNthCalledWith(
        3,
        LINKS_RESOURCE_NAME,
        LINKS_RESOURCE_URI,
        readLinksResource,
      );

      expect(mockResource).toHaveBeenNthCalledWith(
        4,
        INTERFACES_RESOURCE_NAME,
        INTERFACES_RESOURCE_URI,
        readInterfacesResource,
      );
    });

    it("successfully registers resources on a real McpServer instance without error", () => {
      const realServer = new McpServer({
        name: "test-server",
        version: "1.0.0",
      });

      expect(() => registerCatalogResources(realServer)).not.toThrow();
    });
  });
});
