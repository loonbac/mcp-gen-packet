import { modelInterfaces } from "../data/interface-data.js";

export function hasInterfaces(model: string): boolean {
  return modelInterfaces.has(model);
}
