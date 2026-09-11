import type { DeviceCategory } from "../../core/types/catalog.js";
import { deviceCatalog } from "../data/device-data.js";

export function getDeviceCategory(model: string): DeviceCategory | undefined {
  return deviceCatalog.get(model)?.category;
}
