import type { DeviceCategory } from "../../core/types/catalog.js";
import { DEVICE_CATEGORIES, deviceCatalog } from "../data/device-data.js";

export function getDevicesByCategory(category: number | DeviceCategory): string[] {
  if (typeof category === "number") {
    const catName = DEVICE_CATEGORIES[category] ?? "other";
    return [...deviceCatalog.values()]
      .filter((d) => d.category === catName)
      .map((d) => d.model);
  }
  return [...deviceCatalog.values()]
    .filter((d) => d.category === category)
    .map((d) => d.model);
}
