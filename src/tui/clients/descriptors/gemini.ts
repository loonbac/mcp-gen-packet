import { homedir } from "node:os";
import { join } from "node:path";
import { createMcpServersDescriptor } from "./create-mcp-servers-descriptor.js";

export const geminiDescriptor = createMcpServersDescriptor({
  id: "gemini",
  name: "Gemini CLI",
  resolveConfigPath: () => join(homedir(), ".gemini", "settings.json"),
});
