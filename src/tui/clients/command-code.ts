import { injectClient } from "../engine/inject-client.js";
import { commandCodeDescriptor } from "./descriptors/command-code.js";
import type { MCPClient } from "./types.js";

export { commandCodeDescriptor };
export const commandCodeClient: MCPClient = injectClient(commandCodeDescriptor);
