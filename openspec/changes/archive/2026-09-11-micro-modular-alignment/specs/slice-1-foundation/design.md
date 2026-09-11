# Design: Slice 1 Foundation

## Status

- **status**: `designed_with_delivery_gate`
- **change**: `micro-modular-alignment`
- **scope**: `slice-1-foundation only`
- **execution**: `auto`
- **artifact_store**: `openspec`
- **strict_tdd**: `true`
- **review_budget**: `<400 changed lines per review unit`
- **skill_resolution**: `fallback-path` (`gentle-ai` and `gentle-ai-cognitive-doc-design`; no phase-specific skill path was injected)

## Executive summary

Slice 1 introduces leaf-level foundations only: pure IPv4 helpers, a persistent immutable subnet allocator, a generic async queue, safe filesystem helpers, one Packet Tracer bootstrap-script source, four atomic type modules with the historical protocol façade, and an immutable typed pipeline runner. Composite-tool migration, TUI client migration, bridge decomposition, and catalog/server restructuring remain S2–S5 non-goals.

Canonical code imports leaf modules using NodeNext `.js` specifiers. Existing imports through `src/types/protocol.ts` remain valid. The pipeline is delivered now because the Slice 1 specification explicitly includes it, but no composite tool adopts it until S2.

The complete requested scope cannot credibly fit below 400 aggregate changed lines: splitting the existing 104-line protocol file alone counts roughly 208 changed lines before utilities and tests. Implementation therefore requires four independently green work units, each forecast below 400 lines. Under `ask-on-risk`, selecting their PR/chain packaging remains a human gate; no chain strategy or size exception is inferred here.

## Scope boundaries

### Included

- `src/core/utils/network/{calc-ip,parse-subnet,subnet-allocator}.ts`
- `src/core/utils/async/async-queue.ts`
- `src/core/utils/fs/{backup-file,patch-json-config}.ts`
- `src/core/utils/pt/bootstrap-script.ts`
- `src/core/types/{bridge,tools,catalog,topology}.ts`
- Compatibility façade `src/types/protocol.ts`
- `src/core/pipelines/pipeline.ts`
- Focused tests mirroring these modules under `tests/core/`
- Minimal delegations from the two existing bootstrap-script owners

### Explicitly excluded

- Refactoring either composite tool to consume the helpers or pipeline (S2).
- Replacing mutable subnet state inside `create-network.ts` (S2 migration).
- Migrating any TUI client to `patchJsonConfig` (S3).
- Extracting `AsyncQueue` usage from `LiveBridge` (S4); Slice 1 only establishes and tests the canonical queue.
- Decomposing live HTTP, process detection, event buffering, or monitor rendering (S4).
- Splitting catalog data/query implementations or server handlers (S5).
- Removing historical façades or changing MCP-visible contracts.

## Architecture and dependency direction

```text
src/tools, src/bridge, src/catalogs
        │
        ├── temporary compatibility import ──> src/types/protocol.ts
        │                                      │
        │                                      └── re-export only
        └── canonical leaf imports ─────────> src/core/types/*

future S2/S3/S4 consumers ──> src/core/utils/*
future S2 consumers ────────> src/core/pipelines/pipeline.ts
```

`src/core/**` must not import from `src/tools`, `src/tui`, `src/bridge`, `src/catalogs`, or `src/types/protocol.ts`. The compatibility façade points inward to atomic types; canonical modules never point back to the façade. No new generic barrel is introduced because leaf imports make responsibility and dependency ownership explicit.

## Exact TypeScript contracts

All source imports use `.js` suffixes even when the source file is `.ts`, as required by `moduleResolution: "NodeNext"`.

### Network utilities

```ts
// src/core/utils/network/calc-ip.ts
export function calcIp(baseIp: string, hostIndex: number): string;
```

`calcIp` copies the first three dot-separated components and stringifies `hostIndex` into the fourth component. It performs no CIDR arithmetic, octet carry, input mutation, or hidden validation so the later S2 migration preserves current calculations.

```ts
// src/core/utils/network/parse-subnet.ts
export interface ParsedSubnet {
  readonly baseIp: string;
  readonly prefix: number | undefined;
  readonly hostIndexBase: 0;
}

export function parseSubnet(subnet: string): ParsedSubnet;
```

The function separates the first `/` suffix, forces the fourth address component to `"0"`, and parses a present prefix with `Number.parseInt(value, 10)`. No suffix yields `undefined`; malformed values are not newly rejected in this architecture slice.

