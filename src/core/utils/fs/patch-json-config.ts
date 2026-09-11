import * as fs from "node:fs";
import { dirname, basename, join } from "node:path";
import { backupFile } from "./backup-file.js";

export interface PatchOptions<T> {
  readonly backupSuffix?: string;
  readonly verify?: (written: T) => boolean;
  readonly initial?: () => T;
  readonly deserialize?: (raw: string) => T;
  readonly serialize?: (value: T) => string;
  readonly _fs?: typeof import("node:fs");
}

export type PatchJsonConfigResult =
  | { readonly success: true; readonly backup?: string }
  | { readonly success: false; readonly error: string; readonly backup?: string };

/**
 * Transactional, atomic configuration patcher with backup, verification, and codec support.
 * Uses atomic replacement via temporary sibling file when supported by the filesystem environment,
 * falling back to direct write under partial mock environments lacking renameSync.
 */
export function patchJsonConfig<T>(
  configPath: string,
  patchFn: (current: T) => T,
  options?: PatchOptions<T>,
): PatchJsonConfigResult {
  const fsModule = (options?._fs ?? fs) as typeof fs;
  let backup: string | undefined;
  let tempPath: string | undefined;

  const hasRename =
    Reflect.has(fsModule, "renameSync") &&
    typeof (fsModule as Record<string, unknown>).renameSync === "function";
  const hasUnlink =
    Reflect.has(fsModule, "unlinkSync") &&
    typeof (fsModule as Record<string, unknown>).unlinkSync === "function";

  const deserialize = options?.deserialize ?? ((str: string) => JSON.parse(str) as T);
  const serialize = options?.serialize ?? ((val: T) => JSON.stringify(val, null, 2) + "\n");

  try {
    const fileExists = fsModule.existsSync(configPath);
    let current: T;
    let raw: string | undefined;

    if (!fileExists) {
      if (options?.initial) {
        current = options.initial();
      } else {
        return { success: false, error: `No existe el archivo de configuración: ${configPath}` };
      }
    } else {
      raw = fsModule.readFileSync(configPath, "utf-8");
      current = deserialize(raw);
    }

    const updated = patchFn(current);

    if (fileExists) {
      backup = backupFile(configPath, options?.backupSuffix, raw);
    }

    const serialized = serialize(updated);

    const parentDir = dirname(configPath);
    if (!fsModule.existsSync(parentDir)) {
      fsModule.mkdirSync(parentDir, { recursive: true });
    }

    if (hasRename) {
      const nonce = `${Date.now()}.${Math.random().toString(36).slice(2)}`;
      tempPath = join(dirname(configPath), `.${basename(configPath)}.tmp.${nonce}`);

      fsModule.writeFileSync(tempPath, serialized, "utf-8");

      const writtenRaw = fsModule.readFileSync(tempPath, "utf-8");
      const written = deserialize(writtenRaw);
      if (options?.verify && !options.verify(written)) {
        throw new Error(`Verificación fallida para ${configPath}`);
      }

      fsModule.renameSync(tempPath, configPath);
      tempPath = undefined;
    } else {
      fsModule.writeFileSync(configPath, serialized, "utf-8");

      const writtenRaw = fsModule.readFileSync(configPath, "utf-8");
      const written = deserialize(writtenRaw);
      if (options?.verify && !options.verify(written)) {
        throw new Error(`Verificación fallida para ${configPath}`);
      }
    }

    return { success: true, ...(backup ? { backup } : {}) };
  } catch (err) {
    if (tempPath && fsModule.existsSync(tempPath) && hasUnlink) {
      try {
        fsModule.unlinkSync(tempPath);
      } catch {
        // ignore cleanup failure
      }
    }

    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message, ...(backup ? { backup } : {}) };
  }
}
