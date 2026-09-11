import { injectClient } from "../engine/inject-client.js";
import { opencodeDescriptor } from "./descriptors/opencode.js";
import type { MCPClient } from "./types.js";

export { opencodeDescriptor };
export const opencodeClient: MCPClient = injectClient(opencodeDescriptor);
