import { injectClient } from "../engine/inject-client.js";
import { windsurfDescriptor } from "./descriptors/windsurf.js";
import type { MCPClient } from "./types.js";

export { windsurfDescriptor };
export const windsurfClient: MCPClient = injectClient(windsurfDescriptor);
