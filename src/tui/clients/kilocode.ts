import { injectClient } from "../engine/inject-client.js";
import { kilocodeDescriptor } from "./descriptors/kilocode.js";
import type { MCPClient } from "./types.js";

export { kilocodeDescriptor };
export const kilocodeClient: MCPClient = injectClient(kilocodeDescriptor);
