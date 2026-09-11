import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { injectClient } from "../../../src/tui/engine/inject-client.js";
import type { ClientDescriptor, ClientConfig } from "../../../src/tui/engine/client-descriptor.js";

describe("injectClient engine", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "mcp-inject-engine-test-"));
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("instantiates pure client factory with zero filesystem I/O at construction time", () => {
    const resolveSpy = vi.fn(() => join(testDir, "never-read.json"));
    const descriptor: ClientDescriptor = {
      id: "mock-client",
      name: "Mock Client",
      resolveConfigPath: resolveSpy,
      patch: (c) => c,
    };

    const client = injectClient(descriptor);

    expect(client.id).toBe("mock-client");
    expect(client.name).toBe("Mock Client");
    // Construction MUST NOT perform filesystem I/O or resolve path immediately
    expect(resolveSpy).not.toHaveBeenCalled();
  });

  it("detect() returns false when resolveConfigPath returns null", () => {
    const descriptor: ClientDescriptor = {
      id: "null-client",
      name: "Null Client",
      resolveConfigPath: () => null,
      patch: (c) => c,
    };

    const client = injectClient(descriptor);

    expect(client.detect()).toBe(false);
  });

  it("detect() delegates to existsSync or custom detector", () => {
    const configPath = join(testDir, "detect-test.json");
    const descriptor: ClientDescriptor = {
      id: "detect-client",
      name: "Detect Client",
      resolveConfigPath: () => configPath,
      patch: (c) => c,
    };

    const client = injectClient(descriptor);

    expect(client.detect()).toBe(false);

    writeFileSync(configPath, "{}", "utf-8");
    expect(client.detect()).toBe(true);

    // Custom detector override
    const customDetectorClient = injectClient({
      ...descriptor,
      detect: () => false,
    });
    expect(customDetectorClient.detect()).toBe(false);
  });

  it("configPath() invokes descriptor resolver dynamically", () => {
    let dynamicPath = "/path/one.json";
    const descriptor: ClientDescriptor = {
      id: "dynamic-client",
      name: "Dynamic Client",
      resolveConfigPath: () => dynamicPath,
      patch: (c) => c,
    };

    const client = injectClient(descriptor);

    expect(client.configPath()).toBe("/path/one.json");
    dynamicPath = "/path/two.json";
    expect(client.configPath()).toBe("/path/two.json");
  });

  it("inject(projectPath) normalizes scriptPath, cleans stale keys, patches, verifies, and creates backup", async () => {
    const configPath = join(testDir, "standard-mcp.json");
    const initialConfig = {
      mcp: { MCP_PTB: { command: "stale" } },
      mcpServers: {
        MCP_PTB: { command: "stale-node" },
        otherServer: { command: "python" },
      },
      servers: { MCP_PTB: { cwd: "old" } },
    };
    writeFileSync(configPath, JSON.stringify(initialConfig, null, 2), "utf-8");

    const descriptor: ClientDescriptor = {
      id: "std-client",
      name: "Standard Client",
      resolveConfigPath: () => configPath,
      patch: (current, { scriptPath }) => {
        const conf = current as Record<string, Record<string, unknown>>;
        if (!conf.mcpServers) conf.mcpServers = {};
        conf.mcpServers.MCP_PTB = {
          command: "node",
          args: [scriptPath],
        };
        return conf;
      },
      verify: (conf) => {
        const mcpServers = (conf as Record<string, Record<string, unknown>>).mcpServers;
        return Boolean(mcpServers?.MCP_PTB);
      },
    };

    const client = injectClient(descriptor);
    // Use windows-style backslashes in project path to test forward-slash normalization
    const result = await client.inject("C:\\Users\\User\\project");

    expect(result.success).toBe(true);
    expect(result.backup).toBe(`${configPath}.bak`);

    const updated = JSON.parse(readFileSync(configPath, "utf-8"));
    // Stale keys removed
    expect(updated.mcp?.MCP_PTB).toBeUndefined();
    expect(updated.servers?.MCP_PTB).toBeUndefined();
    // Sibling preserved
    expect(updated.mcpServers.otherServer).toEqual({ command: "python" });
    // Injected payload with normalized forward slashes
    expect(updated.mcpServers.MCP_PTB).toEqual({
      command: "node",
      args: ["C:/Users/User/project/dist/index.js"],
    });

    // Backup verified
    const backupContent = JSON.parse(readFileSync(`${configPath}.bak`, "utf-8"));
    expect(backupContent).toEqual(initialConfig);
  });

  it("creates parent directory when ensureDir is true", async () => {
    const nestedDir = join(testDir, "deeply", "nested", "mcp");
    const configPath = join(nestedDir, "MCP_PTB.json");

    const descriptor: ClientDescriptor = {
      id: "nested-client",
      name: "Nested Client",
      resolveConfigPath: () => configPath,
      ensureDir: true,
      initial: () => ({}),
      patch: (_current, { scriptPath }) => ({
        command: "node",
        args: [scriptPath],
      }),
      verify: (conf) => Boolean(conf.command && conf.args),
    };

    const client = injectClient(descriptor);
    const result = await client.inject("/workspace/project");

    expect(result.success).toBe(true);
    expect(existsSync(configPath)).toBe(true);
    const written = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(written).toEqual({
      command: "node",
      args: ["/workspace/project/dist/index.js"],
    });
  });

  it("captures errors cleanly and returns { success: false, error } without unhandled rejections", async () => {
    const missingPath = join(testDir, "does-not-exist.json");

    const descriptor: ClientDescriptor = {
      id: "missing-client",
      name: "Missing Client",
      resolveConfigPath: () => missingPath,
      // No initial factory, so missing file will cause read failure
      patch: (c) => c,
    };

    const client = injectClient(descriptor);
    const result = await client.inject("/workspace/project");

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(typeof result.error).toBe("string");
  });

  it("returns error when configPath resolves to null", async () => {
    const descriptor: ClientDescriptor = {
      id: "unsupported-client",
      name: "Unsupported Client",
      resolveConfigPath: () => null,
      patch: (c) => c,
    };

    const client = injectClient(descriptor);
    const result = await client.inject("/workspace/project");

    expect(result.success).toBe(false);
    expect(result.error).toContain("No se pudo resolver");
  });

  it("triangulates verification predicate failure and rolls back target", async () => {
    const configPath = join(testDir, "verify-fail-client.json");
    writeFileSync(configPath, JSON.stringify({ original: true }), "utf-8");

    const descriptor: ClientDescriptor = {
      id: "failing-verify-client",
      name: "Failing Verify Client",
      resolveConfigPath: () => configPath,
      patch: (c) => ({ ...c, modified: true }),
      verify: () => false,
    };

    const client = injectClient(descriptor);
    const result = await client.inject("/workspace/project");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Verificación fallida");
    // Target file is preserved with original content
    expect(JSON.parse(readFileSync(configPath, "utf-8"))).toEqual({ original: true });
  });

  it("triangulates custom serializer (e.g. TOML / KV) with codec exceptions", async () => {
    const configPath = join(testDir, "codec-test.txt");
    writeFileSync(configPath, "corrupt content", "utf-8");

    const descriptor: ClientDescriptor = {
      id: "codec-client",
      name: "Codec Client",
      resolveConfigPath: () => configPath,
      customSerializer: {
        deserialize: () => {
          throw new Error("Syntax error in custom codec parser");
        },
        serialize: (val) => String(val),
      },
      patch: (c) => c,
    };

    const client = injectClient(descriptor);
    const result = await client.inject("/workspace/project");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Syntax error in custom codec parser");
  });

  it("triangulates empty existing file backup and successful injection", async () => {
    const configPath = join(testDir, "empty-config.json");
    writeFileSync(configPath, "{}", "utf-8");

    const descriptor: ClientDescriptor = {
      id: "empty-test-client",
      name: "Empty Test Client",
      resolveConfigPath: () => configPath,
      patch: (c, { scriptPath }) => ({
        ...c,
        mcpServers: {
          MCP_PTB: { command: "node", args: [scriptPath] },
        },
      }),
      verify: (c) => Boolean((c as any).mcpServers?.MCP_PTB),
    };

    const client = injectClient(descriptor);
    const result = await client.inject("/workspace/project");

    expect(result.success).toBe(true);
    expect(result.backup).toBe(`${configPath}.bak`);
    expect(readFileSync(`${configPath}.bak`, "utf-8")).toBe("{}");
    const updated = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(updated.mcpServers.MCP_PTB).toBeDefined();
  });
});
