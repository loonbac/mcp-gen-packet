# Design: Slice 2 Composite Pipelines

## Status

- **status**: `designed_with_delivery_gate`
- **change**: `micro-modular-alignment`
- **scope**: `slice-2-composite only`
- **execution**: `auto`
- **artifact_store**: `openspec`
- **strict_tdd**: `true`
- **review_budget**: `<400 changed lines per review unit`
- **skill_resolution**: `fallback-path` (`gentle-ai` and `gentle-ai-cognitive-doc-design`; no phase-specific skill path was injected)

## Executive summary

Slice 2 replaces the two procedural composite tools with invocation-owned, typed pipelines. Tool modules retain Zod validation, names, descriptions, schemas, and historical exports, but delegate all planning and execution to one use case per action. Pure stages return new contexts, `ExecuteOperationsStage` is the only bridge side-effect stage, and every network invocation starts with a new immutable `SubnetAllocator`.

The normative spec requires two multi-VLAN stages omitted from the shorthand input list: `LayoutVlanDevicesStage` and `AssignVlanHostIpsStage`. They remain separate because merging layout into device planning or host addressing into switch configuration would violate the specification and the repository's single-responsibility rule.

S2a, S2b, and S2c are separate green review units. Their aggregate exceeds 400 lines, so their PR/chain packaging remains an `ask-on-risk` human-control gate; no chain strategy or `size:exception` is selected here.

## Scope and decisions

| Topic | Decision |
|---|---|
| Pipeline primitive | Reuse `src/core/pipelines/pipeline.ts` unchanged. |
| Context mutation | Every stage returns a new top-level context and new arrays for fields it changes. Input arrays and prior context arrays are not mutated. |
| Bridge dependency | Core code uses a minimal structural `CompositeBridge` capability in pipeline types. Existing `BridgeAdapter` satisfies it without creating a `src/core/** -> src/bridge/**` dependency. |
| Side effects | Planning stages perform no bridge calls. `ExecuteOperationsStage` executes planned operations sequentially and catches failures per operation. |
| LAN addressing | `AssignLanIpsStage` imports `parseSubnet` and `calcIp` from canonical core utilities. |
| VLAN allocation | `CreateNetworkUseCase` creates `new SubnetAllocator()` for every call; `AllocateVlanSubnetsStage` threads successor allocator instances through the context. |
| Operation order | Network plans retain per-VLAN operation buckets and flatten them in legacy order before execution: devices, switch configuration, switch IP, host IPs, then links for each VLAN. |
| Public adapters | Zod parsing occurs before use-case construction or bridge interaction. Historical direct-file exports remain available. |
| Error contract | Validation and planning errors reject. Individual bridge failures become `{ success: false, method, params }`, and later operations continue. |
| Naming | Files use kebab case and classes use the normative `*Stage` names. The prompt's lower-camel names are conceptual stage names, not extra singleton exports. |

## Dependency direction

```text
src/tools/composite/*
  -> Zod schemas
  -> src/core/use_cases/tools/*
       -> src/core/pipelines/pipeline.ts
       -> src/core/pipelines/types.ts
       -> src/core/pipelines/stages/*
            -> src/core/utils/network/*
            -> src/layout/auto-layout.ts

BridgeAdapter --structurally satisfies--> CompositeBridge
```

No stage imports a tool adapter, schema, protocol façade, or concrete bridge. No use case imports from `src/tools/**` or `src/bridge/**`.

## Exact TypeScript contracts

All source imports use NodeNext `.js` specifiers.

### Shared pipeline types

```ts
// src/core/pipelines/types.ts
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
```

Optional LAN output fields model pipeline phase boundaries without using sentinel empty strings. Pipeline order guarantees they are present after `AssignLanIpsStage`; use-case tests enforce this invariant.

### Common execution stage

```ts
// src/core/pipelines/stages/execute-operations-stage.ts
import type { Stage } from "../pipeline.js";
import type { OperationsContext } from "../types.js";

export class ExecuteOperationsStage<
  TContext extends OperationsContext = OperationsContext,
> implements Stage<TContext> {
  execute(context: Readonly<TContext>): Promise<TContext>;
}
```

The stage awaits each `bridge.execute(method, params)` in array order. It records only `success`, `method`, and the original `params`; bridge return payloads and caught errors are intentionally discarded to match legacy output. It never mutates `operations`, never aborts on an operation failure, and replaces `executionResults` once after the loop.

