import * as fs from "node:fs";
import { dirname } from "node:path";

/**
 * Copies the file at `targetPath` to a backup location (defaulting to `targetPath + ".bak"`),
 * creating parent directories if needed and throwing a descriptive error if the source
 * file does not exist.
 *
 * If `snapshot` is provided, it is written directly to the backup location without reading from disk.
 */
export function backupFile(
  targetPath: string,
  backupSuffix?: string,
  snapshot?: string | NodeJS.ArrayBufferView,
): string {
  if (snapshot === undefined && !fs.existsSync(targetPath)) {
    throw new Error(`No existe el archivo fuente: ${targetPath}`);
  }

  const suffix = backupSuffix ?? ".bak";
  const backupPath = `${targetPath}${suffix}`;

  const parentDir = dirname(backupPath);
  fs.mkdirSync(parentDir, { recursive: true });

  if (snapshot !== undefined) {
    fs.writeFileSync(backupPath, snapshot, "utf-8");
  } else if (Reflect.has(fs, "copyFileSync") && typeof (fs as Record<string, unknown>).copyFileSync === "function") {
    fs.copyFileSync(targetPath, backupPath);
  } else {
    fs.writeFileSync(backupPath, fs.readFileSync(targetPath));
  }

  return backupPath;
}
