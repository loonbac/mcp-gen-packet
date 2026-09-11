import { homedir } from "node:os";
import { join } from "node:path";
import { createLocalMcpDescriptor } from "./create-local-mcp-descriptor.js";

export const kilocodeDescriptor = createLocalMcpDescriptor({
  id: "kilocode",
  name: "Kilocode",
  resolveConfigPath: () => join(homedir(), ".config", "kilo", "opencode.json"),
  allowMissing: true,
});
