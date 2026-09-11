import { homedir } from "node:os";
import { join } from "node:path";
import { createMcpServersDescriptor } from "./create-mcp-servers-descriptor.js";

export const qwenDescriptor = createMcpServersDescriptor({
  id: "qwen",
  name: "Qwen Code",
  resolveConfigPath: () => join(homedir(), ".qwen", "settings.json"),
  allowMissing: true,
});
