import type { Stage } from "../pipeline.js";
import type { NetworkContext, PlannedOperation } from "../types.js";
import { collectVlanOperations } from "./collect-vlan-operations.js";

/**
 * Plans straight-through links connecting switch ports to host interfaces,
 * and flattens all planned operations into context.operations via collectVlanOperations.
 */
export class PlanVlanLinksStage implements Stage<NetworkContext> {
  execute(context: Readonly<NetworkContext>): NetworkContext {
    const vlanPlans = context.vlanPlans.map((plan) => {
      const linkOperations: PlannedOperation[] = plan.hostNames.map((hostName, i) => ({
        method: "add_link",
        params: {
          device1: plan.switchName,
          interface1: `FastEthernet0/${i + 1}`,
          device2: hostName,
          interface2: "FastEthernet0",
          type: "ethernet-straight",
        },
      }));

      return { ...plan, linkOperations };
    });

    return {
      ...context,
      vlanPlans,
      operations: [...context.operations, ...collectVlanOperations(vlanPlans)],
    };
  }
}
