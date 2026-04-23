import { describe, it, expect, vi, beforeEach } from "vitest";
import { exec } from "node:child_process";
import { runInstall } from "../../src/tui/install.js";

vi.mock("node:child_process", () => ({
  exec: vi.fn(),
}));

vi.mock("node:util", () => ({
  promisify: vi.fn((fn: Function) => {
    return async (...args: any[]) => {
      return new Promise((resolve, reject) => {
        fn(...args, (err: Error | null, result: any) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
    };
  }),
}));

describe("detectSystem", () => {
  it("should return node version >= 18", async () => {
    const { detectSystem } = await import("../../src/tui/detect.js");
    const result = detectSystem();
    
    expect(result.nodeVersion).toBeDefined();
    expect(result.nodeOk).toBe(true);
  });

  it("should return platform and arch info", async () => {
    const { detectSystem } = await import("../../src/tui/detect.js");
    const result = detectSystem();
    
    expect(result.platform).toBeDefined();
    expect(result.arch).toBeDefined();
  });
});

describe("runInstall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return success on npm install", async () => {
    vi.mocked(exec).mockImplementation((cmd: string, opts: any, cb?: any) => {
      if (cb) cb(null, { stdout: "", stderr: "" });
      return {} as any;
    });

    const result = await runInstall();
    expect(result.success).toBe(true);
  });

  it("should return error on npm install failure", async () => {
    vi.mocked(exec).mockImplementation((cmd: string, opts: any, cb?: any) => {
      if (cb) cb(new Error("npm install failed"));
      return {} as any;
    });

    const result = await runInstall();
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});