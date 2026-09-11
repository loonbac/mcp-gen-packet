# Slice 1 Foundation Specification

## Purpose

Define the normative behavioral contracts, requirements, and testable scenarios for **Slice 1 (Foundations, Micro-Utilities, and Atomic Types)** of the `micro-modular-alignment` change. This slice delivers the foundational micro-modules required by subsequent slices while adhering strictly to the extreme micro-modularity standards in `AGENTS.md` (one function = one file, zero module-level mutable state, isolated domain types, and composable pipelines), keeping the change strictly below 400 lines and maintaining 100% test pass rate across the existing 125 baseline tests.

---

## Non-Goals (Scope Boundaries for S2–S5)

To protect the review budget (<400 lines) and prevent widespread regression in a single step, the following items are explicitly **excluded** from this specification:

- **S2 (Composite Tools & Pipelines Migration):** Refactoring `src/tools/composite/create-lan-segment.ts` or `src/tools/composite/create-network.ts` into pipeline stages is deferred to Slice 2.
- **S3 (Declarative TUI Client Injection):** Migrating the 12 client adapters in `src/tui/clients/` to use `patchJsonConfig` and declarative descriptors is deferred to Slice 3.
- **S4 (Bridge Decomposition & Ports):** Decomposing `src/bridge/live.ts` into HTTP server, process detector, event buffer, and bridge adapter is deferred to Slice 4.
- **S5 (Catalogs & Server Handlers):** Separating catalog data maps from query functions and extracting MCP server handlers from `src/server.ts` is deferred to Slice 5.
- **No breaking changes:** Public imports, CLI options, MCP protocol methods, and test fixtures remain unchanged.

---

## Constraints and Delivery Gates

1. **Review Budget:** The aggregate implementation, tests, and façades for Slice 1 MUST remain strictly below **400 changed lines**.
2. **Strict TDD:** Each micro-utility and the pipeline runner MUST be developed using strict test-driven development (`tests/core/` mirroring `src/core/`), verifying failing tests before implementation.
3. **Per-Phase Green:** All 125 pre-existing tests across 10 test files MUST remain green (`npm test` passes without failures) at all times.
4. **Compatibility Façade:** Historical import path `src/types/protocol.ts` MUST continue exporting all existing types and interfaces by re-exporting them from the new atomic domain type files.
5. **Zero Module-Level Mutable State:** Extracted utilities MUST NOT use module-scoped mutable variables (e.g., `let subnetCounter = 1`). State must be scoped to function invocations or explicit instance objects.

---

## Requirements

### Requirement: Pure IPv4 Host Address Calculation (`calcIp`)

The system MUST provide a pure utility function `calcIp(baseIp: string, hostIndex: number): string` in `src/core/utils/network/calc-ip.ts` that calculates an IPv4 address by replacing the fourth octet of a base IPv4 address with the specified host index. The function MUST NOT modify external state or mutate its inputs.

#### Scenario: Calculate gateway and host IP addresses
- GIVEN a base network address `"192.168.1.0"`
- WHEN `calcIp("192.168.1.0", 1)` is called
- THEN the result MUST be `"192.168.1.1"`
- WHEN `calcIp("192.168.1.0", 15)` is called
- THEN the result MUST be `"192.168.1.15"`

#### Scenario: Preserve first three octets of arbitrary IPv4 addresses
- GIVEN a base network address `"10.200.45.0"`
- WHEN `calcIp("10.200.45.0", 254)` is called
- THEN the result MUST be `"10.200.45.254"`

---

### Requirement: Subnet Parsing and Normalization (`parseSubnet`)

The system MUST provide a pure utility function `parseSubnet(subnet: string)` in `src/core/utils/network/parse-subnet.ts` that parses an IPv4 CIDR string or plain IP string, normalizes the fourth octet to `"0"`, extracts the base network IP, and parses the optional prefix length.

#### Scenario: Parse CIDR notation subnet
- GIVEN a CIDR string `"192.168.1.0/24"`
- WHEN `parseSubnet("192.168.1.0/24")` is called
- THEN the returned object MUST have `baseIp` equal to `"192.168.1.0"`
- AND `prefix` equal to `24`
- AND `hostIndexBase` equal to `0`

