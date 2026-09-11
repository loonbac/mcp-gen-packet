import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { backupFile } from "../../../../src/core/utils/fs/backup-file.js";

describe("backupFile", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "mcp-backup-test-"));
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("creates a byte-identical .bak file and returns backup path by default", () => {
    const filePath = join(testDir, "config.json");
    const content = JSON.stringify({ active: true, name: "test-node" }, null, 2);
    writeFileSync(filePath, content, "utf-8");

    const backupPath = backupFile(filePath);

    expect(backupPath).toBe(`${filePath}.bak`);
    expect(existsSync(backupPath)).toBe(true);
    expect(readFileSync(backupPath, "utf-8")).toBe(content);
    expect(readFileSync(filePath, "utf-8")).toBe(content);
  });

  it("supports custom backup suffix", () => {
    const filePath = join(testDir, "app.conf");
    const content = "PORT=8080\nDEBUG=true\n";
    writeFileSync(filePath, content, "utf-8");

    const backupPath = backupFile(filePath, ".custom.bak");

    expect(backupPath).toBe(`${filePath}.custom.bak`);
    expect(existsSync(backupPath)).toBe(true);
    expect(readFileSync(backupPath, "utf-8")).toBe(content);
  });

  it("throws a descriptive error with exact message fidelity when source file does not exist", () => {
    const nonExistentPath = join(testDir, "does-not-exist.json");

    expect(() => backupFile(nonExistentPath)).toThrowError(
      `No existe el archivo fuente: ${nonExistentPath}`,
    );
  });

  it("creates parent directories recursively if destination path includes non-existent subdirectories", () => {
    const subDir = join(testDir, "nested", "level1", "level2");
    mkdirSync(subDir, { recursive: true });
    const filePath = join(subDir, "settings.json");
    writeFileSync(filePath, '{"key": "value"}', "utf-8");

    // Suffix that introduces additional nested directory
    const suffixWithSubdir = ".sub/backup.bak";
    const backupPath = backupFile(filePath, suffixWithSubdir);

    expect(backupPath).toBe(`${filePath}${suffixWithSubdir}`);
    expect(existsSync(backupPath)).toBe(true);
    expect(readFileSync(backupPath, "utf-8")).toBe('{"key": "value"}');
  });

  it("preserves exact binary byte contents without modification", () => {
    const filePath = join(testDir, "binary.dat");
    const binaryData = Buffer.from([0x00, 0xff, 0x42, 0x13, 0x37, 0x00, 0xaa]);
    writeFileSync(filePath, binaryData);

    const backupPath = backupFile(filePath);

    expect(existsSync(backupPath)).toBe(true);
    const backupData = readFileSync(backupPath);
    expect(Buffer.compare(binaryData, backupData)).toBe(0);
  });

  it("writes provided in-memory snapshot without extra source reads", () => {
    const filePath = join(testDir, "snapshot-test.json");
    // Target file on disk has original content
    writeFileSync(filePath, '{"disk": true}', "utf-8");

    const customSnapshot = '{"inMemorySnapshot": 123}';
    const backupPath = backupFile(filePath, ".custom.bak", customSnapshot);

    expect(backupPath).toBe(`${filePath}.custom.bak`);
    expect(existsSync(backupPath)).toBe(true);
    // Backup contains the snapshot content, NOT the disk content
    expect(readFileSync(backupPath, "utf-8")).toBe(customSnapshot);
    // Target file on disk remains unchanged
    expect(readFileSync(filePath, "utf-8")).toBe('{"disk": true}');
  });
});
