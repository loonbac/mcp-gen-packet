import { homedir } from "node:os";
import { join } from "node:path";
import { createMcpServersDescriptor } from "./create-mcp-servers-descriptor.js";

export const cursorDescriptor = createMcpServersDescriptor({
  id: "cursor",
  name: "Cursor",
  resolveConfigPath: () => join(homedir(), ".cursor", "mcp.json"),
});
