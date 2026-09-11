import { modelInterfaces } from "../data/interface-data.js";

export function getInterfaces(model: string): string[] {
  return modelInterfaces.get(model) ?? [];
}
