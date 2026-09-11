import { deviceCatalog } from "../data/device-data.js";

export function getDeviceType(model: string): number | undefined {
  return deviceCatalog.get(model)?.typeId;
}
