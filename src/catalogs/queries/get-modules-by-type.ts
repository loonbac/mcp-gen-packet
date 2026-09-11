import { moduleCatalog } from "../data/module-data.js";

export function getModulesByType(typeId: number): string[] {
  return [...moduleCatalog.values()]
    .filter((m) => m.typeId === typeId)
    .map((m) => m.model);
}