#### Scenario: Normalize host IP in subnet to network address
- GIVEN an IP string with non-zero host octet `"10.0.5.42/16"`
- WHEN `parseSubnet("10.0.5.42/16")` is called
- THEN the returned `baseIp` MUST be `"10.0.5.0"`
- AND `prefix` MUST be `16`

#### Scenario: Parse subnet string without CIDR suffix
- GIVEN a plain IPv4 string `"172.16.10.0"`
- WHEN `parseSubnet("172.16.10.0")` is called
- THEN `baseIp` MUST be `"172.16.10.0"`
- AND `prefix` MUST be `undefined`

---

### Requirement: Immutable Subnet Allocator (`SubnetAllocator`)

The system MUST provide an immutable, invocation-scoped subnet allocator in `src/core/utils/network/subnet-allocator.ts` that generates non-overlapping `/24` subnets (default prefix `"10.0"`) without relying on module-level mutable variables.

#### Scenario: Deterministic sequential subnet allocation
- GIVEN a newly instantiated subnet allocator or pure allocator function
- WHEN allocating three consecutive subnets
- THEN the first subnet MUST be `"10.0.1.0"`
- AND the second subnet MUST be `"10.0.2.0"`
- AND the third subnet MUST be `"10.0.3.0"`

#### Scenario: Isolation between concurrent allocator instances
- GIVEN two independently created allocator instances `allocatorA` and `allocatorB`
- WHEN `allocatorA` allocates two subnets
- THEN `allocatorB.next()` MUST return `"10.0.1.0"` without being affected by `allocatorA`

---

### Requirement: Thread-Safe Asynchronous Queue (`AsyncQueue`)

The system MUST provide a generic, reusable asynchronous queue `AsyncQueue<T>` in `src/core/utils/async/async-queue.ts` supporting FIFO ordering, immediate dequeuing, promise-based waiting with timeouts, length inspection, and clearing.

#### Scenario: Immediate dequeue of already enqueued items
- GIVEN an empty `AsyncQueue<string>`
- WHEN `"command-1"` is enqueued
- THEN `tryDequeue()` MUST return `"command-1"`
- AND `length` MUST be `0`

#### Scenario: Async waiting for upcoming items
- GIVEN an empty `AsyncQueue<string>`
- WHEN `dequeueWithTimeout(1000)` is invoked before any item is enqueued
- AND `"command-async"` is enqueued 50ms later
- THEN the promise MUST resolve with `"command-async"`

#### Scenario: Dequeue timeout expiration
- GIVEN an empty `AsyncQueue<string>`
- WHEN `dequeueWithTimeout(50)` is invoked and no item is enqueued within 50ms
- THEN the promise MUST resolve to `null`

#### Scenario: Queue clearing
- GIVEN an `AsyncQueue<number>` with 3 enqueued items
- WHEN `clear()` is invoked
- THEN it MUST return `3`
- AND `length` MUST be `0`
- AND `tryDequeue()` MUST return `null`

---

### Requirement: Safe File Backup (`backupFile`)

The system MUST provide a pure filesystem utility `backupFile(targetPath: string, backupSuffix?: string): string` in `src/core/utils/fs/backup-file.ts` that copies the file at `targetPath` to a backup location (defaulting to `targetPath + ".bak"`), creating parent directories if needed and throwing a descriptive error if the source file does not exist.

#### Scenario: Successful creation of backup file
- GIVEN an existing file at `/tmp/test-config.json` containing `{"active": true}`
- WHEN `backupFile("/tmp/test-config.json")` is called
- THEN a new file at `/tmp/test-config.json.bak` MUST exist with identical content
- AND the returned string MUST equal `"/tmp/test-config.json.bak"`

#### Scenario: Failure when source file does not exist
- GIVEN a non-existent file path `/tmp/non-existent.json`
- WHEN `backupFile("/tmp/non-existent.json")` is called
- THEN it MUST throw an error indicating that the source file does not exist

---

### Requirement: Atomic JSON Configuration Patching (`patchJsonConfig`)

The system MUST provide a filesystem utility `patchJsonConfig<T>(configPath: string, patchFn: (current: T) => T, options?: PatchOptions)` in `src/core/utils/fs/patch-json-config.ts` that encapsulates reading, backing up, updating, writing, and verifying a JSON configuration file.

