import { deviceCatalog } from "../data/device-data.js";

export function listDeviceModels(): string[] {
  return [...deviceCatalog.keys()];
}
