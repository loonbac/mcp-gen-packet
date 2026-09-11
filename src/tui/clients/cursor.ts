import { injectClient } from "../engine/inject-client.js";
import { cursorDescriptor } from "./descriptors/cursor.js";
import type { MCPClient } from "./types.js";

export { cursorDescriptor };
export const cursorClient: MCPClient = injectClient(cursorDescriptor);
