import { describe, it, expect } from "vitest";
import { resolveDescriptorFormat } from "../../../src/tui/engine/client-descriptor.js";
import { createMcpServersDescriptor } from "../../../src/tui/clients/descriptors/create-mcp-servers-descriptor.js";
import { cursorDescriptor, cursorClient } from "../../../src/tui/clients/cursor.js";
import { geminiDescriptor, geminiClient } from "../../../src/tui/clients/gemini.js";
import { windsurfDescriptor, windsurfClient } from "../../../src/tui/clients/windsurf.js";
import { kimiDescriptor, kimiClient } from "../../../src/tui/clients/kimi.js";
import { kiroDescriptor, kiroClient } from "../../../src/tui/clients/kiro.js";
import { qwenDescriptor, qwenClient } from "../../../src/tui/clients/qwen.js";
import { antigravityDescriptor, antigravityClient } from "../../../src/tui/clients/antigravity.js";
import { cursorDescriptor as rawCursor } from "../../../src/tui/clients/descriptors/cursor.js";
import { geminiDescriptor as rawGemini } from "../../../src/tui/clients/descriptors/gemini.js";
import { windsurfDescriptor as rawWindsurf } from "../../../src/tui/clients/descriptors/windsurf.js";
import { kimiDescriptor as rawKimi } from "../../../src/tui/clients/descriptors/kimi.js";
import { kiroDescriptor as rawKiro } from "../../../src/tui/clients/descriptors/kiro.js";
import { qwenDescriptor as rawQwen } from "../../../src/tui/clients/descriptors/qwen.js";
import { antigravityDescriptor as rawAntigravity } from "../../../src/tui/clients/descriptors/antigravity.js";
import { opencodeDescriptor } from "../../../src/tui/clients/descriptors/opencode.js";
import { kilocodeDescriptor } from "../../../src/tui/clients/descriptors/kilocode.js";
import { vscodeDescriptor } from "../../../src/tui/clients/descriptors/vscode.js";
import { claudeDescriptor } from "../../../src/tui/clients/descriptors/claude.js";
import { codexDescriptor } from "../../../src/tui/clients/descriptors/codex.js";

describe("ClientDescriptor format contract & standard descriptor modules", () => {
  const allDescriptors = [
    cursorDescriptor,
    geminiDescriptor,
    windsurfDescriptor,
    kimiDescriptor,
    kiroDescriptor,
    qwenDescriptor,
    antigravityDescriptor,
    opencodeDescriptor,
    kilocodeDescriptor,
    vscodeDescriptor,
    claudeDescriptor,
    codexDescriptor,
  ];

  it("enforces that all 12 client descriptors declare an explicit, valid format", () => {
    const validFormats = new Set(["mcpServers", "mcp", "servers", "custom"]);
    expect(allDescriptors).toHaveLength(12);
    for (const d of allDescriptors) {
      expect(d.format).toBeDefined();
      expect(typeof d.format).toBe("string");
      expect(validFormats.has(d.format)).toBe(true);
      expect(resolveDescriptorFormat(d)).toBe(d.format);
    }
  });

  it("re-exports identical descriptor instances between descriptors/ and façades", () => {
    expect(cursorDescriptor).toBe(rawCursor);
    expect(geminiDescriptor).toBe(rawGemini);
    expect(windsurfDescriptor).toBe(rawWindsurf);
    expect(kimiDescriptor).toBe(rawKimi);
    expect(kiroDescriptor).toBe(rawKiro);
    expect(qwenDescriptor).toBe(rawQwen);
    expect(antigravityDescriptor).toBe(rawAntigravity);
  });

  it("instantiates functioning MCPClient instances from façades", () => {
    const clients = [
      cursorClient,
      geminiClient,
      windsurfClient,
      kimiClient,
      kiroClient,
      qwenClient,
      antigravityClient,
    ];
    for (const c of clients) {
      expect(typeof c.id).toBe("string");
      expect(typeof c.name).toBe("string");
      expect(typeof c.detect).toBe("function");
      expect(typeof c.configPath).toBe("function");
      expect(typeof c.inject).toBe("function");
    }
  });

  it("createMcpServersDescriptor sets format: 'mcpServers' and expected patch/verify", () => {
    const desc = createMcpServersDescriptor({
      id: "custom-std",
      name: "Custom Standard",
      resolveConfigPath: () => "/path/test.json",
      allowMissing: true,
    });
    expect(desc.format).toBe("mcpServers");
    expect(desc.initial?.()).toEqual({});
    const patched = desc.patch({}, { projectPath: "/p", scriptPath: "/p/dist/index.js" }) as Record<string, unknown>;
    expect(patched).toEqual({
      mcpServers: {
        MCP_PTB: { command: "node", args: ["/p/dist/index.js"] },
      },
    });
    expect(desc.verify?.(patched)).toBe(true);
    expect(desc.verify?.({})).toBe(false);
  });
});
