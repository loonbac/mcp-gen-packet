import type { Stage } from "../pipeline.js";
import type { LanSegmentContext, PlannedOperation } from "../types.js";

/**
 * Plans star-topology links connecting gateway router GigabitEthernet0/0
 * to host PC FastEthernet0/${i + 1} ports.
 */
export class PlanLanLinksStage implements Stage<LanSegmentContext> {
  execute(context: Readonly<LanSegmentContext>): LanSegmentContext {
    const gatewayName = context.gatewayName ?? `${context.input.name}-GW`;

    const linkOps: PlannedOperation[] = context.hostNames.map((hostName, i) => ({
      method: "add_link",
      params: {
        device1: gatewayName,
        interface1: "GigabitEthernet0/0",
        device2: hostName,
        interface2: `FastEthernet0/${i + 1}`,
        type: "ethernet-straight",
      },
    }));

    return {
      ...context,
      operations: [...context.operations, ...linkOps],
    };
  }
}