### LAN stages

```ts
// src/core/pipelines/stages/plan-lan-devices-stage.ts
export class PlanLanDevicesStage implements Stage<LanSegmentContext> {
  execute(context: Readonly<LanSegmentContext>): LanSegmentContext;
}

// src/core/pipelines/stages/layout-lan-devices-stage.ts
export class LayoutLanDevicesStage implements Stage<LanSegmentContext> {
  execute(context: Readonly<LanSegmentContext>): LanSegmentContext;
}

// src/core/pipelines/stages/assign-lan-ips-stage.ts
export class AssignLanIpsStage implements Stage<LanSegmentContext> {
  execute(context: Readonly<LanSegmentContext>): LanSegmentContext;
}

// src/core/pipelines/stages/plan-lan-links-stage.ts
export class PlanLanLinksStage implements Stage<LanSegmentContext> {
  execute(context: Readonly<LanSegmentContext>): LanSegmentContext;
}
```

Stage postconditions:

1. `PlanLanDevicesStage` sets `gatewayName`, `hostNames`, and ordered device models; it adds no operation.
2. `LayoutLanDevicesStage` calls `autoLayout(deviceNames)` once and appends ordered `add_device` operations.
3. `AssignLanIpsStage` calls `parseSubnet(input.subnet)`, selects `input.gateway ?? calcIp(baseIp, 1)`, sets `baseIp` and `gatewayIp`, and appends gateway then host `configure_pc_ip` operations.
4. `PlanLanLinksStage` appends one `add_link` per host. The gateway uses `GigabitEthernet0/0`; host `i` uses `FastEthernet0/${i + 1}` as in the current adapter.

### Multi-VLAN stages

```ts
// src/core/pipelines/stages/allocate-vlan-subnets-stage.ts
export class AllocateVlanSubnetsStage implements Stage<NetworkContext> {
  execute(context: Readonly<NetworkContext>): NetworkContext;
}

// src/core/pipelines/stages/plan-vlan-devices-stage.ts
export class PlanVlanDevicesStage implements Stage<NetworkContext> {
  execute(context: Readonly<NetworkContext>): NetworkContext;
}

// src/core/pipelines/stages/layout-vlan-devices-stage.ts
export class LayoutVlanDevicesStage implements Stage<NetworkContext> {
  execute(context: Readonly<NetworkContext>): NetworkContext;
}

// src/core/pipelines/stages/configure-vlan-devices-stage.ts
export class ConfigureVlanDevicesStage implements Stage<NetworkContext> {
  execute(context: Readonly<NetworkContext>): NetworkContext;
}

// src/core/pipelines/stages/assign-vlan-host-ips-stage.ts
export class AssignVlanHostIpsStage implements Stage<NetworkContext> {
  execute(context: Readonly<NetworkContext>): NetworkContext;
}

// src/core/pipelines/stages/plan-vlan-links-stage.ts
export class PlanVlanLinksStage implements Stage<NetworkContext> {
  execute(context: Readonly<NetworkContext>): NetworkContext;
}
```

A focused pure collector prevents repeated flattening policy:

```ts
// src/core/pipelines/stages/collect-vlan-operations.ts
export function collectVlanOperations(
  plans: readonly VlanOperationPlan[],
): PlannedOperation[];
```

For each VLAN plan, the collector concatenates `deviceOperations`, `switchOperations`, `hostIpOperations`, and `linkOperations`, then advances to the next VLAN. Layout, configuration, host-IP, and link stages call it after replacing their own bucket so `context.operations` always reflects all work planned so far and the final array preserves legacy bridge call order.

Stage postconditions:

1. `AllocateVlanSubnetsStage` walks input VLAN order, calls the current immutable allocator once per VLAN, calculates `.1` with `calcIp`, stores allocations, and returns the final successor allocator.
2. `PlanVlanDevicesStage` creates one `VlanOperationPlan` per allocation, with `VLAN{id}-SW`, `VLAN{id}-H1...Hn`, empty operation buckets, and ordered `allDevices` metadata.
3. `LayoutVlanDevicesStage` calls `autoLayout([switchName, ...hostNames])` independently per VLAN and fills only `deviceOperations`.
4. `ConfigureVlanDevicesStage` fills only `switchOperations`: `configure_ios_device` followed by switch `configure_pc_ip`.
5. `AssignVlanHostIpsStage` fills only `hostIpOperations`, using host indices `2...n+1` and the allocation gateway.
6. `PlanVlanLinksStage` fills only `linkOperations`, using switch `FastEthernet0/${i + 1}`, host `FastEthernet0`, and `ethernet-straight`.

