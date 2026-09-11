import { autoLayout } from "../../../layout/auto-layout.js";
import type { Stage } from "../pipeline.js";
import type { LanSegmentContext, PlannedOperation } from "../types.js";

/**
 * Computes canvas coordinates for LAN devices using autoLayout
 * and appends add_device operations to the planned operations list.
 */
export class LayoutLanDevicesStage implements Stage<LanSegmentContext> {
  execute(context: Readonly<LanSegmentContext>): LanSegmentContext {
    const gatewayName = context.gatewayName ?? `${context.input.name}-GW`;
    const hostNames = context.hostNames;
    const deviceNames = [gatewayName, ...hostNames];

    const positions = autoLayout(deviceNames);

    const deviceOps: PlannedOperation[] = [
      {
        method: "add_device",
        params: {
          name: deviceNames[0],
          model: "Router-PT",
          x: positions[0].x,
          y: positions[0].y,
        },
      },
      ...hostNames.map((name, i) => ({
        method: "add_device",
        params: {
          name,
          model: "PC-PT",
          x: positions[i + 1].x,
          y: positions[i + 1].y,
        },
      })),
    ];

    return {
      ...context,
      operations: [...context.operations, ...deviceOps],
    };
  }
}
