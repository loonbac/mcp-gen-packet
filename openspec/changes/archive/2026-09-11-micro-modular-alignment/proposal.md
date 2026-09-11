# Proposal: micro-modular-alignment

## Status

- **status**: `proposed`
- **change**: `micro-modular-alignment`
- **execution**: `auto`
- **artifact_store**: `openspec`
- **delivery**: `ask-on-risk`
- **review_budget**: `<400 changed lines per review slice`
- **strict_tdd**: `true`
- **baseline**: `125 tests passing across 10 files`
- **research**: `unselected`; no external evidence is required for this architecture-only change.
- **skill_resolution**: `fallback-path` (`gentle-ai/SKILL.md` was loaded because no phase-skill path was injected).

## Executive summary

MCP-PTB works and has a green test suite, but its implementation does not consistently satisfy the repository's mandatory architecture in `AGENTS.md`. Large multi-responsibility modules, duplicated TUI mutation flows, mixed catalog data and queries, mutable module state, and missing ports, infrastructure adapters, use cases, and composable pipelines raise regression risk and make isolated reuse difficult.

This change will align the entire project with the micro-modular target while preserving observable behavior. The migration will proceed through five ordered scope families, broken into independently green review slices whenever necessary. Every executable slice must remain below 400 changed lines, retain historical import paths through compatibility façades, and pass the complete test suite before the next slice starts.

## Intent

Create an architecture in which each function, use case, pipeline stage, port, adapter, handler, and data module has one bounded responsibility and can be tested or reused independently. Composition roots may assemble these units but must not absorb domain calculations, transport logic, filesystem mutation, or mutable global state.

## Problem

The current architecture makes changes costlier and riskier than the stable product behavior warrants:

- `src/bridge/live.ts` combines queueing, process detection, HTTP transport, event storage, monitoring UI, and bridge orchestration.
- Twelve TUI clients repeat backup, JSON parsing, mutation, writing, and verification logic.
- Composite network tools duplicate addressing calculations and one uses mutable module-level subnet state.
- Catalog data and multiple query functions share files.
- MCP registration, resource serialization, tool dispatch, and error mapping are concentrated in `src/server.ts`.
- Domain, transport, catalog, and topology types are mixed in one protocol file.
- The application lacks the explicit `ports/`, `infra/`, `use_cases/`, and `pipelines/stages/` boundaries required by `AGENTS.md`.

## Users and situations

- **Packet Tracer automation users** need existing MCP tools, live polling, script fallback, resource responses, and generated topologies to behave exactly as before.
- **TUI users** need all twelve supported client configurations to remain safely installable, backed up, and verified.
- **Maintainers and contributors** need changes to bridge transport, clients, catalogs, or topology generation to remain local and independently testable.
- **Release reviewers** need bounded diffs that can be assessed without reviewing a repository-wide rewrite at once.

## Product outcome

After the change:

1. Existing MCP consumers observe no intentional API, schema, routing, output, or error-contract changes.
2. Network generation is deterministic per invocation and safe from cross-request mutable state.
3. Client configuration behavior is driven by declarative descriptors and one reusable injection engine.
4. Bridge concerns communicate through minimal ports and concrete infrastructure adapters.
5. Composite behavior is assembled through reusable `.pipe()` stages and one use case per action.
6. Catalog data, queries, server handlers, and protocol types are independently importable.
7. Historical public imports continue to resolve through compatibility re-exports.

## Current-state gap

The test suite demonstrates behavioral stability, not architectural conformance. The gap is therefore internal but operationally important: duplicated policy can drift, global state can leak between concurrent calls, and broad files force reviewers to reason about unrelated concerns together. The desired state replaces those risks without turning the refactor into a product redesign.

## Business and compatibility rules

1. Preserve all public MCP tool names, input schemas, resource URIs, response shapes, aliases, and externally visible error semantics.
2. Preserve live bridge endpoints and polling/result/queue behavior, script fallback, auto-selection behavior, and clean non-Windows degradation.
3. Preserve deterministic layout and addressing results for equivalent inputs, except that state must be scoped to each invocation.
4. Preserve the supported set of twelve TUI clients, their path resolution, configuration key shapes, `.bak` behavior, and post-write verification.
5. Preserve catalog values, aliases, ordering where observable, and existing query results.
6. Keep old module entry points as thin re-export or delegation façades until all internal callers and tests use the canonical modules.
7. Introduce no mutable process-wide application state. State required by a request, bridge instance, queue, or buffer must be explicitly owned and injected.
8. A reusable utility must be pure where its purpose permits it and live in one file. Generic catch-all `utils.ts` or `helpers.ts` modules are prohibited.
9. Each application action must have one use-case module; handlers and tool definitions may validate or translate, but may not implement the action.
10. Ports must remain minimal and consumer-driven; infrastructure modules provide concrete I/O behavior.

