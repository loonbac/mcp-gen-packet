import { injectClient } from "../engine/inject-client.js";
import { vscodeDescriptor } from "./descriptors/vscode.js";
import type { MCPClient } from "./types.js";

export { vscodeDescriptor };
export const vscodeClient: MCPClient = injectClient(vscodeDescriptor);
