import { injectClient } from "../engine/inject-client.js";
import { kiroDescriptor } from "./descriptors/kiro.js";
import type { MCPClient } from "./types.js";

export { kiroDescriptor };
export const kiroClient: MCPClient = injectClient(kiroDescriptor);
