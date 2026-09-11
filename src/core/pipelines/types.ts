import type { ExecutionMode } from "../types/bridge.js";
import type { LanSegmentConfig, VlanSpec } from "../types/topology.js";
import type { SubnetAllocator } from "../utils/network/subnet-allocator.js";

export interface PlannedOperation {
  readonly method: string;
  readonly params: Record<string, unknown>;
}

export interface OperationExecution {
  readonly success: boolean;
  readonly method: string;
  readonly params: Record<string, unknown>;
}

export interface OperationBridge {
  execute(method: string, params: Record<string, unknown>): Promise<unknown>;
}

export interface CompositeBridge extends OperationBridge {
  getMode(): ExecutionMode;
}

export interface OperationsContext {
  readonly bridge: OperationBridge;
  readonly operations: readonly PlannedOperation[];
  readonly executionResults: readonly OperationExecution[];
}

export interface PlannedDevice {
  readonly name: string;
  readonly model: "Router-PT" | "Switch-PT" | "PC-PT";
}

export interface LanSegmentContext extends OperationsContext {
  readonly input: LanSegmentConfig;
  readonly devices: readonly PlannedDevice[];
  readonly gatewayName?: string;
  readonly hostNames: readonly string[];
  readonly baseIp?: string;
  readonly gatewayIp?: string;
}

export interface NetworkInput {
  readonly vlans: readonly VlanSpec[];
  readonly hostsPerVlan: number;
}

export interface VlanAllocation {
  readonly vlan: VlanSpec;
  readonly subnet: string;
  readonly gatewayIp: string;
}

export interface VlanOperationPlan {
  readonly allocation: VlanAllocation;
  readonly switchName: string;
  readonly hostNames: readonly string[];
  readonly deviceOperations: readonly PlannedOperation[];
  readonly switchOperations: readonly PlannedOperation[];
  readonly hostIpOperations: readonly PlannedOperation[];
  readonly linkOperations: readonly PlannedOperation[];
}

export interface NetworkDevice {
  readonly name: string;
  readonly type: "switch" | "host";
}

export interface NetworkContext extends OperationsContext {
  readonly input: NetworkInput;
  readonly allocator: SubnetAllocator;
  readonly allocations: readonly VlanAllocation[];
  readonly vlanPlans: readonly VlanOperationPlan[];
  readonly allDevices: readonly NetworkDevice[];
}
