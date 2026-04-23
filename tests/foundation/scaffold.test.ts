import { readFileSync, existsSync } from "fs";
import { resolve, join } from "path";
import { describe, it, expect } from "vitest";

// Use process.cwd() for reliable cross-platform path resolution
const PROJECT_ROOT = process.cwd();

function getPkgJson() {
  const pkgPath = resolve(PROJECT_ROOT, "package.json");
  return JSON.parse(readFileSync(pkgPath, "utf-8"));
}

describe("1.1 Scaffold Verification", () => {
  describe("package.json", () => {
    it('should exist with correct name "MCP-PTB"', () => {
      const pkg = getPkgJson();
      expect(pkg.name).toBe("MCP-PTB");
    });

    it('should have correct author "loonbac21 <joshuarosalesmoreno@hotmail.com>"', () => {
      const pkg = getPkgJson();
      expect(pkg.author).toBe("loonbac21 <joshuarosalesmoreno@hotmail.com>");
    });

    it("should have correct scripts (test, build, dev)", () => {
      const pkg = getPkgJson();
      expect(pkg.scripts).toBeDefined();
      expect(pkg.scripts.test).toBeDefined();
      expect(pkg.scripts.build).toBeDefined();
      expect(pkg.scripts.dev).toBeDefined();
    });
  });

  describe("tsconfig.json", () => {
    it("should exist with strict mode enabled", () => {
      const tsconfigPath = resolve(PROJECT_ROOT, "tsconfig.json");
      const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf-8"));
      expect(tsconfig.compilerOptions.strict).toBe(true);
    });
  });

  describe("vitest.config.ts", () => {
    it("should exist and be configured", () => {
      const vitestConfigPath = resolve(PROJECT_ROOT, "vitest.config.ts");
      expect(existsSync(vitestConfigPath)).toBe(true);
      const content = readFileSync(vitestConfigPath, "utf-8");
      expect(content).toContain("defineConfig");
      expect(content).toContain("test");
    });
  });

  describe("npm packages", () => {
    it("should install successfully (node_modules exists)", () => {
      const nodeModulesPath = resolve(PROJECT_ROOT, "node_modules");
      expect(existsSync(nodeModulesPath)).toBe(true);
    });
  });
});