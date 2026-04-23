import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface InstallResult {
  success: boolean;
  error?: string;
}

export async function runInstall(): Promise<InstallResult> {
  try {
    // Run npm install in the project directory
    const cwd = process.cwd();
    await execAsync("npm install", { cwd });
    return { success: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { success: false, error };
  }
}