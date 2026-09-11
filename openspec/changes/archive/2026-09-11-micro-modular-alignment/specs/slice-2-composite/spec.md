# Slice 2 Composite Tools & Pipelines Specification

## Purpose

Define the normative behavioral contracts, requirements, and testable scenarios for **Slice 2 (Composite Tools and Pipelines Migration)** of the `micro-modular-alignment` change. This slice refactors the composite network generation tools (`src/tools/composite/create-lan-segment.ts` and `src/tools/composite/create-network.ts`) from procedural monoliths into composable pipelines assembled from atomic stages, eliminates duplicated address calculations and mutable module-level state, introduces dedicated use cases per action, and preserves 100% backward compatibility with existing public tool interfaces and tests.

---

## Non-Goals (Scope Boundaries for S3–S5)

To protect the review budget (<400 lines per review slice) and prevent uncontained refactoring, the following items are explicitly **excluded** from this specification:

- **S3 (Declarative TUI Client Injection):** Migrating the 12 client adapters in `src/tui/clients/` to declarative descriptors and `patchJsonConfig` is deferred to Slice 3.
- **S4 (Bridge Decomposition & Ports):** Decomposing `src/bridge/live.ts` into HTTP server, process detector, event buffer, and bridge adapter is deferred to Slice 4.
- **S5 (Catalogs & Server Handlers):** Separating catalog data maps from query functions and extracting MCP server handlers from `src/server.ts` is deferred to Slice 5.
- **Primitive Tools Migration:** `src/tools/primitive/*` remain intact in their current form during Slice 2.
- **Protocol or Schema Changes:** No changes to tool names (`packet_tracer_create_lan_segment`, `packet_tracer_create_network`), descriptions, Zod input schemas, or return data shapes (`ToolResult.data`).
- **External Dependencies:** Zero new runtime or development dependencies added to `package.json`.

---

## Constraints and Delivery Gates

1. **Review Budget:** Each sub-slice (S2a, S2b, S2c) MUST remain strictly below **400 changed lines** (including stages, use cases, tests, and adapter facades).
2. **Strict TDD:** Every pipeline stage, use case, and refactored adapter MUST be developed using strict test-driven development (RED -> GREEN -> REFACTOR) with unit tests located under `tests/core/pipelines/stages/` and `tests/core/use_cases/tools/`.
3. **Per-Phase Green:** All 189 pre-existing tests across 20 test files MUST remain green (`npm test` passes with zero failures) before and after each sub-slice.
4. **Zero Module-Level Mutable State:** The multi-VLAN tool MUST completely eliminate `let subnetCounter = 1` and any module-scoped state. Subnet allocation MUST be scoped to the execution context of each invocation.
5. **Zero Duplicated Utilities:** Local duplicated functions `calcIp()` and `parseSubnet()` in `create-lan-segment.ts` and `create-network.ts` MUST be removed; both tools MUST consume `calcIp` and `parseSubnet` from `src/core/utils/network/`.
6. **Backward Compatibility:** `src/tools/composite/create-lan-segment.ts` and `src/tools/composite/create-network.ts` MUST retain their public exports (`createLanSegmentTool`, `CreateLanSegmentSchema`, `CreateLanSegmentParams`, `createNetworkTool`, `CreateNetworkSchema`, `CreateNetworkParams`, `VlanSpecSchema`) as thin adapters delegating to use cases.

---

## Requirements

### Requirement: Deduplication of Network Calculations via Core Micro-Utilities

The system MUST replace local duplicated implementations of `calcIp()` and `parseSubnet()` in `src/tools/composite/create-lan-segment.ts` and `src/tools/composite/create-network.ts` with pure imports from `src/core/utils/network/calc-ip.js` and `src/core/utils/network/parse-subnet.js`. Composite tools and stages MUST NOT define private or ad-hoc IP string manipulation functions.

#### Scenario: Compute LAN host IP addresses using core `calcIp`
- GIVEN a parsed LAN subnet base IP `"192.168.1.0"`
- WHEN calculating IP addresses for gateway and 3 hosts using `calcIp`
- THEN the gateway IP MUST be `"192.168.1.1"`
- AND host 1 IP MUST be `"192.168.1.2"`
- AND host 2 IP MUST be `"192.168.1.3"`
- AND host 3 IP MUST be `"192.168.1.4"`