#### Scenario: Successfully patch, back up, and verify JSON configuration
- GIVEN an existing JSON configuration file at `configPath`
- WHEN `patchJsonConfig(configPath, (cfg) => ({ ...cfg, mcpServers: { MCP_PTB: { command: "node" } } }))` is executed
- THEN a backup file with `.bak` MUST be created with the previous contents
- AND the file at `configPath` MUST contain valid JSON with the updated property
- AND the operation MUST return `{ success: true, backup: "<backupPath>" }`

#### Scenario: Verification failure rolls back or reports descriptive error
- GIVEN a patch operation with a custom verification predicate that evaluates to `false`
- WHEN `patchJsonConfig(configPath, patchFn, { verify: () => false })` is called
- THEN the operation MUST return `{ success: false, error: expect.stringContaining("Verificación fallida") }`

---

### Requirement: Canonical Packet Tracer Bootstrap Script Generator (`getBootstrapScript`)

The system MUST provide a single authoritative utility `getBootstrapScript(options?: { host?: string; port?: number; intervalMs?: number })` in `src/core/utils/pt/bootstrap-script.ts` that generates the JavaScript IIFE polling script for injection into Packet Tracer.

#### Scenario: Default bootstrap script generation
- GIVEN no options provided
- WHEN `getBootstrapScript()` is called
- THEN the returned script string MUST be an IIFE containing `"http://localhost:54321/next"`
- AND it MUST contain `"$se('runCode'"`
- AND it MUST specify a 500ms polling interval

#### Scenario: Parameterized host and port bootstrap script
- GIVEN custom options `{ host: "127.0.0.1", port: 59999 }`
- WHEN `getBootstrapScript({ host: "127.0.0.1", port: 59999 })` is called
- THEN the returned script string MUST contain `"http://127.0.0.1:59999/next"`

---

### Requirement: Atomic Domain Type Definitions and Protocol Façade

The system MUST decompose `src/types/protocol.ts` into isolated, domain-specific modules under `src/core/types/`, while preserving `src/types/protocol.ts` as a 100% backward-compatible re-export façade.

1. `src/core/types/bridge.ts` MUST export `BridgeRequest`, `BridgeResponse`, and `ExecutionMode`.
2. `src/core/types/tools.ts` MUST export `ToolResult<T>`.
3. `src/core/types/catalog.ts` MUST export `DeviceEntry`, `ModuleEntry`, `LinkTypeEntry`, and `DeviceCategory`.
4. `src/core/types/topology.ts` MUST export `TopologyDevice`, `TopologyLink`, `VlanSpec`, and `LanSegmentConfig`.
5. `src/types/protocol.ts` MUST re-export every interface and type from the four atomic type files.

#### Scenario: Atomic type imports from new domain modules
- GIVEN a module importing from `src/core/types/bridge.js`
- WHEN consuming `BridgeRequest`, `BridgeResponse`, and `ExecutionMode`
- THEN TypeScript compilation MUST succeed without errors

#### Scenario: Backward compatibility through historical protocol façade
- GIVEN existing code or test suites importing from `../../src/types/protocol.js`
- WHEN importing `BridgeAdapter`, `BridgeRequest`, `ToolResult`, `DeviceCategory`, or `TopologyDevice`
- THEN all imports MUST resolve identically to the pre-migration baseline
- AND existing tests in `tests/` MUST pass without modification

---

### Requirement: Composable Pipeline Runner (`Pipeline`)

The system MUST provide a lightweight, generic, typed pipeline runner `Pipeline<TContext>` in `src/core/pipelines/pipeline.ts` allowing stages to be chained with `.pipe()` and executed sequentially with `.execute(initialContext)`.

#### Scenario: Sequential stage execution and context accumulation
- GIVEN a pipeline with two stages: Stage 1 increments a number, Stage 2 doubles it
- WHEN `.execute({ count: 1 })` is called
- THEN the resulting context MUST have `{ count: 4 }`

#### Scenario: Asynchronous stage execution
- GIVEN a stage that returns a Promise resolving to updated context
- WHEN `pipeline.pipe(asyncStage).execute(context)` is called
- THEN the pipeline MUST await the stage promise before executing any subsequent stage
- AND the final promise MUST resolve to the accumulated context

#### Scenario: Pipeline abort and error handling on stage failure
- GIVEN a pipeline where the second stage throws an error
- WHEN `.execute(context)` is called
- THEN the pipeline execution MUST reject with the thrown error
- AND subsequent registered stages MUST NOT be executed
