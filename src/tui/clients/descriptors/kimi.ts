import { homedir } from "node:os";
import { join } from "node:path";
import { createMcpServersDescriptor } from "./create-mcp-servers-descriptor.js";

export const kimiDescriptor = createMcpServersDescriptor({
  id: "kimi",
  name: "Kimi",
  resolveConfigPath: () => join(homedir(), ".kimi", "mcp.json"),
  allowMissing: true,
});