#### Scenario: Parse LAN subnet notation using core `parseSubnet`
- GIVEN a user-supplied subnet string `"10.10.0.0/24"` or `"10.10.0.0"`
- WHEN parsed via `parseSubnet`
- THEN `baseIp` MUST be `"10.10.0.0"`
- AND `hostIndexBase` MUST be `0`

---

### Requirement: Invocation-Scoped Deterministic Subnet Allocation

The multi-VLAN network pipeline MUST allocate `/24` subnets dynamically using an instance of `SubnetAllocator` scoped exclusively to the invocation context. The module MUST NOT declare or mutate any module-level counters (specifically eliminating `let subnetCounter = 1`).

#### Scenario: First VLAN receives initial 10.0.1.0/24 subnet
- GIVEN a network creation request with VLAN 10
- WHEN subnet allocation runs for the first VLAN
- THEN the allocated subnet MUST be `"10.0.1.0"`
- AND the gateway IP for VLAN 10 MUST be `"10.0.1.1"`

#### Scenario: Sequential subnets allocated within a single execution
- GIVEN a network creation request with VLANs 10, 20, and 30
- WHEN subnet allocation processes the VLANs sequentially
- THEN VLAN 10 MUST receive subnet `"10.0.1.0"`
- AND VLAN 20 MUST receive subnet `"10.0.2.0"`
- AND VLAN 30 MUST receive subnet `"10.0.3.0"`

#### Scenario: Complete isolation across independent invocations
- GIVEN two successive calls to network creation
- WHEN the first call processes 2 VLANs (allocating `"10.0.1.0"` and `"10.0.2.0"`)
- AND the second call processes 1 VLAN
- THEN the second call's first VLAN MUST receive `"10.0.1.0"` without state contamination from the previous call

---

### Requirement: Atomic Batch Operation Execution Pipeline Stage (`ExecuteOperationsStage`)

The system MUST provide an atomic, reusable pipeline stage `ExecuteOperationsStage` in `src/core/pipelines/stages/execute-operations-stage.ts` conforming to `Stage<TContext>`. The stage MUST execute a list of planned operations sequentially against the supplied `BridgeAdapter`, record execution outcomes (`{ success: boolean, method: string, params: Record<string, unknown> }`), and handle operation failures without throwing unhandled exceptions.

#### Scenario: Execute all operations successfully against bridge
- GIVEN a pipeline context containing 3 planned operations and a functional `BridgeAdapter`
- WHEN `ExecuteOperationsStage.execute(context)` is called
- THEN the bridge `execute` method MUST be called exactly 3 times with corresponding methods and params
- AND the returned context MUST contain 3 execution results with `success: true`

#### Scenario: Resilient partial failure handling
- GIVEN a pipeline context containing 3 planned operations
- AND the second operation causes the bridge to throw an error
- WHEN `ExecuteOperationsStage.execute(context)` is called
- THEN operation 1 result MUST have `success: true`
- AND operation 2 result MUST have `success: false`
- AND operation 3 MUST still be executed and record `success: true`
- AND the stage MUST NOT throw or abort execution

---

### Requirement: Composable LAN Segment Pipeline Stages

The system MUST decompose the procedural logic of `create-lan-segment` into atomic, single-responsibility stages implementing `Stage<LanSegmentContext>` under `src/core/pipelines/stages/`:
1. `PlanLanDevicesStage`: determines device names and models (`${name}-GW` with `"Router-PT"`, `${name}-H${i}` with `"PC-PT"`).
2. `LayoutLanDevicesStage`: calculates device coordinates using `autoLayout()` and adds `add_device` operations.
3. `AssignLanIpsStage`: calculates gateway IP and host IPs using `calcIp` and adds `configure_pc_ip` operations.
4. `PlanLanLinksStage`: determines port assignments (`GigabitEthernet0/0` on gateway to `FastEthernet0/${i}` on hosts) and adds `add_link` operations.