### LAN use case

```ts
// src/core/use_cases/tools/create-lan-segment.ts
import type { LanSegmentConfig } from "../../types/topology.js";
import type { ToolResult } from "../../types/tools.js";
import type {
  CompositeBridge,
  OperationExecution,
} from "../../pipelines/types.js";

export type CreateLanSegmentParams = LanSegmentConfig;

export interface CreateLanSegmentData {
  readonly segmentName: string;
  readonly gateway: string;
  readonly gatewayIp: string;
  readonly hosts: readonly string[];
  readonly operations: readonly OperationExecution[];
}

export function createLanSegmentUseCase(
  bridge: CompositeBridge,
  params: CreateLanSegmentParams,
): Promise<ToolResult<CreateLanSegmentData>>;
```

The function creates the initial context with empty arrays, constructs a new pipeline per invocation, pipes the four LAN stages and `new ExecuteOperationsStage<LanSegmentContext>()`, executes it, and maps the final context to the legacy data shape. It does not validate unknown input; validation belongs to the adapter.

### Network use case

```ts
// src/core/use_cases/tools/create-network.ts
import type { ToolResult } from "../../types/tools.js";
import type {
  CompositeBridge,
  NetworkDevice,
  NetworkInput,
  OperationExecution,
} from "../../pipelines/types.js";

export type CreateNetworkParams = NetworkInput;

export interface CreateNetworkData {
  readonly vlans: NetworkInput["vlans"];
  readonly hostsPerVlan: number;
  readonly allDevices: readonly NetworkDevice[];
  readonly operations: readonly OperationExecution[];
}

export function createNetworkUseCase(
  bridge: CompositeBridge,
  params: CreateNetworkParams,
): Promise<ToolResult<CreateNetworkData>>;
```

Each call initializes `allocator: new SubnetAllocator()`, empty allocations/plans/devices/operations/results, and a new pipeline in this exact order:

```ts
new Pipeline<NetworkContext>()
  .pipe(new AllocateVlanSubnetsStage())
  .pipe(new PlanVlanDevicesStage())
  .pipe(new LayoutVlanDevicesStage())
  .pipe(new ConfigureVlanDevicesStage())
  .pipe(new AssignVlanHostIpsStage())
  .pipe(new PlanVlanLinksStage())
  .pipe(new ExecuteOperationsStage<NetworkContext>());
```

### Thin adapters

```ts
// src/tools/composite/create-lan-segment.ts
export const CreateLanSegmentSchema = z.object({
  name: z.string().describe(/* unchanged */),
  subnet: z.string().describe(/* unchanged */),
  hosts: z.number().min(1).describe(/* unchanged */),
  gateway: z.string().optional().describe(/* unchanged */),
}) satisfies z.ZodType<CreateLanSegmentParams>;

export type { CreateLanSegmentParams } from
  "../../core/use_cases/tools/create-lan-segment.js";

export const createLanSegmentTool = {
  name: "packet_tracer_create_lan_segment",
  description: /* unchanged */,
  inputSchema: CreateLanSegmentSchema,
  execute: (bridge: BridgeAdapter, params: unknown): Promise<ToolResult> =>
    createLanSegmentUseCase(bridge, CreateLanSegmentSchema.parse(params)),
};
```

```ts
// src/tools/composite/create-network.ts
export const VlanSpecSchema = z.object({
  id: z.number().min(1).max(4094).describe(/* unchanged */),
  name: z.string().describe(/* unchanged */),
}) satisfies z.ZodType<VlanSpec>;

export const CreateNetworkSchema = z.object({
  vlans: z.array(VlanSpecSchema).min(1).describe(/* unchanged */),
  hostsPerVlan: z.number().min(1).describe(/* unchanged */),
}) satisfies z.ZodType<CreateNetworkParams>;

export type { CreateNetworkParams } from
  "../../core/use_cases/tools/create-network.js";

export const createNetworkTool = {
  name: "packet_tracer_create_network",
  description: /* unchanged */,
  inputSchema: CreateNetworkSchema,
  execute: (bridge: BridgeAdapter, params: unknown): Promise<ToolResult> =>
    createNetworkUseCase(bridge, CreateNetworkSchema.parse(params)),
};
```