```ts
// src/core/utils/network/subnet-allocator.ts
export interface SubnetAllocation {
  readonly subnet: string;
  readonly allocator: SubnetAllocator;
}

export class SubnetAllocator {
  readonly prefix: string;
  readonly nextIndex: number;

  constructor(prefix?: string, nextIndex?: number);
  next(): SubnetAllocation;
}
```

Defaults are `prefix = "10.0"` and `nextIndex = 1`. `next()` returns `{ subnet: `${prefix}.${nextIndex}.0`, allocator: new SubnetAllocator(prefix, nextIndex + 1) }`; it never mutates the receiver. Sequential use rebinds the returned allocator. This resolves the specification's tension between an “immutable” allocator and repeated allocation: the allocated string is `allocator.next().subnet`, while the returned allocator owns the next state. Independent roots therefore always begin at `10.0.1.0`.

### Async queue

```ts
// src/core/utils/async/async-queue.ts
export class AsyncQueue<T> {
  enqueue(value: T): void;
  tryDequeue(): T | null;
  dequeueWithTimeout(timeoutMs: number): Promise<T | null>;
  get length(): number;
  clear(): number;
}
```

Behavioral decisions:

- Items and waiting consumers are FIFO.
- `enqueue` satisfies the oldest pending consumer before buffering an item.
- `length` counts buffered items only, matching `LiveBridge` queue-depth behavior.
- A timeout removes only its own pending resolver and resolves once with `null`.
- `clear` removes buffered items, returns their count, and does not cancel pending consumers.
- “Thread-safe” means race-safe within the Node.js event loop; the class is not a cross-worker synchronization primitive.

### Filesystem utilities

```ts
// src/core/utils/fs/backup-file.ts
export function backupFile(targetPath: string, backupSuffix?: string): string;
```

The default suffix is `".bak"`. The function checks the source, creates the backup parent directory recursively, copies bytes without transformation, returns the backup path, and throws `Error("No existe el archivo fuente: <path>")` when the source is absent. It is deterministic but intentionally side-effecting; “pure filesystem utility” means isolated I/O, not mathematical purity.

```ts
// src/core/utils/fs/patch-json-config.ts
export interface PatchOptions<T> {
  readonly backupSuffix?: string;
  readonly verify?: (written: T) => boolean;
}

export type PatchJsonConfigResult =
  | { readonly success: true; readonly backup: string }
  | { readonly success: false; readonly error: string; readonly backup?: string };

export function patchJsonConfig<T>(
  configPath: string,
  patchFn: (current: T) => T,
  options?: PatchOptions<T>,
): PatchJsonConfigResult;
```

The commit flow is synchronous and same-directory atomic:

1. Read and parse the existing JSON.
2. Invoke `patchFn` once.
3. Create the backup with `backupFile` before any replacement.
4. Write `JSON.stringify(updated, null, 2)` to a unique temporary sibling.
5. Re-read and parse the temporary file; run `verify` when supplied.
6. On verification failure, delete the temporary file, leave the target unchanged, and return an error containing `"Verificación fallida"` plus the backup path.
7. On success, rename the temporary sibling over the target and return success.
8. On any exception, best-effort delete the temporary file and return a descriptive failure; include `backup` only if it was created.

No unlink-first fallback is allowed because it would destroy the all-or-nothing replacement boundary. Missing or malformed source files return failure rather than creating a new configuration; S3 may add explicit creation policy at the client-adapter layer.

### Packet Tracer bootstrap script

```ts
// src/core/utils/pt/bootstrap-script.ts
export interface BootstrapScriptOptions {
  readonly host?: string;
  readonly port?: number;
  readonly intervalMs?: number;
}

export function getBootstrapScript(options?: BootstrapScriptOptions): string;
```

Defaults are `host = "localhost"`, `port = 54321`, and `intervalMs = 500`. The output remains an IIFE using `XMLHttpRequest`, `/next`, a 1500 ms request timeout, `$se('runCode', responseText)`, and the existing six-error stop policy. A successful HTTP 200 returns after optionally executing a non-empty response, matching the current user-facing `bridge-connect` script.

`LiveBridge.bootstrapScript()` remains available and delegates to `getBootstrapScript({ host: this.host, port: this.port })`; `bridge-connect.ts` calls the default generator. This removes both embedded script bodies without changing their owning APIs or endpoint configuration.

### Atomic types and historical façade

