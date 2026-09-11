import { injectClient } from "../engine/inject-client.js";
import { geminiDescriptor } from "./descriptors/gemini.js";
import type { MCPClient } from "./types.js";

export { geminiDescriptor };
export const geminiClient: MCPClient = injectClient(geminiDescriptor);
