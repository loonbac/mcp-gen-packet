import { injectClient } from "../engine/inject-client.js";
import { kimiDescriptor } from "./descriptors/kimi.js";
import type { MCPClient } from "./types.js";

export { kimiDescriptor };
export const kimiClient: MCPClient = injectClient(kimiDescriptor);
