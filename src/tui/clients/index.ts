import type { MCPClient } from "./types.js";
import { opencodeClient } from "./opencode.js";
import { claudeClient } from "./claude.js";
import { vscodeClient } from "./vscode.js";
import { cursorClient } from "./cursor.js";
import { geminiClient } from "./gemini.js";
import { codexClient } from "./codex.js";
import { windsurfClient } from "./windsurf.js";
import { kilocodeClient } from "./kilocode.js";
import { kimiClient } from "./kimi.js";
import { kiroClient } from "./kiro.js";
import { qwenClient } from "./qwen.js";
import { antigravityClient } from "./antigravity.js";

export const ALL_CLIENTS: MCPClient[] = [
  opencodeClient,
  claudeClient,
  vscodeClient,
  cursorClient,
  geminiClient,
  codexClient,
  windsurfClient,
  kilocodeClient,
  kimiClient,
  kiroClient,
  qwenClient,
  antigravityClient,
];

export function getAvailableClients(): MCPClient[] {
  return ALL_CLIENTS.filter((c) => c.detect());
}
