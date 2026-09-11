import type { Stage } from "../pipeline.js";
import type { NetworkContext, NetworkDevice, VlanOperationPlan } from "../types.js";

/**
 * Plans switches and host PCs per VLAN, assembling VlanOperationPlan and allDevices entries.
 */
export class PlanVlanDevicesStage implements Stage<NetworkContext> {
  execute(context: Readonly<NetworkContext>): NetworkContext {
    const vlanPlans: VlanOperationPlan[] = [];
    const allDevices: NetworkDevice[] = [];

    for (const alloc of context.allocations) {
      const switchName = `VLAN${alloc.vlan.id}-SW`;
      const hostNames = Array.from(
        { length: context.input.hostsPerVlan },
        (_, i) => `VLAN${alloc.vlan.id}-H${i + 1}`,
      );

      allDevices.push({ name: switchName, type: "switch" });
      for (const name of hostNames) {
        allDevices.push({ name, type: "host" });
      }

      vlanPlans.push({
        allocation: alloc,
        switchName,
        hostNames,
        deviceOperations: [],
        switchOperations: [],
        hostIpOperations: [],
        linkOperations: [],
      });
    }

    return {
      ...context,
      vlanPlans,
      allDevices,
    };
  }
}
