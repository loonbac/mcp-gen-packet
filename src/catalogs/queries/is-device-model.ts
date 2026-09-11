import { deviceCatalog } from "../data/device-data.js";

export function isDeviceModel(model: string): boolean {
  return deviceCatalog.has(model);
}
