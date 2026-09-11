import { moduleCatalog } from "../data/module-data.js";

export function isModuleModel(model: string): boolean {
  return moduleCatalog.has(model);
}
