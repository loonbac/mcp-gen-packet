import { injectClient } from "../engine/inject-client.js";
import { qwenDescriptor } from "./descriptors/qwen.js";
import type { MCPClient } from "./types.js";

export { qwenDescriptor };
export const qwenClient: MCPClient = injectClient(qwenDescriptor);
