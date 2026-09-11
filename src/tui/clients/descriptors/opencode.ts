import { homedir } from "node:os";
import { join } from "node:path";
import { createLocalMcpDescriptor } from "./create-local-mcp-descriptor.js";

export const opencodeDescriptor = createLocalMcpDescriptor({
  id: "opencode",
  name: "OpenCode",
  resolveConfigPath: () => join(homedir(), ".config", "opencode", "opencode.json"),
});