#### Scenario: Plan LAN devices with gateway router and host PCs
- GIVEN a LAN segment named `"Office"` with 3 hosts
- WHEN `PlanLanDevicesStage.execute(context)` runs
- THEN device names MUST be `["Office-GW", "Office-H1", "Office-H2", "Office-H3"]`
- AND gateway model MUST be `"Router-PT"`
- AND host models MUST be `"PC-PT"`

#### Scenario: Apply auto-layout positioning to LAN devices
- GIVEN planned device names `["Office-GW", "Office-H1", "Office-H2"]`
- WHEN `LayoutLanDevicesStage.execute(context)` runs
- THEN `operations` MUST contain 3 `add_device` calls
- AND all 3 devices MUST have coordinates assigned via `autoLayout` with distance >= 150px

#### Scenario: Assign IP addresses to LAN gateway and hosts
- GIVEN base IP `"192.168.1.0"` and 2 hosts
- WHEN `AssignLanIpsStage.execute(context)` runs
- THEN `operations` MUST include `configure_pc_ip` for gateway with IP `"192.168.1.1"` and subnet mask `"255.255.255.0"`
- AND `operations` MUST include `configure_pc_ip` for host 1 with IP `"192.168.1.2"`, subnet mask `"255.255.255.0"`, and gateway `"192.168.1.1"`
- AND `operations` MUST include `configure_pc_ip` for host 2 with IP `"192.168.1.3"`, subnet mask `"255.255.255.0"`, and gateway `"192.168.1.1"`

#### Scenario: Support custom gateway IP override
- GIVEN base IP `"192.168.1.0"`, 2 hosts, and custom gateway `"192.168.1.254"`
- WHEN `AssignLanIpsStage.execute(context)` runs
- THEN the gateway configuration IP MUST be `"192.168.1.254"`
- AND each host configuration MUST specify gateway `"192.168.1.254"`

#### Scenario: Plan star topology links between gateway and hosts
- GIVEN gateway `"Office-GW"` and hosts `["Office-H1", "Office-H2"]`
- WHEN `PlanLanLinksStage.execute(context)` runs
- THEN `operations` MUST include an `add_link` connecting `Office-GW:GigabitEthernet0/0` to `Office-H1:FastEthernet0/1`
- AND `operations` MUST include an `add_link` connecting `Office-GW:GigabitEthernet0/0` to `Office-H2:FastEthernet0/2`
- AND link types MUST be `"ethernet-straight"`

---

### Requirement: Atomic Create LAN Segment Use Case (`CreateLanSegmentUseCase`)

The system MUST provide an atomic use case in `src/core/use_cases/tools/create-lan-segment.ts` that constructs and executes a `Pipeline<LanSegmentContext>` chaining `PlanLanDevicesStage`, `LayoutLanDevicesStage`, `AssignLanIpsStage`, `PlanLanLinksStage`, and `ExecuteOperationsStage`. The use case MUST accept `BridgeAdapter` and `CreateLanSegmentParams` and return a standard `ToolResult` matching legacy structure.

#### Scenario: Execute end-to-end LAN segment generation
- GIVEN valid LAN segment parameters `{ name: "Lab", subnet: "192.168.10.0", hosts: 2 }` and a mock `BridgeAdapter`
- WHEN `createLanSegmentUseCase(bridge, params)` is executed
- THEN the returned `ToolResult` MUST have `mode` equal to `bridge.getMode()`
- AND `data.segmentName` MUST be `"Lab"`
- AND `data.gateway` MUST be `"Lab-GW"`
- AND `data.gatewayIp` MUST be `"192.168.10.1"`
- AND `data.hosts` MUST equal `["Lab-H1", "Lab-H2"]`
- AND `data.operations` MUST contain execution results for all planned device, IP, and link operations

---

### Requirement: Composable Multi-VLAN Network Pipeline Stages

