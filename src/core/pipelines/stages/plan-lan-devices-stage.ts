import type { Stage } from "../pipeline.js";
import type { LanSegmentContext, PlannedDevice } from "../types.js";

/**
 * Plans device names and hardware models for a LAN segment.
 * Sets the gateway router (Router-PT) and host PCs (PC-PT).
 */
export class PlanLanDevicesStage implements Stage<LanSegmentContext> {
  execute(context: Readonly<LanSegmentContext>): LanSegmentContext {
    const gatewayName = `${context.input.name}-GW`;
    const hostNames = Array.from(
      { length: context.input.hosts },
      (_, i) => `${context.input.name}-H${i + 1}`,
    );

    const devices: PlannedDevice[] = [
      { name: gatewayName, model: "Router-PT" },
      ...hostNames.map((name) => ({ name, model: "PC-PT" as const })),
    ];

    return {
      ...context,
      gatewayName,
      hostNames,
      devices,
    };
  }
}
