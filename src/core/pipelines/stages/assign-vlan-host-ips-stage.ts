import { calcIp } from "../../utils/network/calc-ip.js";
import type { Stage } from "../pipeline.js";
import type { NetworkContext, PlannedOperation } from "../types.js";

/**
 * Generates configure_pc_ip operations for hosts starting at .2 with switch gateway.
 */
export class AssignVlanHostIpsStage implements Stage<NetworkContext> {
  execute(context: Readonly<NetworkContext>): NetworkContext {
    const vlanPlans = context.vlanPlans.map((plan) => {
      const hostIpOperations: PlannedOperation[] = plan.hostNames.map((name, i) => ({
        method: "configure_pc_ip",
        params: {
          device: name,
          ip: calcIp(plan.allocation.subnet, i + 2),
          subnetMask: "255.255.255.0",
          gateway: plan.allocation.gatewayIp,
        },
      }));

      return { ...plan, hostIpOperations };
    });

    return {
      ...context,
      vlanPlans,
    };
  }
}
