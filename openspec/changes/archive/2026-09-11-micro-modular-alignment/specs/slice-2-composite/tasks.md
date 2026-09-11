# Tasks: Slice 2 Composite Tools & Pipelines Migration

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 750–950 lines across S2 (S2a: ~150–220, S2b: ~280–360, S2c: ~320–395) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (S2a: shared execution stage) → PR 2 (S2b: LAN pipeline) → PR 3 (S2c: multi-VLAN pipeline) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

```text
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High
```

---

## Sub-Slice S2a: Shared Execution Stage and Pipeline Contracts (~150–220 lines)

Autonomous work unit establishing shared execution types, context contracts, and the reusable sequential batch execution stage.

### Phase S2a.1 — Tests (RED)

- [x] Write failing unit tests in `tests/core/pipelines/stages/execute-operations-stage.test.ts` covering successful sequential execution of planned operations, per-operation failure capture without throwing or aborting subsequent operations, context immutability, and empty operations list handling. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/core/pipelines/stages/execute-operations-stage.test.ts` to observe RED test failure confirming missing types and stage implementation. <!-- sdd-owner: implementation -->

### Phase S2a.2 — Shared Pipeline Types & Stage Implementation (GREEN)

- [x] Define shared pipeline types and context contracts in `src/core/pipelines/types.ts` (`PlannedOperation`, `OperationExecution`, `OperationBridge`, `CompositeBridge`, `OperationsContext`, `PlannedDevice`, `LanSegmentContext`, `NetworkInput`, `VlanAllocation`, `VlanOperationPlan`, `NetworkDevice`, `NetworkContext`). <!-- sdd-owner: implementation -->
- [x] Implement `ExecuteOperationsStage<TContext extends OperationsContext>` in `src/core/pipelines/stages/execute-operations-stage.ts` implementing `Stage<TContext>` with resilient sequential bridge execution and non-mutating context updates. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/core/pipelines/stages/execute-operations-stage.test.ts` to observe GREEN test passage. <!-- sdd-owner: implementation -->

### Phase S2a.3 — Triangulation and Verification Gate (REFACTOR)

- [x] Triangulate edge cases in `tests/core/pipelines/stages/execute-operations-stage.test.ts` verifying that operation parameters are preserved unmutated and execution results reflect exact bridge method and params. <!-- sdd-owner: implementation -->
- [x] Verify full build type-check with `npm run build` and regression suite with `npm test`. <!-- sdd-owner: implementation -->

---

## Sub-Slice S2b: LAN Segment Pipeline and Use Case (~280–360 lines)

Autonomous work unit refactoring `create-lan-segment` into 4 atomic pipeline stages, a dedicated use case, and a thin adapter façade.

### Phase S2b.1 — LAN Stages Tests (RED)

- [x] Write failing unit tests in `tests/core/pipelines/stages/lan-stages.test.ts` covering `PlanLanDevicesStage` (router and PC device planning), `LayoutLanDevicesStage` (auto-layout coordinates and `add_device` operations), `AssignLanIpsStage` (IP calculations via `parseSubnet` and `calcIp`, default and custom gateway overrides), and `PlanLanLinksStage` (star topology link planning). <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/core/pipelines/stages/lan-stages.test.ts` to observe RED test failure. <!-- sdd-owner: implementation -->

### Phase S2b.2 — LAN Pipeline Stages Implementation (GREEN)

- [x] Implement `PlanLanDevicesStage` in `src/core/pipelines/stages/plan-lan-devices-stage.ts` determining device names and models. <!-- sdd-owner: implementation -->
- [x] Implement `LayoutLanDevicesStage` in `src/core/pipelines/stages/layout-lan-devices-stage.ts` computing coordinates via `autoLayout` and appending `add_device` operations. <!-- sdd-owner: implementation -->
- [x] Implement `AssignLanIpsStage` in `src/core/pipelines/stages/assign-lan-ips-stage.ts` importing `parseSubnet` and `calcIp` from `src/core/utils/network/` to configure gateway and host IP operations. <!-- sdd-owner: implementation -->
- [x] Implement `PlanLanLinksStage` in `src/core/pipelines/stages/plan-lan-links-stage.ts` connecting gateway `GigabitEthernet0/0` to host `FastEthernet0/${i}` interfaces. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/core/pipelines/stages/lan-stages.test.ts` to observe GREEN test passage. <!-- sdd-owner: implementation -->

### Phase S2b.3 — LAN Use Case (RED → GREEN)