## Scope

The five confirmed scope families are ordered by dependency. They are not permission to create a single oversized diff. The listed sub-slices are the default review boundaries; each requires a changed-line forecast before implementation and must be split again if its forecast reaches 400 lines.

### S1 — Foundations, micro-utilities, and atomic types

- **S1a:** Extract pure network helpers (`calc-ip`, `parse-subnet`, immutable subnet allocation) and the single Packet Tracer bootstrap-script source; add focused tests and compatibility exports.
- **S1b:** Extract the generic async queue and split `types/protocol.ts` by domain/transport concern; retain `types/protocol.ts` as a compatibility façade.
- Establish canonical naming and import direction for `core/utils`, `core/types`, and compatibility indexes.

**Acceptance:** no duplicated IP/bootstrap implementation remains; subnet allocation has no module-level mutation; every extracted type/helper remains available through its historical import.

### S2 — Composable pipelines and composite use cases

- **S2a:** Add the generic typed pipeline contract with `.pipe(stage).execute(context)` and isolated stage tests.
- **S2b:** Express LAN planning/execution as bounded stages and a `create-lan-segment` use case.
- **S2c:** Express multi-network/VLAN planning/execution as bounded stages and a `create-network` use case, using invocation-owned allocation state.
- Keep tool modules as validation/transport adapters that delegate to use cases.

**Acceptance:** composite tools contain no duplicated addressing calculations, procedural god function, or mutable global state; existing outputs and failure behavior remain compatible.

### S3 — Declarative TUI injection

- **S3a:** Add a reusable JSON configuration update engine with explicit read/backup/write/verify boundaries and tests for missing, malformed, and partial configuration.
- **S3b:** Convert the first bounded client batch to declarative descriptors.
- **S3c:** Convert the remaining clients in one or more bounded batches and split TUI orchestration into focused steps where required.
- Preserve one descriptor module per client and existing client-level exports as façades.

**Acceptance:** all twelve clients use the shared engine; client modules contain metadata and client-specific transformation only; backup and verification semantics are unchanged.

### S4 — Bridge decomposition, ports, and infrastructure

- **S4a:** Introduce minimal bridge and process-detection ports plus compatibility adapter shells.
- **S4b:** Extract process detection and platform-specific behavior into concrete infrastructure.
- **S4c:** Extract queue/event-buffer/logging responsibilities into independently owned modules.
- **S4d:** Extract monitor rendering and live HTTP routing by endpoint responsibility.
- **S4e:** Compose the live, script, and auto bridge adapters and reduce historical bridge modules to façades.

**Acceptance:** no bridge god file remains; UI rendering, OS detection, transport, queueing, and orchestration can be tested independently; the live/script public contract and endpoint protocol remain stable.

### S5 — Catalog data/queries and server handlers

- **S5a:** Separate device and module data from one-query-per-file functions.
- **S5b:** Separate link and interface data from one-query-per-file functions.
- **S5c:** Extract MCP resource handlers and serialization from the server composition root.
- **S5d:** Extract domain tool handlers, complete one-use-case-per-action delegation, and leave `server.ts` as composition/registration only.
- Keep catalog and server-facing indexes as compatibility façades.

**Acceptance:** static data never shares a module with query behavior; each query and handler has one responsibility; `server.ts` contains wiring rather than business or serialization logic.

## Affected areas

- `src/core/{utils,types,ports,infra,use_cases,pipelines}` (new canonical boundaries)
- `src/tools/{primitive,composite,shared}`
- `src/bridge`
- `src/tui` and `src/tui/clients`
- `src/catalogs`
- `src/server.ts` and existing barrel exports
- Unit and integration tests covering every extracted contract and compatibility façade

## Non-goals

- Adding or changing MCP tools, resources, catalog entries, topology algorithms, client support, or user-facing TUI flows.
- Redesigning the bridge monitor UI or changing its visual style.
- Changing the PTBuilder polling protocol, ports, timeouts, queue policy, or event retention behavior unless a compatibility defect is first documented and approved separately.
- Introducing a dependency-injection framework, global service locator, broad repository framework, or speculative abstractions.
- Replacing Node filesystem/HTTP primitives or adding dependencies solely to perform the refactor.
- Removing compatibility façades in this change.
- Selecting a chained-PR strategy without the required `ask-on-risk` human decision.

## Constraints and delivery gates

