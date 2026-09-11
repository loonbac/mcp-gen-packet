import { injectClient } from "../engine/inject-client.js";
import { claudeDescriptor } from "./descriptors/claude.js";
import type { MCPClient } from "./types.js";

export { claudeDescriptor };
export const claudeClient: MCPClient = injectClient(claudeDescriptor);
