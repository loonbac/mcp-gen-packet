import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { patchJsonConfig } from "../../../../src/core/utils/fs/patch-json-config.js";

interface SampleConfig {
  name: string;
  version: number;
  mcpServers?: Record<string, { command: string }>;
}

describe("patchJsonConfig", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "mcp-patch-test-"));
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("successfully patches, creates backup, and verifies JSON config", () => {
    const configPath = join(testDir, "client-config.json");
    const initialConfig: SampleConfig = { name: "test-app", version: 1 };
    writeFileSync(configPath, JSON.stringify(initialConfig, null, 2), "utf-8");

    const result = patchJsonConfig<SampleConfig>(configPath, (current) => ({
      ...current,
      mcpServers: {
        MCP_PTB: { command: "node" },
      },
    }));

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.backup).toBe(`${configPath}.bak`);
    }

    // Original file should be updated with new property
    const updated = JSON.parse(readFileSync(configPath, "utf-8")) as SampleConfig;
    expect(updated.name).toBe("test-app");
    expect(updated.version).toBe(1);
    expect(updated.mcpServers).toEqual({ MCP_PTB: { command: "node" } });

    // Backup file should contain the original config
    const backupContent = JSON.parse(readFileSync(`${configPath}.bak`, "utf-8")) as SampleConfig;
    expect(backupContent).toEqual(initialConfig);

    // No lingering temporary sibling files
    const remainingFiles = readdirSync(testDir);
    expect(remainingFiles).toEqual(
      expect.arrayContaining(["client-config.json", "client-config.json.bak"]),
    );
    expect(remainingFiles.filter((f) => f.includes(".tmp.")).length).toBe(0);
  });

  it("supports custom backup suffix in options", () => {
    const configPath = join(testDir, "custom-suffix.json");
    const initialConfig: SampleConfig = { name: "custom-app", version: 2 };
    writeFileSync(configPath, JSON.stringify(initialConfig, null, 2), "utf-8");

    const result = patchJsonConfig<SampleConfig>(
      configPath,
      (current) => ({ ...current, version: 3 }),
      { backupSuffix: ".snapshot.bak" },
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.backup).toBe(`${configPath}.snapshot.bak`);
      expect(existsSync(`${configPath}.snapshot.bak`)).toBe(true);
      expect(readFileSync(`${configPath}.snapshot.bak`, "utf-8")).toBe(
        JSON.stringify(initialConfig, null, 2),
      );
    }
  });

  it("rolls back and cleans up temp file when verification predicate fails", () => {
    const configPath = join(testDir, "verify-fail.json");
    const initialConfig: SampleConfig = { name: "stable-app", version: 1 };
    writeFileSync(configPath, JSON.stringify(initialConfig, null, 2), "utf-8");

    const result = patchJsonConfig<SampleConfig>(
      configPath,
      (current) => ({ ...current, version: 99 }),
      {
        verify: (written) => written.version === 1, // Will fail because version is 99
      },
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Verificación fallida");
      expect(result.backup).toBe(`${configPath}.bak`);
    }

    // Original config MUST remain unchanged
    const targetContent = JSON.parse(readFileSync(configPath, "utf-8")) as SampleConfig;
    expect(targetContent).toEqual(initialConfig);

    // Temp sibling file MUST be removed
    const remainingFiles = readdirSync(testDir);
    expect(remainingFiles.filter((f) => f.includes(".tmp.")).length).toBe(0);
  });

  it("handles verification predicate throwing exception cleanly", () => {
    const configPath = join(testDir, "verify-throw.json");
    const initialConfig: SampleConfig = { name: "throw-app", version: 1 };
    writeFileSync(configPath, JSON.stringify(initialConfig, null, 2), "utf-8");

    const result = patchJsonConfig<SampleConfig>(
      configPath,
      (current) => ({ ...current, version: 42 }),
      {
        verify: () => {
          throw new Error("Custom validation error occurred");
        },
      },
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Custom validation error occurred");
      expect(result.backup).toBe(`${configPath}.bak`);
    }

    // Target content untouched
    expect(JSON.parse(readFileSync(configPath, "utf-8"))).toEqual(initialConfig);
    // Temp cleaned up
    const remainingFiles = readdirSync(testDir);
    expect(remainingFiles.filter((f) => f.includes(".tmp.")).length).toBe(0);
  });

  it("returns error without corrupting target when JSON is malformed", () => {
    const configPath = join(testDir, "malformed.json");
    const malformedContent = "{ invalid json content missing brackets";
    writeFileSync(configPath, malformedContent, "utf-8");

    const result = patchJsonConfig<SampleConfig>(configPath, (current) => ({
      ...current,
      name: "should-not-reach",
    }));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
      expect(result.backup).toBeUndefined();
    }

    // File content remains unaltered
    expect(readFileSync(configPath, "utf-8")).toBe(malformedContent);

    // No temp file created or lingering
    const remainingFiles = readdirSync(testDir);
    expect(remainingFiles.filter((f) => f.includes(".tmp.")).length).toBe(0);
  });

  it("returns error when target configuration file does not exist", () => {
    const configPath = join(testDir, "missing-file.json");

    const result = patchJsonConfig<SampleConfig>(configPath, (current) => ({
      ...current,
      name: "missing",
    }));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
      expect(result.backup).toBeUndefined();
    }

    expect(existsSync(configPath)).toBe(false);
  });

  it("handles patchFn throwing error cleanly without creating temp file or corrupting target", () => {
    const configPath = join(testDir, "patchfn-throw.json");
    const initialConfig: SampleConfig = { name: "orig", version: 1 };
    writeFileSync(configPath, JSON.stringify(initialConfig, null, 2), "utf-8");

    const result = patchJsonConfig<SampleConfig>(configPath, () => {
      throw new Error("Explosion in patchFn");
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Explosion in patchFn");
      expect(result.backup).toBeUndefined();
    }

    expect(JSON.parse(readFileSync(configPath, "utf-8"))).toEqual(initialConfig);
  });

  it("performs atomic replacement leaving target file intact during validation failure", () => {
    const configPath = join(testDir, "atomic-test.json");
    const initialConfig: SampleConfig = { name: "atomic-check", version: 1 };
    writeFileSync(configPath, JSON.stringify(initialConfig, null, 2), "utf-8");

    // When verification fails, the target file must never have been unlinked or overwritten
    const result = patchJsonConfig<SampleConfig>(
      configPath,
      (current) => ({ ...current, version: 2 }),
      {
        verify: () => false,
      },
    );

    expect(result.success).toBe(false);
    // Target file is preserved continuously with initial content
    expect(existsSync(configPath)).toBe(true);
    expect(JSON.parse(readFileSync(configPath, "utf-8"))).toEqual(initialConfig);
  });

  it("supports initial() factory when configuration file does not exist", () => {
    const configPath = join(testDir, "missing-initial.json");

    const result = patchJsonConfig<SampleConfig>(
      configPath,
      (current) => ({ ...current, name: "initialized" }),
      {
        initial: () => ({ name: "default", version: 1 }),
      },
    );

    expect(result.success).toBe(true);
    expect(existsSync(configPath)).toBe(true);
    const written = JSON.parse(readFileSync(configPath, "utf-8")) as SampleConfig;
    expect(written.name).toBe("initialized");
    expect(written.version).toBe(1);
    if (result.success) {
      // No backup of a non-existent file
      expect(result.backup).toBeUndefined();
    }
  });

  it("supports custom deserialize and serialize codecs", () => {
    const configPath = join(testDir, "custom-codec.txt");
    writeFileSync(configPath, "name=custom\nversion=1\n", "utf-8");

    interface SimpleKv {
      name: string;
      version: number;
    }

    const result = patchJsonConfig<SimpleKv>(
      configPath,
      (current) => ({ ...current, version: current.version + 1 }),
      {
        deserialize: (raw) => {
          const lines = raw.trim().split("\n");
          const map: Record<string, string> = {};
          for (const line of lines) {
            const [k, v] = line.split("=");
            map[k] = v;
          }
          return { name: map.name, version: Number(map.version) };
        },
        serialize: (val) => `name=${val.name}\nversion=${val.version}\n`,
      },
    );

    expect(result.success).toBe(true);
    expect(readFileSync(configPath, "utf-8")).toBe("name=custom\nversion=2\n");
  });

  it("safely probes renameSync and unlinks via Reflect.has, falling back to writeFileSync when renameSync is undefined", () => {
    const configPath = join(testDir, "mock-fallback.json");
    writeFileSync(configPath, JSON.stringify({ name: "mocked", version: 1 }), "utf-8");

    let directWriteCalled = false;
    // Simulate partial mock environment without renameSync or unlinkSync
    const partialFs = {
      existsSync,
      readFileSync,
      writeFileSync: (p: string, data: string, enc: string) => {
        directWriteCalled = true;
        writeFileSync(p, data, enc);
      },
      mkdirSync: () => undefined,
      // Note: renameSync and unlinkSync are deliberately omitted
    };

    const result = patchJsonConfig<SampleConfig>(
      configPath,
      (current) => ({ ...current, name: "updated-via-fallback" }),
      {
        _fs: partialFs as any,
      },
    );

    expect(result.success).toBe(true);
    expect(directWriteCalled).toBe(true);
    const written = JSON.parse(readFileSync(configPath, "utf-8")) as SampleConfig;
    expect(written.name).toBe("updated-via-fallback");
  });
});
