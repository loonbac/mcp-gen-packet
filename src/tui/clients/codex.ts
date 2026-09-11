import { injectClient } from "../engine/inject-client.js";
import { codexDescriptor } from "./descriptors/codex.js";
import type { MCPClient } from "./types.js";

export { codexDescriptor } from "./descriptors/codex.js";

export const codexClient: MCPClient = injectClient(codexDescriptor);