- `strict_tdd: true`: each behavior extraction starts with a focused failing/characterization test when coverage is absent, then returns focused and full suites to green.
- `per_phase_green: true`: the complete suite must pass after every review slice; the next slice cannot rely on an intentionally broken intermediate state.
- Every review slice must remain **strictly below 400 changed lines**, including tests and compatibility code.
- Before editing each slice, record a changed-line forecast. If it is `>=400` or uncertain, split the slice and apply `ask-on-risk`; do not infer a PR-chain strategy or `size:exception`.
- Preserve API/import compatibility through re-exports and delegating façades throughout the migration.
- Avoid mechanical repository-wide rewrites. Migrate one dependency direction at a time.
- Keep runtime behavior portable across Windows, Linux, and macOS, including existing PowerShell detection fallback behavior.
- No `size:exception` is authorized by this proposal.

## Tradeoffs

- **More files versus local clarity:** navigation will involve more modules, accepted in exchange for isolated responsibilities and reuse.
- **Temporary façades versus immediate cleanup:** compatibility files add short-term indirection, accepted to keep every slice releasable and tests green.
- **Minimal ports versus abstraction breadth:** ports will model only current consumers, avoiding speculative generic interfaces at the cost of later extension work.
- **Incremental delivery versus migration speed:** bounded slices take longer than a bulk move but reduce regression and review risk.
- **Characterization compatibility versus opportunistic fixes:** existing quirks remain unless separately approved, preventing architecture work from hiding product changes.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Import/export regression during moves | Existing tests or consumers fail | Add compatibility façades first; test old and canonical imports in every slice. |
| Behavioral drift in network generation | Generated Packet Tracer topology changes | Characterize current plans/results before stage extraction; compare deterministic outputs. |
| TUI config corruption or lost client nuance | User configuration becomes invalid | Preserve per-client descriptors, backup before write, verify after write, and test malformed/partial states. |
| Bridge timing or protocol regression | Live automation stalls or loses results | Extract behind existing interfaces; characterize endpoint, timeout, queue, and fallback behavior before replacement. |
| Over-generalized ports/pipelines | More indirection without reuse | Keep interfaces minimal and derive stages from current repeated responsibilities only. |
| Review budget exceeded | Delivery violates the 400-line gate | Forecast before edits, use the defined sub-slices, split further, and stop for `ask-on-risk` when needed. |
| Green tests mask unsupported consumers | External import paths break | Treat existing barrel paths and documented package exports as compatibility contracts. |

## Rollback

Rollback is slice-local and requires no data migration:

1. Revert the affected review slice while retaining the last green compatibility façade.
2. Point the façade back to the prior implementation if a new module fails in production.
3. For TUI changes, retain `.bak` files and restore the previous client adapter path.
4. For bridge changes, restore the previous adapter composition without changing MCP-facing contracts.
5. Do not continue to a dependent slice until the baseline suite and targeted behavior tests are green again.

## Success criteria

1. The full pre-existing suite remains green after every slice, and new focused tests cover extracted contracts and edge cases.
2. No targeted god file, duplicated client injection flow, duplicated network helper, generic utility module, or mutable module-level application state remains.
3. Composite tools execute through typed `.pipe()` stages and one action per use-case module.
4. Bridge and configuration I/O are behind minimal ports with concrete infrastructure implementations.
5. All twelve clients are descriptor-driven and preserve backup/write/verification behavior.
6. Catalog data and atomic queries are separate; server handlers are separate from the composition root.
7. Historical imports and externally visible MCP/TUI behavior remain compatible.
8. An architecture audit of `src/` finds the complete target structure aligned with `AGENTS.md`, not only the initially identified files.
9. Every delivered review slice records a forecast and finishes below 400 changed lines with `per_phase_green: true` evidence.

## Proposal assumptions and decision gaps

The confirmed pre-proposal handoff is authoritative, so no additional product interview is required. Detailed TypeScript contracts, exact stage context types, file-by-file move order, and test matrices are deferred to spec/design. Delivery packaging remains a human-control gate: because the aggregate change is necessarily larger than 400 lines, implementation must pause under `ask-on-risk` before choosing separate or chained PRs.

## SDD results

- **executive_summary**: Refactor the complete project toward atomic utilities/types, composable pipelines, declarative TUI injection, minimal ports with bridge infrastructure, and separated catalog/server handlers while preserving behavior through compatibility façades.
- **artifacts**:
  - `openspec/changes/micro-modular-alignment/explore.md`
  - `openspec/changes/micro-modular-alignment/proposal.md`
- **next_recommended**: `spec` — define normative compatibility contracts and acceptance scenarios for S1–S5 before design or implementation.
- **risks**: Regression across 125 baseline tests and external import paths; bridge/TUI behavioral drift; aggregate scope exceeding the review budget even though every review slice must remain below 400 lines.
- **skill_resolution**: `fallback-path`
