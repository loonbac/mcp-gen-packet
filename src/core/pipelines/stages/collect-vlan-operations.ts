import type { PlannedOperation, VlanOperationPlan } from "../types.js";

/**
 * Flattens per-VLAN device, switch, host IP, and link operations in exact legacy sequence.
 */
export function collectVlanOperations(vlanPlans: readonly VlanOperationPlan[]): PlannedOperation[] {
  return vlanPlans.flatMap((plan) => [
    ...plan.deviceOperations,
    ...plan.switchOperations,
    ...plan.hostIpOperations,
    ...plan.linkOperations,
  ]);
}