The system MUST decompose the procedural logic of `create-network` into atomic, single-responsibility stages implementing `Stage<NetworkContext>` under `src/core/pipelines/stages/`:
1. `AllocateVlanSubnetsStage`: uses an invocation-scoped `SubnetAllocator` to assign unique `/24` subnets and gateway IPs per VLAN.
2. `PlanVlanDevicesStage`: plans switch (`VLAN${id}-SW` with `"Switch-PT"`) and host devices (`VLAN${id}-H${i}` with `"PC-PT"`).
3. `LayoutVlanDevicesStage`: computes auto-layout coordinates per VLAN segment and adds `add_device` operations.
4. `ConfigureVlanDevicesStage`: adds `configure_ios_device` operations (VLAN database commands) and switch IP configuration operations.
5. `AssignVlanHostIpsStage`: assigns host IPs (`calcIp(subnet, i + 2)`) and adds `configure_pc_ip` operations with switch gateway.
6. `PlanVlanLinksStage`: adds `add_link` operations connecting switch FastEthernet ports (`FastEthernet0/${i+1}`) to host FastEthernet ports (`FastEthernet0`).

#### Scenario: Plan switch and host devices per VLAN
- GIVEN VLANs `[{ id: 10, name: "HR" }, { id: 20, name: "Finance" }]` with 2 hosts per VLAN
- WHEN `PlanVlanDevicesStage.execute(context)` runs
- THEN `allDevices` MUST contain 2 switches and 4 hosts (total 6 devices)
- AND switch names MUST be `"VLAN10-SW"` and `"VLAN20-SW"`
- AND host names MUST be `"VLAN10-H1"`, `"VLAN10-H2"`, `"VLAN20-H1"`, and `"VLAN20-H2"`

#### Scenario: Generate switch VLAN configuration commands
- GIVEN VLAN 10 named `"HR"` on switch `"VLAN10-SW"`
- WHEN `ConfigureVlanDevicesStage.execute(context)` runs
- THEN `operations` MUST include `configure_ios_device` for `"VLAN10-SW"`
- AND the commands MUST be `"vlan 10\nname HR\nexit"`
- AND `operations` MUST include `configure_pc_ip` for `"VLAN10-SW"` with gateway IP `"10.0.1.1"` and subnet mask `"255.255.255.0"`

#### Scenario: Assign host IP addresses in corresponding VLAN subnets
- GIVEN VLAN 10 on subnet `"10.0.1.0"` and VLAN 20 on subnet `"10.0.2.0"` with 2 hosts each
- WHEN `AssignVlanHostIpsStage.execute(context)` runs
- THEN host `"VLAN10-H1"` MUST be configured with IP `"10.0.1.2"` and gateway `"10.0.1.1"`
- AND host `"VLAN10-H2"` MUST be configured with IP `"10.0.1.3"` and gateway `"10.0.1.1"`
- AND host `"VLAN20-H1"` MUST be configured with IP `"10.0.2.2"` and gateway `"10.0.2.1"`
- AND host `"VLAN20-H2"` MUST be configured with IP `"10.0.2.3"` and gateway `"10.0.2.1"`

#### Scenario: Plan links from switch ports to host ports
- GIVEN switch `"VLAN10-SW"` and hosts `["VLAN10-H1", "VLAN10-H2"]`
- WHEN `PlanVlanLinksStage.execute(context)` runs
- THEN `operations` MUST include `add_link` from `"VLAN10-SW:FastEthernet0/1"` to `"VLAN10-H1:FastEthernet0"`
- AND `operations` MUST include `add_link` from `"VLAN10-SW:FastEthernet0/2"` to `"VLAN10-H2:FastEthernet0"`
- AND link types MUST be `"ethernet-straight"`

---

### Requirement: Atomic Create Network Use Case (`CreateNetworkUseCase`)

The system MUST provide an atomic use case in `src/core/use_cases/tools/create-network.ts` that constructs and executes a `Pipeline<NetworkContext>` chaining `AllocateVlanSubnetsStage`, `PlanVlanDevicesStage`, `LayoutVlanDevicesStage`, `ConfigureVlanDevicesStage`, `AssignVlanHostIpsStage`, `PlanVlanLinksStage`, and `ExecuteOperationsStage`. The use case MUST accept `BridgeAdapter` and `CreateNetworkParams` and return a standard `ToolResult` matching legacy structure.

