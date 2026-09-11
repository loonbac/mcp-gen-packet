import type { Stage } from "../pipeline.js";
import type { NetworkContext, VlanAllocation } from "../types.js";
import { calcIp } from "../../utils/network/calc-ip.js";

/**
 * Allocates /24 subnets and gateway IPs for each VLAN using the context's SubnetAllocator.
 */
export class AllocateVlanSubnetsStage implements Stage<NetworkContext> {
  execute(context: Readonly<NetworkContext>): NetworkContext {
    let currentAllocator = context.allocator;
    const allocations: VlanAllocation[] = [];

    for (const vlan of context.input.vlans) {
      const next = currentAllocator.next();
      currentAllocator = next.allocator;
      allocations.push({
        vlan,
        subnet: next.subnet,
        gatewayIp: calcIp(next.subnet, 1),
      });
    }

    return {
      ...context,
      allocator: currentAllocator,
      allocations,
    };
  }
}
