import { autoLayout } from "../../../layout/auto-layout.js";
import type { Stage } from "../pipeline.js";
import type { NetworkContext, PlannedOperation } from "../types.js";

/**
 * Computes layout positions independently for each VLAN segment and appends add_device operations.
 */
export class LayoutVlanDevicesStage implements Stage<NetworkContext> {
  execute(context: Readonly<NetworkContext>): NetworkContext {
    const vlanPlans = context.vlanPlans.map((plan) => {
      const segmentDevices = [plan.switchName, ...plan.hostNames];
      const positions = autoLayout(segmentDevices);

      const deviceOperations: PlannedOperation[] = [
        {
          method: "add_device",
          params: {
            name: plan.switchName,
            model: "Switch-PT",
            x: positions[0].x,
            y: positions[0].y,
          },
        },
        ...plan.hostNames.map((name, i) => ({
          method: "add_device",
          params: {
            name,
            model: "PC-PT",
            x: positions[i + 1].x,
            y: positions[i + 1].y,
          },
        })),
      ];

      return { ...plan, deviceOperations };
    });

    return {
      ...context,
      vlanPlans,
    };
  }
}