- [x] Write failing unit tests in `tests/core/use_cases/tools/create-lan-segment.test.ts` asserting end-to-end pipeline execution, `ToolResult<CreateLanSegmentData>` mapping, bridge mode propagation, and total operation counts. <!-- sdd-owner: implementation -->
- [x] Implement `createLanSegmentUseCase` in `src/core/use_cases/tools/create-lan-segment.ts` composing `Pipeline<LanSegmentContext>` with the 4 LAN stages and `ExecuteOperationsStage`. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/core/use_cases/tools/create-lan-segment.test.ts` to observe GREEN test passage. <!-- sdd-owner: implementation -->

### Phase S2b.4 — LAN Adapter Façade & Verification Gate (REFACTOR)

- [x] Refactor `src/tools/composite/create-lan-segment.ts` into a thin validation and delegation façade: retain `CreateLanSegmentSchema`, re-export `CreateLanSegmentParams`, eliminate duplicated IP helper functions, and delegate `execute` to `createLanSegmentUseCase`. <!-- sdd-owner: implementation -->
- [x] Run existing integration suite `npx vitest run tests/tools/composite/create-lan-segment.test.ts` to verify 100% backward compatibility. <!-- sdd-owner: implementation -->
- [x] Verify full build type-check with `npm run build` and regression suite with `npm test`. <!-- sdd-owner: implementation -->

---

## Sub-Slice S2c: Multi-VLAN Network Pipeline and Use Case (~320–395 lines)

Autonomous work unit decomposing `create-network` into 6 atomic pipeline stages, operation collector, use case with invocation-scoped `SubnetAllocator`, and thin adapter façade.

### Phase S2c.1 — Multi-VLAN Stages & Collector Tests (RED)

- [x] Write failing unit tests in `tests/core/pipelines/stages/network-stages.test.ts` covering `AllocateVlanSubnetsStage` (deterministic `/24` subnets via `SubnetAllocator`), `PlanVlanDevicesStage` (switches and hosts per VLAN), `LayoutVlanDevicesStage` (per-VLAN auto-layout coordinates), `ConfigureVlanDevicesStage` (VLAN IOS commands and switch IP configuration), `AssignVlanHostIpsStage` (host addressing), `PlanVlanLinksStage` (switch-to-host links), and `collectVlanOperations` (legacy operation ordering). <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/core/pipelines/stages/network-stages.test.ts` to observe RED test failure. <!-- sdd-owner: implementation -->

### Phase S2c.2 — Multi-VLAN Stages & Collector Implementation (GREEN)

- [x] Implement `AllocateVlanSubnetsStage` in `src/core/pipelines/stages/allocate-vlan-subnets-stage.ts` threading successor `SubnetAllocator` instances across VLANs and computing `.1` gateway IPs. <!-- sdd-owner: implementation -->
- [x] Implement `PlanVlanDevicesStage` in `src/core/pipelines/stages/plan-vlan-devices-stage.ts` assembling `VlanOperationPlan` and `allDevices` entries. <!-- sdd-owner: implementation -->
- [x] Implement `LayoutVlanDevicesStage` in `src/core/pipelines/stages/layout-vlan-devices-stage.ts` applying `autoLayout` independently per VLAN segment. <!-- sdd-owner: implementation -->
- [x] Implement `ConfigureVlanDevicesStage` in `src/core/pipelines/stages/configure-vlan-devices-stage.ts` generating switch IOS VLAN commands and switch IP operations. <!-- sdd-owner: implementation -->
- [x] Implement `AssignVlanHostIpsStage` in `src/core/pipelines/stages/assign-vlan-host-ips-stage.ts` configuring host IPs starting at `.2` with switch gateway. <!-- sdd-owner: implementation -->
- [x] Implement `PlanVlanLinksStage` in `src/core/pipelines/stages/plan-vlan-links-stage.ts` creating straight-through links from switch ports to host interfaces. <!-- sdd-owner: implementation -->
- [x] Implement `collectVlanOperations` in `src/core/pipelines/stages/collect-vlan-operations.ts` flattening per-VLAN device, switch, host IP, and link operation buckets in exact legacy sequence. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/core/pipelines/stages/network-stages.test.ts` to observe GREEN test passage. <!-- sdd-owner: implementation -->

### Phase S2c.3 — Multi-VLAN Use Case (RED → GREEN)

- [x] Write failing unit tests in `tests/core/use_cases/tools/create-network.test.ts` asserting invocation-scoped `SubnetAllocator` isolation across successive/concurrent calls, end-to-end multi-VLAN execution, and `ToolResult<CreateNetworkData>` output mapping. <!-- sdd-owner: implementation -->
- [x] Implement `createNetworkUseCase` in `src/core/use_cases/tools/create-network.ts` initializing a fresh `SubnetAllocator` per invocation and composing `Pipeline<NetworkContext>` with the 6 VLAN stages and `ExecuteOperationsStage`. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/core/use_cases/tools/create-network.test.ts` to observe GREEN test passage. <!-- sdd-owner: implementation -->

### Phase S2c.4 — Multi-VLAN Adapter Façade & Verification Gate (REFACTOR)

- [x] Refactor `src/tools/composite/create-network.ts` into a thin validation and delegation façade: retain `VlanSpecSchema` and `CreateNetworkSchema`, re-export `CreateNetworkParams`, eliminate module-level `let subnetCounter = 1` and local `calcIp`, and delegate `execute` to `createNetworkUseCase`. <!-- sdd-owner: implementation -->
- [x] Run existing integration suite `npx vitest run tests/tools/composite/create-network.test.ts` to verify 100% backward compatibility and unique subnets per VLAN. <!-- sdd-owner: implementation -->
- [x] Verify full build type-check with `npm run build` and complete regression suite with `npm test`. <!-- sdd-owner: implementation -->