```ts
// src/core/types/bridge.ts
export interface BridgeRequest {
  id: string;
  method: string;
  params: Record<string, unknown>;
}

export interface BridgeResponse {
  id: string;
  success: boolean;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

export type ExecutionMode = "live" | "script";
```

```ts
// src/core/types/tools.ts
import type { ExecutionMode } from "./bridge.js";

export interface ToolResult<T = unknown> {
  mode: ExecutionMode;
  data: T;
  code?: string;
}
```

```ts
// src/core/types/catalog.ts
export interface DeviceEntry {
  model: string;
  typeId: number;
  category: DeviceCategory;
}

export interface ModuleEntry {
  model: string;
  typeId: number;
}

export interface LinkTypeEntry {
  name: string;
  id: number;
  aliases: string[];
}

export type DeviceCategory =
  | "router" | "switch" | "cloud" | "bridge" | "hub" | "repeater"
  | "coaxialsplitter" | "accesspoint" | "pc" | "server" | "printer"
  | "wirelessrouter" | "ipphone" | "dslmodem" | "cablemodem"
  | "multilayerswitch" | "laptop" | "tabletpc" | "smartphone"
  | "wirelessenddevice" | "wiredenddevice" | "tv" | "homevoip"
  | "analogphone" | "asa" | "thing" | "other";
```

```ts
// src/core/types/topology.ts
export interface TopologyDevice {
  name: string;
  model: string;
  x: number;
  y: number;
  interfaces?: string[];
}

export interface TopologyLink {
  device1: string;
  interface1: string;
  device2: string;
  interface2: string;
  type: string;
}

export interface VlanSpec {
  id: number;
  name: string;
}

export interface LanSegmentConfig {
  name: string;
  subnet: string;
  hosts: number;
  gateway?: string;
}
```

The façade contains only type re-exports:

```ts
// src/types/protocol.ts
export type { BridgeRequest, BridgeResponse, ExecutionMode } from "../core/types/bridge.js";
export type { ToolResult } from "../core/types/tools.js";
export type { DeviceEntry, ModuleEntry, LinkTypeEntry, DeviceCategory } from "../core/types/catalog.js";
export type { TopologyDevice, TopologyLink, VlanSpec, LanSegmentConfig } from "../core/types/topology.js";
export type { BridgeAdapter } from "../bridge/adapter.js";
```

`BridgeAdapter` did not previously live in `protocol.ts`, but the normative compatibility scenario names it. It is therefore an additive type-only alias, not a relocation. To keep dependency direction acyclic, `src/bridge/adapter.ts` imports `ExecutionMode` and `ToolResult` directly from `src/core/types/*`; all other historical consumers may continue using `protocol.ts` until their owning slice migrates them.

### Pipeline runner

```ts
// src/core/pipelines/pipeline.ts
export interface Context {
  readonly [key: string]: unknown;
}

export interface Stage<TContext extends object = Context> {
  execute(context: Readonly<TContext>): TContext | Promise<TContext>;
}

export class Pipeline<TContext extends object = Context> {
  constructor(stages?: readonly Stage<TContext>[]);
  pipe(stage: Stage<TContext>): Pipeline<TContext>;
  execute(initialContext: TContext): Promise<TContext>;
}
```

The constructor copies the supplied stage list. `pipe` returns a new pipeline with the appended stage and leaves the receiver unchanged. `execute` awaits stages sequentially and passes each returned context to the next stage. It does not clone contexts at runtime; stages own the contract to return a new context. A thrown or rejected error is propagated unchanged and terminates iteration, so later stages do not run. S1 does not add retries, rollback, parallelism, cancellation, logging, or domain-specific context fields.

## Data flow

### JSON patch transaction

```text
config path
  -> read original bytes
  -> JSON.parse<T>
  -> patchFn(current)
  -> backupFile(original)
  -> write temporary sibling
  -> parse temporary sibling
  -> optional verify(updated)
       -> false: remove temp, preserve target, return failure
       -> true: rename temp over target, return success
```

### Pipeline execution

```text
initial context
  -> await stage[0].execute(readonly context)
  -> await stage[1].execute(readonly context)
  -> ...
  -> final context

throw/reject -> immediate pipeline rejection; no later stage executes
```

### Bootstrap ownership

```text
bridge-connect tool ──> getBootstrapScript(defaults)
LiveBridge method ────> getBootstrapScript(instance host/port)
```

## File change plan

