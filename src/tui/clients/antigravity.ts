import { injectClient } from "../engine/inject-client.js";
import { antigravityDescriptor } from "./descriptors/antigravity.js";
import type { MCPClient } from "./types.js";

export { antigravityDescriptor };
export const antigravityClient: MCPClient = injectClient(antigravityDescriptor);