The comments above use placeholders only to show signatures; implementation preserves the exact existing description strings. `satisfies` checks schema/output alignment while retaining each concrete `ZodObject` type and its `.shape` property.

## Data flow

### LAN

```text
unknown params
  -> adapter Zod parse (failure: reject, zero bridge calls)
  -> initial LanSegmentContext
  -> device names/models
  -> layout + add_device operations
  -> subnet parse/IP assignment + configure_pc_ip operations
  -> star links + add_link operations
  -> sequential bridge execution with per-operation failure capture
  -> legacy ToolResult data
```

### Network

```text
unknown params
  -> adapter Zod parse
  -> context with new SubnetAllocator()
  -> immutable VLAN allocations
  -> switch/host plans and allDevices
  -> per-VLAN device operation buckets
  -> per-VLAN switch operation buckets
  -> per-VLAN host-IP operation buckets
  -> per-VLAN link operation buckets
  -> collect in legacy per-VLAN order
  -> sequential bridge execution
  -> legacy ToolResult data
```

Two concurrent or successive network calls cannot share allocator or operation state because all state is created inside `createNetworkUseCase` and passed through its context.

## File change plan

| Review unit | Path | Change |
|---|---|---|
| S2a | `src/core/pipelines/types.ts` | Add shared operation, bridge-capability, plan, and context contracts. |
| S2a | `src/core/pipelines/stages/execute-operations-stage.ts` | Add reusable resilient sequential executor. |
| S2a | `tests/core/pipelines/stages/execute-operations-stage.test.ts` | Characterize success, ordering, partial failure, and immutability. |
| S2b | `src/core/pipelines/stages/{plan-lan-devices,layout-lan-devices,assign-lan-ips,plan-lan-links}-stage.ts` | Add four atomic LAN stages. |
| S2b | `src/core/use_cases/tools/create-lan-segment.ts` | Compose LAN pipeline and map result. |
| S2b | `src/tools/composite/create-lan-segment.ts` | Remove helpers/procedure; retain schema/tool façade. |
| S2b | `tests/core/pipelines/stages/lan-stages.test.ts` | Isolated stage scenarios. |
| S2b | `tests/core/use_cases/tools/create-lan-segment.test.ts` | End-to-end use-case output and operation count. |
| S2c | `src/core/pipelines/stages/{allocate-vlan-subnets,plan-vlan-devices,layout-vlan-devices,configure-vlan-devices,assign-vlan-host-ips,plan-vlan-links}-stage.ts` | Add six atomic network stages. |
| S2c | `src/core/pipelines/stages/collect-vlan-operations.ts` | Centralize legacy ordering policy. |
| S2c | `src/core/use_cases/tools/create-network.ts` | Compose invocation-scoped network pipeline. |
| S2c | `src/tools/composite/create-network.ts` | Remove counter/helper/procedure; retain schema/tool façade. |
| S2c | `tests/core/pipelines/stages/network-stages.test.ts` | Isolated allocation, planning, layout, configuration, addressing, links, and ordering. |
| S2c | `tests/core/use_cases/tools/create-network.test.ts` | End-to-end output and cross-invocation isolation. |

`src/core/pipelines/pipeline.ts`, canonical network utilities, `src/tools/composite/index.ts`, tool names, schemas, and existing adapter tests remain behaviorally unchanged.

## Strict TDD and verification matrix

| Unit | RED-first coverage | Required triangulation |
|---|---|---|
| S2a | Three operations all succeed | Second throws; third still runs; results preserve operation order and params. |
| S2b LAN stages | Names/models, deterministic coordinates, default IPs, links | Custom gateway, CIDR input, two hosts, no input-array mutation. |
| S2b LAN use case | Exact result metadata and `3h + 2` operation results | Bridge mode propagation and unchanged existing adapter suite. |
| S2b adapter | Existing direct export/tool assertions | Invalid `hosts` rejects before bridge interaction. |
| S2c allocation | `10.0.1.0`, `.2.0`, `.3.0` | Two independent contexts both begin at `.1.0`. |
| S2c network stages | Switch/host metadata and all required operation params | Two VLANs, VLAN input order, `collectVlanOperations` legacy order. |
| S2c network use case | Exact result metadata and `v(3h + 3)` operation results | Successive and concurrent invocation isolation. |
| S2c adapter | Existing direct export/tool assertions | Invalid VLAN ID rejects before bridge interaction. |

