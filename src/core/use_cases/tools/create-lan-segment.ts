import type { LanSegmentConfig } from "../../types/topology.js";
import type { ToolResult } from "../../types/tools.js";
import type {
  CompositeBridge,
  LanSegmentContext,
  OperationExecution,
} from "../../pipelines/types.js";
import { Pipeline } from "../../pipelines/pipeline.js";
import { ExecuteOperationsStage } from "../../pipelines/stages/execute-operations-stage.js";
import { PlanLanDevicesStage } from "../../pipelines/stages/plan-lan-devices-stage.js";
import { LayoutLanDevicesStage } from "../../pipelines/stages/layout-lan-devices-stage.js";
import { AssignLanIpsStage } from "../../pipelines/stages/assign-lan-ips-stage.js";
import { PlanLanLinksStage } from "../../pipelines/stages/plan-lan-links-stage.js";

export type CreateLanSegmentParams = LanSegmentConfig;

export interface CreateLanSegmentData {
  readonly segmentName: string;
  readonly gateway: string;
  readonly gatewayIp: string;
  readonly hosts: readonly string[];
  readonly operations: readonly OperationExecution[];
}

/**
 * Executes end-to-end LAN segment creation through an immutable pipeline of atomic stages.
 */
export async function createLanSegmentUseCase(
  bridge: CompositeBridge,
  params: CreateLanSegmentParams,
): Promise<ToolResult<CreateLanSegmentData>> {
  const initialContext: LanSegmentContext = {
    bridge,
    operations: [],
    executionResults: [],
    input: params,
    devices: [],
    hostNames: [],
  };

  const pipeline = new Pipeline<LanSegmentContext>()
    .pipe(new PlanLanDevicesStage())
    .pipe(new LayoutLanDevicesStage())
    .pipe(new AssignLanIpsStage())
    .pipe(new PlanLanLinksStage())
    .pipe(new ExecuteOperationsStage<LanSegmentContext>());

  const finalContext = await pipeline.execute(initialContext);

  return {
    mode: bridge.getMode(),
    data: {
      segmentName: params.name,
      gateway: finalContext.gatewayName ?? `${params.name}-GW`,
      gatewayIp: finalContext.gatewayIp ?? "",
      hosts: finalContext.hostNames,
      operations: finalContext.executionResults,
    },
  };
}
