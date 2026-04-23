// ── Primitive Tools Index ──

export { addDeviceTool, AddDeviceSchema } from "./add-device.js";
export { addLinkTool, AddLinkSchema } from "./add-link.js";
export { addModuleTool, AddModuleSchema } from "./add-module.js";
export { configurePcIpTool, ConfigurePcIpSchema } from "./configure-pc-ip.js";
export { configureIosDeviceTool, ConfigureIosDeviceSchema } from "./configure-ios-device.js";
export { getDevicesTool, GetDevicesSchema } from "./get-devices.js";
export { ptBridgeConnectTool, PtBridgeConnectSchema } from "./bridge-connect.js";

import { addDeviceTool } from "./add-device.js";
import { addLinkTool } from "./add-link.js";
import { addModuleTool } from "./add-module.js";
import { configurePcIpTool } from "./configure-pc-ip.js";
import { configureIosDeviceTool } from "./configure-ios-device.js";
import { getDevicesTool } from "./get-devices.js";
import { ptBridgeConnectTool } from "./bridge-connect.js";

import type { BridgeAdapter } from "../../bridge/adapter.js";
import type { ToolResult } from "../../types/protocol.js";

// Tool definition with execute signature
export interface Tool {
  name: string;
  description: string;
  inputSchema: unknown;
  execute(bridge: BridgeAdapter, params: unknown): Promise<ToolResult>;
}

// All primitive tools as an array
export const primitiveTools: Tool[] = [
  addDeviceTool,
  addLinkTool,
  addModuleTool,
  configurePcIpTool,
  configureIosDeviceTool,
  getDevicesTool,
  ptBridgeConnectTool,
];

// Lookup function
export function getToolByName(name: string): Tool | undefined {
  return primitiveTools.find((t) => t.name === name);
}