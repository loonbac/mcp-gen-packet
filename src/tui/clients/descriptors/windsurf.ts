import { homedir } from "node:os";
import { join } from "node:path";
import { createMcpServersDescriptor } from "./create-mcp-servers-descriptor.js";

export const windsurfDescriptor = createMcpServersDescriptor({
  id: "windsurf",
  name: "Windsurf",
  resolveConfigPath: () => join(homedir(), ".codeium", "windsurf", "mcp_config.json"),
  allowMissing: true,
});
