import { moduleCatalog } from "../data/module-data.js";

export function listModuleModels(): string[] {
  return [...moduleCatalog.keys()];
}
