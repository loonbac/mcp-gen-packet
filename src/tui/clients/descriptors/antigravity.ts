import { homedir } from "node:os";
import { join } from "node:path";
import { createMcpServersDescriptor } from "./create-mcp-servers-descriptor.js";

export const antigravityDescriptor = createMcpServersDescriptor({
  id: "antigravity",
  name: "Antigravity",
  resolveConfigPath: () => join(homedir(), ".gemini", "antigravity", "mcp_config.json"),
  allowMissing: true,
});