| Path | Change | Compatibility role |
|---|---|---|
| `src/core/utils/network/calc-ip.ts` | Add leaf function | Canonical S2 import |
| `src/core/utils/network/parse-subnet.ts` | Add parser and result contract | Canonical S2 import |
| `src/core/utils/network/subnet-allocator.ts` | Add persistent allocator | Canonical S2 import |
| `src/core/utils/async/async-queue.ts` | Add generic queue | Canonical future S4 import |
| `src/core/utils/fs/backup-file.ts` | Add isolated backup operation | Canonical future S3 import |
| `src/core/utils/fs/patch-json-config.ts` | Add transactional JSON patch | Canonical future S3 import |
| `src/core/utils/pt/bootstrap-script.ts` | Add sole script generator | Used immediately by existing owners |
| `src/core/types/{bridge,tools,catalog,topology}.ts` | Move type declarations without shape changes | Canonical leaf imports |
| `src/types/protocol.ts` | Replace declarations with type re-exports | Historical import façade |
| `src/bridge/adapter.ts` | Point type dependencies to canonical leaves | Prevent façade cycle |
| `src/bridge/live.ts` | Remove embedded script and delegate only | Preserve public method |
| `src/tools/primitive/bridge-connect.ts` | Remove constant and delegate only | Preserve tool output contract |
| `src/core/pipelines/pipeline.ts` | Add generic immutable runner | Used by S2, not wired in S1 |
| `tests/core/**` | Add mirrored focused tests | Strict TDD evidence |

No utility or type barrel is added in Slice 1. No existing composite/TUI imports are mechanically rewritten.

## Strict TDD matrix

Each row starts RED with the focused test command, reaches GREEN with the minimum implementation, then adds the listed triangulation before refactoring. Fake timers replace wall-clock sleeps.

| Test path | RED/GREEN contract | Triangulation and regression checks |
|---|---|---|
| `tests/core/utils/network/calc-ip.test.ts` | `.1`, `.15`, arbitrary first three octets | input string unchanged; no cross-call state |
| `tests/core/utils/network/parse-subnet.test.ts` | CIDR result, host-octet normalization, no-prefix result | `hostIndexBase === 0`; decimal prefix parsing |
| `tests/core/utils/network/subnet-allocator.test.ts` | first three persistent transitions | original allocator unchanged; two roots isolated; custom prefix |
| `tests/core/utils/async/async-queue.test.ts` | immediate dequeue, timeout, clear count | FIFO items, FIFO waiters, timeout cleanup, fake timers, `length` excludes waiters |
| `tests/core/utils/fs/backup-file.test.ts` | byte-identical `.bak`, missing-source error | custom suffix and returned path; temp directory cleanup |
| `tests/core/utils/fs/patch-json-config.test.ts` | successful backup/patch/verify | failed verification preserves original; malformed JSON returns failure; temp file cleanup |
| `tests/core/utils/pt/bootstrap-script.test.ts` | default IIFE URL, `$se`, 500 ms | custom host/port/interval; LiveBridge wrapper retains instance URL; tool uses default URL |
| `tests/core/types/protocol-facade.test.ts` | `expectTypeOf` checks canonical and façade assignability | `BridgeAdapter` additive alias; generic `ToolResult<T>` shape; run explicit typecheck/build gate |
| `tests/core/pipelines/pipeline.test.ts` | increment then double gives `{ count: 4 }` | async ordering, error abort, propagated error identity, `pipe` leaves original pipeline unchanged |

Validation for every implementation unit:

```text
RED:   npx vitest run <focused test path>          # must fail for the intended missing behavior
GREEN: npx vitest run <focused test path>          # must pass
FULL:  npm test                                    # all baseline + new tests pass
TYPE:  npm run build                               # NodeNext declarations compile
```

The type façade test is supportive; `npm run build` is the authoritative TypeScript compilation gate because Vitest transpilation alone does not perform full type checking.

## Implementation order and review budget

These are implementation work units, not an inferred PR-chain decision. Before each unit, record an exact additions-plus-deletions forecast. If a forecast is `>=400` or uncertain, split again and stop under `ask-on-risk`.

| Order | Work unit | Content | Forecast |
|---|---|---|---:|
| 1 | `S1-F1 network + pipeline` | Three network modules, pipeline runner, and four focused test files | 190–260 changed lines |
| 2 | `S1-F2 queue + bootstrap` | Generic queue, generator, two delegations, and focused tests | 180–260 changed lines |
| 3 | `S1-F3 filesystem` | Backup, transactional JSON patch, and focused tests | 190–280 changed lines |
| 4 | `S1-F4 atomic types` | Four type files, protocol façade, adapter import correction, type tests | 240–340 changed lines |