Per review unit:

```text
RED:   npx vitest run <new focused test path>
GREEN: npx vitest run <new focused test path>
REGRESSION: npx vitest run tests/tools/composite/create-lan-segment.test.ts
            npx vitest run tests/tools/composite/create-network.test.ts
FULL:  npm test
TYPE:  npm run build
```

Vitest is not the type-safety authority; `npm run build` must prove structural compatibility between `BridgeAdapter` and `CompositeBridge`, NodeNext import correctness, and typed pipeline composition.

## Review units and line budget

Changed-line forecasts count additions and deletions. They are implementation targets, not permission to exceed the gate.

| Order | Review unit | Forecast | Green boundary |
|---|---|---:|---|
| 1 | **S2a common execution** | 190–260 | Shared contexts + executor tests, full suite, build. |
| 2 | **S2b LAN pipeline** | 330–390 | Four stages + use case + thin adapter + focused tests, full suite, build. |
| 3 | **S2c network pipeline** | 350–395 | Six stages + collector + use case + thin adapter + focused tests, full suite, build. |

S2c has little margin because deleting the current procedural adapter counts against the budget. Before each unit, tasks must record an exact forecast from the then-current tree. If any forecast is `>=400` or uncertain, stop under `ask-on-risk` and split that logical unit (for example S2c planning followed by S2c adoption) rather than infer `size:exception` or a chain strategy.

## Compatibility and rollout

1. Land S2a first; it is additive and does not change tool behavior.
2. Land S2b only after S2a is green; the LAN adapter becomes a façade in the same green unit as its use case.
3. Land S2c only after S2b is green; remove module-level subnet state only when the invocation-scoped pipeline is ready.
4. Keep `src/tools/composite/create-*.ts` as permanent compatibility entry points for this change.
5. Compare bridge call method/params order, operation-result order, result data, and validation timing against existing tests.
6. Rollback is review-unit local. S2b or S2c may restore its prior adapter body without reverting S2a; no data migration exists.
7. Do not remove historical exports, alter schemas, move primitive tools, or begin S3–S5 work in these units.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Normative stage list and prompt shorthand differ | Missing required VLAN behavior or accidental merged responsibilities | Implement the six normative VLAN stages; document `LayoutVlanDevicesStage` and `AssignVlanHostIpsStage` explicitly. |
| Stage grouping reorders bridge calls across VLANs | Observable behavior and operation arrays drift | Store per-VLAN buckets and flatten through one collector in legacy order before execution. |
| Optional LAN phase outputs are read too early | Undefined result metadata | Fixed pipeline order plus focused use-case assertions; no public direct context construction. |
| A bridge failure aborts later operations | Compatibility regression | Catch each operation independently only inside `ExecuteOperationsStage`. |
| Allocator successor is not rebound | Every VLAN receives the same subnet | Return the final successor allocator and test three sequential allocations. |
| Adapter/core type cycle appears | NodeNext build or architecture direction fails | Define request/context contracts inward; adapters re-export use-case parameter types and satisfy a structural bridge capability. |
| S2c exceeds 400 changed lines | Review-budget violation | Exact pre-edit forecast, compact table-driven tests, and mandatory split under `ask-on-risk` if forecast is uncertain or reaches 400. |
| Schema typing widens away `.shape` | Existing schema tests fail to compile | Use `satisfies z.ZodType<T>` instead of annotating the constant as the broad Zod type. |

## SDD result

- **status**: `designed_with_delivery_gate`
- **executive_summary**: Exact immutable contexts, eleven atomic stages, two use-case signatures, legacy-order operation planning, thin adapter contracts, strict TDD coverage, and three targeted sub-400 review units are defined for Slice 2.
- **artifacts**:
  - `openspec/changes/micro-modular-alignment/proposal.md`
  - `openspec/changes/micro-modular-alignment/specs/slice-2-composite/spec.md`
  - `openspec/changes/micro-modular-alignment/specs/slice-2-composite/design.md`
- **next_recommended**: `tasks` — record exact changed-line forecasts, resolve the `ask-on-risk` PR/chain packaging gate, then create RED-first tasks in order S2a, S2b, S2c with full-suite and build gates after each.
- **risks**: Normative/shorthand stage-list mismatch, operation-order drift, missed immutable allocator rebinding, structural type cycles, and especially S2c's narrow margin below 400 changed lines.
- **skill_resolution**: `fallback-path`