#### Scenario: Execute end-to-end multi-VLAN network generation
- GIVEN valid network parameters `{ vlans: [{ id: 10, name: "HR" }, { id: 20, name: "IT" }], hostsPerVlan: 2 }` and a mock `BridgeAdapter`
- WHEN `createNetworkUseCase(bridge, params)` is executed
- THEN the returned `ToolResult` MUST have `mode` equal to `bridge.getMode()`
- AND `data.vlans` MUST match the input VLAN list
- AND `data.hostsPerVlan` MUST equal `2`
- AND `data.allDevices` MUST list all 6 devices with correct types (`"switch"` | `"host"`)
- AND `data.operations` MUST contain execution results for all planned operations

---

### Requirement: Composite Tool Adapter Facades and API Backward Compatibility

The tool modules `src/tools/composite/create-lan-segment.ts` and `src/tools/composite/create-network.ts` MUST serve as thin validation/transport adapters:
1. Parse and validate input using their respective Zod schemas (`CreateLanSegmentSchema`, `CreateNetworkSchema`).
2. Delegate execution directly to `createLanSegmentUseCase` and `createNetworkUseCase`.
3. Retain all historical named exports and object properties.
4. Pass all existing tests in `tests/tools/composite/create-lan-segment.test.ts` and `tests/tools/composite/create-network.test.ts` without modifying the test assertions.

#### Scenario: `createLanSegmentTool.execute` delegates to use case and satisfies existing tests
- GIVEN `createLanSegmentTool` invoked with mock bridge and parameters `{ name: "Sales", subnet: "192.168.1.0", hosts: 3 }`
- WHEN `createLanSegmentTool.execute(bridge, params)` is called
- THEN it MUST validate params via `CreateLanSegmentSchema`
- AND delegate to `createLanSegmentUseCase`
- AND produce exactly 4 `add_device` calls, gateway at `.1`, hosts at `.2`–`.4`, 3 `add_link` calls, and spacing >= 150px

#### Scenario: `createNetworkTool.execute` delegates to use case and satisfies existing tests
- GIVEN `createNetworkTool` invoked with mock bridge and parameters `{ vlans: [{ id: 10, name: "Sales" }, { id: 20, name: "Engineering" }], hostsPerVlan: 3 }`
- WHEN `createNetworkTool.execute(bridge, params)` is called
- THEN it MUST validate params via `CreateNetworkSchema`
- AND delegate to `createNetworkUseCase`
- AND produce 2 switches, 6 hosts (8 `add_device` calls), >= 2 `configure_ios_device` calls, and unique subnets per VLAN

#### Scenario: Schema validation error rejection
- GIVEN invalid parameters missing required fields or with invalid ranges (e.g., `hosts: 0` or `vlan.id: 5000`)
- WHEN `execute(bridge, invalidParams)` is called on either tool
- THEN a Zod validation error MUST be thrown immediately before any pipeline or bridge interaction occurs

---

## Sub-Slice Delivery Plan (<400 Lines per Review Slice)

To ensure strict adherence to the review budget constraint (<400 changed lines per review slice), Slice 2 is delivered in three discrete, independently green sub-slices:

| Sub-Slice | Scope | Forecasted Lines | Review Boundary |
|---|---|---|---|
| **S2a** | Common pipeline interfaces, types (`src/core/pipelines/types.ts`), and `ExecuteOperationsStage` (`src/core/pipelines/stages/execute-operations-stage.ts`) + unit tests | ~150 lines | Sub-slice S2a PR / review unit |
| **S2b** | LAN stages (`plan-lan-devices`, `layout-lan-devices`, `assign-lan-ips`, `plan-lan-links`), `createLanSegmentUseCase`, adapter refactor in `src/tools/composite/create-lan-segment.ts` + unit tests | ~280 lines | Sub-slice S2b PR / review unit |
| **S2c** | Multi-VLAN stages (`allocate-vlan-subnets`, `plan-vlan-devices`, `layout-vlan-devices`, `configure-vlan-devices`, `assign-vlan-ips`, `plan-vlan-links`), `createNetworkUseCase`, adapter refactor in `src/tools/composite/create-network.ts` + unit tests | ~320 lines | Sub-slice S2c PR / review unit |
