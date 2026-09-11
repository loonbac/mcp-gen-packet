import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  DEVICES_RESOURCE_NAME,
  DEVICES_RESOURCE_URI,
  readDevicesResource,
} from "./devices-resource.js";
import {
  MODULES_RESOURCE_NAME,
  MODULES_RESOURCE_URI,
  readModulesResource,
} from "./modules-resource.js";
import {
  LINKS_RESOURCE_NAME,
  LINKS_RESOURCE_URI,
  readLinksResource,
} from "./links-resource.js";
import {
  INTERFACES_RESOURCE_NAME,
  INTERFACES_RESOURCE_URI,
  readInterfacesResource,
} from "./interfaces-resource.js";

/**
 * Register all catalog resources on the given McpServer instance.
 */
export function registerCatalogResources(server: McpServer): void {
  server.resource(DEVICES_RESOURCE_NAME, DEVICES_RESOURCE_URI, readDevicesResource);
  server.resource(MODULES_RESOURCE_NAME, MODULES_RESOURCE_URI, readModulesResource);
  server.resource(LINKS_RESOURCE_NAME, LINKS_RESOURCE_URI, readLinksResource);
  server.resource(INTERFACES_RESOURCE_NAME, INTERFACES_RESOURCE_URI, readInterfacesResource);
}
