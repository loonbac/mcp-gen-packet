import type { ToolResult } from "../../types/tools.js";
import type { VlanSpec } from "../../types/topology.js";
import type {
  CompositeBridge,
  NetworkContext,
  NetworkDevice,
  NetworkInput,
  OperationExecution,
} from "../../pipelines/types.js";
import { Pipeline } from "../../pipelines/pipeline.js";
import { SubnetAllocator } from "../../utils/network/subnet-allocator.js";
import { AllocateVlanSubnetsStage } from "../../pipelines/stages/allocate-vlan-subnets-stage.js";
import { PlanVlanDevicesStage } from "../../pipelines/stages/plan-vlan-devices-stage.js";
import { LayoutVlanDevicesStage } from "../../pipelines/stages/layout-vlan-devices-stage.js";
import { ConfigureVlanDevicesStage } from "../../pipelines/stages/configure-vlan-devices-stage.js";
import { AssignVlanHostIpsStage } from "../../pipelines/stages/assign-vlan-host-ips-stage.js";
import { PlanVlanLinksStage } from "../../pipelines/stages/plan-vlan-links-stage.js";
import { ExecuteOperationsStage } from "../../pipelines/stages/execute-operations-stage.js";

export type CreateNetworkParams = NetworkInput;

export interface CreateNetworkData {
  readonly vlans: readonly VlanSpec[];
  readonly hostsPerVlan: number;
  readonly allDevices: readonly NetworkDevice[];
  readonly operations: readonly OperationExecution[];
}

/**
 * Executes multi-VLAN network creation through an immutable pipeline of atomic stages.
 */
export async function createNetworkUseCase(
  bridge: CompositeBridge,
  params: CreateNetworkParams,
): Promise<ToolResult<CreateNetworkData>> {
  const initialContext: NetworkContext = {
    bridge,
    operations: [],
    executionResults: [],
    input: params,
    allocator: new SubnetAllocator(),
    allocations: [],
    vlanPlans: [],
    allDevices: [],
  };

  const pipeline = new Pipeline<NetworkContext>()
    .pipe(new AllocateVlanSubnetsStage())
    .pipe(new PlanVlanDevicesStage())
    .pipe(new LayoutVlanDevicesStage())
    .pipe(new ConfigureVlanDevicesStage())
    .pipe(new AssignVlanHostIpsStage())
    .pipe(new PlanVlanLinksStage())
    .pipe(new ExecuteOperationsStage<NetworkContext>());

  const finalContext = await pipeline.execute(initialContext);

  return {
    mode: bridge.getMode(),
    data: {
      vlans: params.vlans,
      hostsPerVlan: params.hostsPerVlan,
      allDevices: finalContext.allDevices,
      operations: finalContext.executionResults,
    },
  };
}
