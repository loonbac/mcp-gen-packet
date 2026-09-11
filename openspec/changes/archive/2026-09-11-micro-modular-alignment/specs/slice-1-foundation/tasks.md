    # Tasks: Slice 1 Foundation
    
    ## Review Workload Forecast
    
    | Field | Value |
    |-------|-------|
    | Estimated changed lines | 800–1,140 lines aggregate (S1a: 190–260, S1b: 180–260, S1c: 190–280, S1d: 240–340) |
    | 400-line budget risk | High |
    | Chained PRs recommended | Yes |
    | Suggested split | S1a (network + pipeline) → S1b (queue + bootstrap) → S1c (filesystem) → S1d (atomic types & façade) |
    | Delivery strategy | ask-on-risk |
    | Chain strategy | pending |
    
    Decision needed before apply: Yes
    Chained PRs recommended: Yes
    Chain strategy: pending
    400-line budget risk: High
    
    ---
    
    ## Delivery Gate & Review Strategy Recommendation
    
    Under the `ask-on-risk` delivery strategy, because the aggregate forecast for Slice 1 (800–1,140 changed lines across 14 implementation/type files and 9 test files) exceeds the 400-line review budget, human confirmation is required before applying changes.
    
    To eliminate review overload and maintain high review rigor, Slice 1 is partitioned into four autonomous, reviewable work units (sub-slices S1a, S1b, S1c, S1d), each strictly under 400 changed lines. Each work unit possesses clear start, finish, verification (`npx vitest run <path>`, `npm test`, `npm run build`), and rollback boundaries.
    
    ---
    
    ## Sub-slice S1a: Pure Network Utilities and Pipeline Runner
    
    - **Goal**: Implement pure IPv4 address calculation, subnet parsing/normalization, persistent immutable subnet allocation, and the generic typed pipeline runner.
    - **Estimated changed lines**: 190–260 lines.
    - **400-line budget risk**: Low.
    - **Rollback boundary**: Delete new files in `src/core/utils/network/`, `src/core/pipelines/`, and `tests/core/utils/network/`, `tests/core/pipelines/`. No pre-existing files are touched.
    
    ### Tasks
    
    - [x] RED: Create unit tests in `tests/core/utils/network/calc-ip.test.ts` asserting fourth-octet replacement (`.1`, `.15`, `.254`) and input non-mutation. <!-- sdd-owner: implementation -->
    - [x] GREEN: Implement pure function `calcIp(baseIp: string, hostIndex: number): string` in `src/core/utils/network/calc-ip.ts`. <!-- sdd-owner: implementation -->
    - [x] TRIANGULATE & REFACTOR: Verify edge cases (arbitrary first 3 octets, boundary host indices) in `tests/core/utils/network/calc-ip.test.ts` and ensure pure function semantics. <!-- sdd-owner: implementation -->
    - [x] RED: Create unit tests in `tests/core/utils/network/parse-subnet.test.ts` asserting CIDR parsing, host octet zeroing, and no-prefix handling. <!-- sdd-owner: implementation -->
    - [x] GREEN: Implement `parseSubnet(subnet: string): ParsedSubnet` in `src/core/utils/network/parse-subnet.ts`. <!-- sdd-owner: implementation -->
    - [x] TRIANGULATE & REFACTOR: Validate integer prefix parsing, `hostIndexBase === 0`, and invalid/missing suffix branches in `tests/core/utils/network/parse-subnet.test.ts`. <!-- sdd-owner: implementation -->
    - [x] RED: Create unit tests in `tests/core/utils/network/subnet-allocator.test.ts` asserting sequential subnet generation (`10.0.1.0`, `10.0.2.0`, `10.0.3.0`) and state persistence via returned allocator instances. <!-- sdd-owner: implementation -->
    - [x] GREEN: Implement immutable `SubnetAllocator` class in `src/core/utils/network/subnet-allocator.ts` with `next(): SubnetAllocation`. <!-- sdd-owner: implementation -->
    - [x] TRIANGULATE & REFACTOR: Verify isolation between distinct instances (`allocatorA` vs `allocatorB`), custom prefix support, and zero module-level mutable state in `tests/core/utils/network/subnet-allocator.test.ts`. <!-- sdd-owner: implementation -->
    - [x] RED: Create unit tests in `tests/core/pipelines/pipeline.test.ts` asserting sequential stage execution, async stage awaiting, and error halting. <!-- sdd-owner: implementation -->
    - [x] GREEN: Implement generic `Pipeline<TContext>` and `Stage<TContext>` interfaces in `src/core/pipelines/pipeline.ts`. <!-- sdd-owner: implementation -->
    - [x] TRIANGULATE & REFACTOR: Validate immutable `.pipe()` chaining (original pipeline remains unmodified) and propagated error identity in `tests/core/pipelines/pipeline.test.ts`. <!-- sdd-owner: implementation -->
    - [x] S1a Quality Gate: Verify all focused tests pass (`npx vitest run tests/core/utils/network/ tests/core/pipelines/`), full suite passes (`npm test`), and TypeScript compiles (`npm run build`). <!-- sdd-owner: implementation -->
    
    ---
    
    ## Sub-slice S1b: Thread-Safe Async Queue & Packet Tracer Bootstrap Script
    
    - **Goal**: Implement the generic async FIFO queue, authoritative Packet Tracer polling bootstrap generator, and delegate historical bootstrap scripts without API regressions.
    - **Estimated changed lines**: 180–260 lines.
    - **400-line budget risk**: Low.
    - **Rollback boundary**: Revert `src/bridge/live.ts` and `src/tools/primitive/bridge-connect.ts` to their git HEAD; delete `src/core/utils/async/` and `src/core/utils/pt/`.
    
    ### Tasks
    
    - [x] RED: Create unit tests in `tests/core/utils/async/async-queue.test.ts` covering FIFO immediate dequeue, timeout expiration with fake timers, waiting consumer resolution, and queue clearing. <!-- sdd-owner: implementation -->
    - [x] GREEN: Implement `AsyncQueue<T>` class in `src/core/utils/async/async-queue.ts`. <!-- sdd-owner: implementation -->
    - [x] TRIANGULATE & REFACTOR: Validate FIFO ordering of waiters, timeout cleanup ensuring no memory leaks, and `length` reporting only buffered items in `tests/core/utils/async/async-queue.test.ts`. <!-- sdd-owner: implementation -->
    - [x] RED: Create unit tests in `tests/core/utils/pt/bootstrap-script.test.ts` checking default IIFE output (`http://localhost:54321/next`, 500ms interval, `$se('runCode')`) and custom parameter handling. <!-- sdd-owner: implementation -->
    - [x] GREEN: Implement `getBootstrapScript(options?: BootstrapScriptOptions): string` in `src/core/utils/pt/bootstrap-script.ts`. <!-- sdd-owner: implementation -->
    - [x] TRIANGULATE & REFACTOR: Verify error loop retry behavior and parameter variations in `tests/core/utils/pt/bootstrap-script.test.ts`. <!-- sdd-owner: implementation -->
    - [x] Delegate `src/tools/primitive/bridge-connect.ts` embedded script to `getBootstrapScript()`. <!-- sdd-owner: implementation -->
    - [x] Delegate `LiveBridge.prototype.bootstrapScript` in `src/bridge/live.ts` to `getBootstrapScript({ host: this.host, port: this.port })`. <!-- sdd-owner: implementation -->
    - [x] S1b Quality Gate: Verify all focused tests pass (`npx vitest run tests/core/utils/async/ tests/core/utils/pt/`), all 125 baseline tests remain green (`npm test`), and TypeScript compiles (`npm run build`). <!-- sdd-owner: implementation -->
    
    ---
    
    ## Sub-slice S1c: Safe Filesystem Utilities
    
    - **Goal**: Implement isolated backup utility and atomic transactional JSON configuration patcher with rollback capabilities.
    - **Estimated changed lines**: 190–280 lines.
    - **400-line budget risk**: Low.
    - **Rollback boundary**: Delete `src/core/utils/fs/` and `tests/core/utils/fs/`. No pre-existing files are touched.
    
    ### Tasks
    
    - [x] RED: Create unit tests in `tests/core/utils/fs/backup-file.test.ts` asserting byte-identical `.bak` file creation, custom suffix support, and non-existent source errors. <!-- sdd-owner: implementation -->
    - [x] GREEN: Implement `backupFile(targetPath: string, backupSuffix?: string): string` in `src/core/utils/fs/backup-file.ts`. <!-- sdd-owner: implementation -->
    - [x] TRIANGULATE & REFACTOR: Verify directory creation and error message fidelity in `tests/core/utils/fs/backup-file.test.ts`. <!-- sdd-owner: implementation -->
    - [x] RED: Create unit tests in `tests/core/utils/fs/patch-json-config.test.ts` covering successful patch/backup/verify, verification failure rollback, temp file cleanup, and malformed JSON errors. <!-- sdd-owner: implementation -->
    - [x] GREEN: Implement `patchJsonConfig<T>(configPath: string, patchFn: (current: T) => T, options?: PatchOptions<T>): PatchJsonConfigResult` in `src/core/utils/fs/patch-json-config.ts`. <!-- sdd-owner: implementation -->
    - [x] TRIANGULATE & REFACTOR: Verify atomic sibling replacement (avoiding premature unlink) and error response structure with optional backup path in `tests/core/utils/fs/patch-json-config.test.ts`. <!-- sdd-owner: implementation -->
    - [x] S1c Quality Gate: Verify all focused tests pass (`npx vitest run tests/core/utils/fs/`), full suite passes (`npm test`), and TypeScript compiles (`npm run build`). <!-- sdd-owner: implementation -->
    
    ---
    
    ## Sub-slice S1d: Atomic Domain Types & Protocol Façade
    
    - **Goal**: Decompose `src/types/protocol.ts` into atomic domain type modules under `src/core/types/`, decouple cycles in `src/bridge/adapter.ts`, and retain `src/types/protocol.ts` as a 100% backward-compatible re-export façade.
    - **Estimated changed lines**: 240–340 lines.
    - **400-line budget risk**: Low.
    - **Rollback boundary**: Revert `src/types/protocol.ts` and `src/bridge/adapter.ts` to git HEAD; delete `src/core/types/` and `tests/core/types/`.
    
    ### Tasks
    
    - [x] Update `src/bridge/adapter.ts` to import `ExecutionMode` and `ToolResult` from canonical domain types to prevent circular dependencies with the protocol façade. <!-- sdd-owner: implementation -->
    - [x] Create atomic bridge domain types in `src/core/types/bridge.ts` (`BridgeRequest`, `BridgeResponse`, `ExecutionMode`). <!-- sdd-owner: implementation -->
    - [x] Create atomic tool domain types in `src/core/types/tools.ts` (`ToolResult<T>`). <!-- sdd-owner: implementation -->
    - [x] Create atomic catalog domain types in `src/core/types/catalog.ts` (`DeviceEntry`, `ModuleEntry`, `LinkTypeEntry`, `DeviceCategory`). <!-- sdd-owner: implementation -->
    - [x] Create atomic topology domain types in `src/core/types/topology.ts` (`TopologyDevice`, `TopologyLink`, `VlanSpec`, `LanSegmentConfig`). <!-- sdd-owner: implementation -->
    - [x] Convert `src/types/protocol.ts` into a pure re-export façade forwarding all types from `src/core/types/*` and `BridgeAdapter` from `src/bridge/adapter.js`. <!-- sdd-owner: implementation -->
    - [x] RED: Create type-compatibility tests in `tests/core/types/protocol-facade.test.ts` using `expectTypeOf` to assert type identity between canonical modules and the historical façade. <!-- sdd-owner: implementation -->
    - [x] GREEN: Ensure `tests/core/types/protocol-facade.test.ts` passes and all historical imports in existing tests continue resolving without error. <!-- sdd-owner: implementation -->
    - [x] TRIANGULATE & REFACTOR: Validate generic parameters on `ToolResult<T>`, exact union member exhaustiveness on `DeviceCategory`, and absence of any runtime code in `src/types/protocol.ts`. <!-- sdd-owner: implementation -->
    - [x] S1d Quality Gate: Verify all focused tests pass (`npx vitest run tests/core/types/`), full test suite passes with 0 regressions (`npm test`), and authoritative TypeScript compilation passes (`npm run build`). <!-- sdd-owner: implementation -->
    
    
    