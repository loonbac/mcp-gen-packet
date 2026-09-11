import { moduleCatalog } from "../data/module-data.js";

export function getModuleType(model: string): number | undefined {
  return moduleCatalog.get(model)?.typeId;
}