This ordering establishes pure contracts before side-effecting helpers and defers the highest rename/re-export risk until runtime foundations are green. The likely aggregate is 800–1,140 changed lines, so the spec statement that all of Slice 1 must be below 400 aggregate lines is infeasible alongside its required tests and type split. Tasks must preserve the per-review-unit interpretation or first amend the spec; `size:exception` is not authorized.

## Compatibility and rollout strategy

1. Add canonical modules before deleting or delegating old implementations.
2. Keep `src/types/protocol.ts`, `LiveBridge.bootstrapScript()`, and the bridge-connect tool API stable.
3. Use type-only façade exports to avoid runtime export changes for erased TypeScript declarations.
4. Do not migrate unrelated consumers merely to prefer new paths; their owning S2–S5 slices perform those rewrites.
5. End every work unit with focused tests, full tests, and build green before beginning the next.
6. Rollback is work-unit local: revert the unit and restore the preceding façade/delegation body; there is no data migration.
7. Do not remove compatibility façades during this change.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Aggregate Slice 1 exceeds 400 lines | Violates literal spec budget | Deliver as separately forecast green units and obtain the `ask-on-risk` packaging decision; otherwise amend scope/spec first. |
| Immutable allocator wording conflicts with a string-returning mutating `next()` | Tests could encode incompatible expectations | Use the persistent transition contract above and make tests assert `.subnet` plus returned allocator; update the scenario wording in tasks if required. |
| Two current bootstrap bodies differ on empty HTTP 200 handling | One owner could drift subtly | Preserve the user-facing bridge-connect behavior as canonical; characterize generated markers and both delegations. |
| Atomic rename varies by platform/filesystem | Patch could fail to commit | Use a sibling temp file and no unlink-first fallback; return failure with backup while leaving the original target intact. |
| Type façade creates an import cycle | Declaration generation can become fragile | Point `bridge/adapter.ts` directly to canonical bridge/tools types before adding its façade alias. |
| Fake-timer queue tests miss real races | Timeout/enqueue bugs remain | Test oldest-waiter delivery, timed-out resolver removal, and exactly-once resolution deterministically. |
| New helpers are present but duplicate consumers remain | Architecture acceptance appears incomplete | Slice 1 only delegates bootstrap immediately; record composite, TUI, and LiveBridge queue adoption as explicit S2–S4 tasks. |

## Decisions deferred to later slices

- S2 chooses domain pipeline contexts and stage modules and migrates both composite tools.
- S2 removes local `calcIp`, `parseSubnet`, and module-level subnet state only after characterization tests.
- S3 decides client-specific missing-file creation while reusing the strict existing-file patch primitive.
- S4 replaces the private `LiveBridge` queue with `AsyncQueue<T>` and decomposes bridge concerns.
- S5 migrates catalogs from the protocol façade to canonical type leaf imports.

## SDD result

- **status**: `designed_with_delivery_gate`
- **executive_summary**: Exact leaf-module contracts, immutable pipeline/allocation semantics, data flows, compatibility re-exports, strict TDD coverage, and four sub-400 implementation work units are defined for Slice 1 only.
- **artifacts**:
  - `openspec/changes/micro-modular-alignment/explore.md`
  - `openspec/changes/micro-modular-alignment/proposal.md`
  - `openspec/changes/micro-modular-alignment/specs/slice-1-foundation/spec.md`
  - `openspec/changes/micro-modular-alignment/specs/slice-1-foundation/design.md`
- **next_recommended**: `tasks` — first record the aggregate-budget conflict and obtain/record the `ask-on-risk` delivery packaging decision, then create RED-first tasks in work-unit order `S1-F1` through `S1-F4`.
- **risks**: Literal aggregate budget infeasibility, immutable allocator scenario ambiguity, bootstrap empty-response drift, cross-platform rename behavior, and façade-cycle risk.
- **skill_resolution**: `fallback-path`

## Key Learnings

1. The protocol type split alone consumes most of one bounded review unit.
2. Immutable subnet allocation requires returning the successor allocator with each subnet.
3. Vitest transpilation does not replace the authoritative TypeScript build gate.
4. The two existing bootstrap scripts differ when an empty successful response arrives.
