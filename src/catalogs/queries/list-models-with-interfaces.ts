import { modelInterfaces } from "../data/interface-data.js";

export function listModelsWithInterfaces(): string[] {
  return [...modelInterfaces.keys()];
}
