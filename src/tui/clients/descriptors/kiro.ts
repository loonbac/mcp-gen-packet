import { homedir } from "node:os";
import { join } from "node:path";
import { createMcpServersDescriptor } from "./create-mcp-servers-descriptor.js";

export const kiroDescriptor = createMcpServersDescriptor({
  id: "kiro",
  name: "Kiro IDE",
  resolveConfigPath: () => join(homedir(), ".kiro", "settings", "mcp.json"),
  allowMissing: true,
});
