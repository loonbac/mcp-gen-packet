# Tasks: Slice 4 Bridge Decomposition, Ports & Infrastructure

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,550–1,850 lines (additions + deletions across all sub-slices) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (S4a) → PR 2 (S4b) → PR 3 (S4c.1) → PR 4 (S4c.2) → PR 5 (S4d.1) → PR 6 (S4d.2) → PR 7 (S4d.3) → PR 8 (S4d.4) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

```text
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High
```

---

## Delivery Strategy & Sub-Slice Budget Guardrails

- **Delivery Strategy:** `ask-on-risk`. The overall slice exceeds the 400-line review budget due to comprehensive test suites and replacing the 531-line god file `src/bridge/live.ts`.
- **400-Line Budget Rule:** Every sub-slice MUST forecast exact additions plus deletions immediately prior to editing. S4c is proactively partitioned into S4c.1 and S4c.2, and S4d is partitioned into S4d.1 through S4d.4 to isolate the large ~531-line deletion of `src/bridge/live.ts` into its own review unit.
- **Strict TDD & Zero Mutable Module State:** All infrastructure components and ports must follow RED → GREEN → REFACTOR with instance-owned state.
- **Per-Phase Green Invariant:** All 346 pre-existing tests across the repository must remain green after every sub-slice.

---

## Sub-Slice S4a: Minimal Ports & Circular Event Buffer (~240–300 lines)

*Scope: Define ISP consumer ports (`BridgePort`, `ProcessDetectorPort`, `EventBufferPort`), domain status/event types, the concrete bounded circular telemetry buffer `EventBuffer`, and adapt `BridgeAdapter` as a type façade.*

### Phase S4a.1 — Port Contracts & Compilation Tests (RED)
- [x] Create `tests/core/ports/bridge-ports.test.ts` asserting type compatibility and method signatures (`execute`, `isConnected`, `getMode`, `start`, `stop`) for `BridgePort`, `ProcessDetectorPort`, and `EventBufferPort`. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/core/ports/bridge-ports.test.ts` to confirm compilation/test failure before port files exist. <!-- sdd-owner: implementation -->

### Phase S4a.2 — Port Interfaces & Types Definition (GREEN)
- [x] Create `src/core/ports/bridge-port.ts` exporting `BridgeStatus` and `BridgePort` adhering to `AGENTS.md §3.6`. <!-- sdd-owner: implementation -->
- [x] Create `src/core/ports/process-detector-port.ts` exporting `ProcessDetectorPort` with synchronous `isPacketTracerRunning(): boolean`. <!-- sdd-owner: implementation -->
- [x] Create `src/core/ports/event-buffer-port.ts` exporting `BridgeEvent` and `EventBufferPort`. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/core/ports/bridge-ports.test.ts` and `npm run build` to verify clean compilation. <!-- sdd-owner: implementation -->

### Phase S4a.3 — Bounded EventBuffer Tests (RED)
- [x] Create `tests/core/infra/bridge/event-buffer.test.ts` with tests for FIFO eviction at capacity (e.g. 5 items), chronological ISO-8601 timestamping, `getLastEvent()`, bounded `getRecent(limit)`, immutability of returned array copies, and `clear()` resetting state to `"idle"`. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/core/infra/bridge/event-buffer.test.ts` to confirm RED failure. <!-- sdd-owner: implementation -->

### Phase S4a.4 — EventBuffer Implementation (GREEN)
- [x] Implement `EventBuffer` in `src/core/infra/bridge/event-buffer.ts` implementing `EventBufferPort` with injectable clock and capacity defaults (400 entries). <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/core/infra/bridge/event-buffer.test.ts` to confirm GREEN status. <!-- sdd-owner: implementation -->

### Phase S4a.5 — Sub-Slice S4a Verification & Triangulation Gate (REFACTOR)
- [x] Verify non-positive capacity throws `RangeError` and edge limits (negative, fractional, exceeding size) behave safely in `tests/core/infra/bridge/event-buffer.test.ts`. <!-- sdd-owner: implementation -->
- [x] Run full test suite (`npm test`) and typecheck (`npm run build`) to ensure 346 tests pass with zero regressions. <!-- sdd-owner: implementation -->

---

## Sub-Slice S4b: Platform Process Detection & Pure Monitor Template (~280–340 lines)

*Scope: Extract throttled Packet Tracer OS process detection (`PowerShellProcessDetector`) and extract pure Win32 dashboard template rendering (`getMonitorHtml`).*

### Phase S4b.1 — PowerShellProcessDetector Tests (RED)
- [ ] Create `tests/core/infra/bridge/powershell-detector.test.ts` testing detection of stdout `"1"` as `true`, stdout `"0"` or empty as `false`, 2,000ms execution throttling with cache return, non-Windows platform fallback returning `false` without spawning, and graceful handling of `spawnSync` errors (ENOENT, timeout, throw). <!-- sdd-owner: implementation -->
- [ ] Run `npx vitest run tests/core/infra/bridge/powershell-detector.test.ts` to confirm RED failure. <!-- sdd-owner: implementation -->

### Phase S4b.2 — PowerShellProcessDetector Implementation (GREEN)
- [ ] Implement `PowerShellProcessDetector` in `src/core/infra/bridge/powershell-detector.ts` implementing `ProcessDetectorPort` with injected `spawnSync`, clock, platform, and throttle options. <!-- sdd-owner: implementation -->
- [ ] Run `npx vitest run tests/core/infra/bridge/powershell-detector.test.ts` to confirm GREEN status. <!-- sdd-owner: implementation -->

### Phase S4b.3 — Pure Monitor Template Tests (RED)
- [ ] Create `tests/core/infra/bridge/monitor-template.test.ts` asserting complete HTML5 structure, teal background `#008080`, Win32 raised/sunken borders, presence of all 10 DOM status targets (`#running`, `#connected`, `#pollingActive`, `#packetTracerRunning`, `#lastEvent`, `#queueDepth`, `#polls`, `#queued`, `#results`, `#lastPollAgo`), polling scripts for `/status` and `/logs`, and byte-identical determinism across successive calls. <!-- sdd-owner: implementation -->
- [ ] Run `npx vitest run tests/core/infra/bridge/monitor-template.test.ts` to confirm RED failure. <!-- sdd-owner: implementation -->

### Phase S4b.4 — Monitor Template Implementation (GREEN)
- [ ] Implement pure function `getMonitorHtml(): string` in `src/core/infra/bridge/monitor-template.ts` free of Node.js HTTP, file system, or mutable state dependencies. <!-- sdd-owner: implementation -->
- [ ] Run `npx vitest run tests/core/infra/bridge/monitor-template.test.ts` to confirm GREEN status. <!-- sdd-owner: implementation -->

### Phase S4b.5 — Sub-Slice S4b Verification & Triangulation Gate (REFACTOR)
- [ ] Run focused tests `npx vitest run tests/core/infra/bridge/powershell-detector.test.ts tests/core/infra/bridge/monitor-template.test.ts`. <!-- sdd-owner: implementation -->
- [ ] Run full test suite (`npm test`) and typecheck (`npm run build`) to ensure repository-wide stability. <!-- sdd-owner: implementation -->

---

## Sub-Slice S4c.1: HTTP Transport Core & Read-Only Endpoints (~220–290 lines)

*Scope: Implement `HttpBridgeServer` lifecycle, CORS preflight, error isolation, port collision handling, and read-only endpoints (`/ping`, `/monitor`, `/status`).*

### Phase S4c.1.1 — Transport Core & Read-Only Tests (RED)
- [ ] Create `tests/core/infra/bridge/http-bridge-server.test.ts` with test cases for `start()` idempotency, `stop()` safety, `OPTIONS *` CORS preflight headers, `GET /ping` responding `"pong"`, `GET /monitor` serving HTML, `GET /status` serializing legacy snake_case/camelCase status fields, and `EADDRINUSE` contained handling with `port-in-use` event. <!-- sdd-owner: implementation -->
- [ ] Run `npx vitest run tests/core/infra/bridge/http-bridge-server.test.ts` to confirm RED failure. <!-- sdd-owner: implementation -->

### Phase S4c.1.2 — Transport Core & Read-Only Implementation (GREEN)
- [ ] Implement `HttpBridgeServer` in `src/core/infra/bridge/http-bridge-server.ts` with constructor options (`host`, `port`, `commandQueue`, `resultQueue`, `events`, `hooks`), universal CORS headers, contained `EADDRINUSE` listener error handling, and routing for `OPTIONS`, `GET /ping`, `GET /monitor`, and `GET /status`. <!-- sdd-owner: implementation -->
- [ ] Run `npx vitest run tests/core/infra/bridge/http-bridge-server.test.ts` to confirm GREEN status for core endpoints. <!-- sdd-owner: implementation -->

### Phase S4c.1.3 — Sub-Slice S4c.1 Verification & Triangulation Gate (REFACTOR)
- [ ] Verify ephemeral port binding (port 0) and simulated port collision clean teardown in `tests/core/infra/bridge/http-bridge-server.test.ts`. <!-- sdd-owner: implementation -->
- [ ] Run full test suite (`npm test`) and typecheck (`npm run build`). <!-- sdd-owner: implementation -->

---

## Sub-Slice S4c.2: HTTP Command & Result Queue Endpoints (~200–260 lines)

*Scope: Complete `HttpBridgeServer` routing for command dispatching (`GET /next`), telemetry logs (`GET /logs`), async command queueing (`POST /queue`), result dequeue with timeout (`GET /result`), and result reception (`POST /result`).*

### Phase S4c.2.1 — Queue & Result Endpoints Tests (RED)
- [ ] Add tests to `tests/core/infra/bridge/http-bridge-server.test.ts` for `GET /next` (returning command when present, empty body when queue empty, updating poll timestamp), `GET /logs` (returning JSON status and recent events), `GET /result` (200 with result payload vs 204 No Content on 9s timeout), `POST /result` (enqueuing payload and calling `onResultReceived`), `POST /queue` (enqueuing trimmed non-empty script), and 404 for unknown routes. <!-- sdd-owner: implementation -->
- [ ] Run `npx vitest run tests/core/infra/bridge/http-bridge-server.test.ts` to confirm RED failure on queue endpoints. <!-- sdd-owner: implementation -->

### Phase S4c.2.2 — Queue & Result Endpoints Implementation (GREEN)
- [ ] Extend route dispatcher in `src/core/infra/bridge/http-bridge-server.ts` to handle `GET /next`, `GET /logs`, `GET /result`, `POST /result`, `POST /queue`, stream UTF-8 body reading, and 500 error containment. <!-- sdd-owner: implementation -->
- [ ] Run `npx vitest run tests/core/infra/bridge/http-bridge-server.test.ts` with fake timers to verify all 7 routes pass. <!-- sdd-owner: implementation -->

### Phase S4c.2.3 — Sub-Slice S4c.2 Verification & Triangulation Gate (REFACTOR)
- [ ] Test edge cases: empty POST bodies, whitespace-only `/queue` requests, and rapid consecutive dequeues in `tests/core/infra/bridge/http-bridge-server.test.ts`. <!-- sdd-owner: implementation -->
- [ ] Run full test suite (`npm test`) and typecheck (`npm run build`). <!-- sdd-owner: implementation -->

---

## Sub-Slice S4d.1: Standalone AutoBridge Fallback Adapter (~130–170 lines)

*Scope: Extract `AutoBridge` into a standalone, reusable class implementing `BridgePort` that dynamically delegates between `LiveBridge` and `ScriptBridge`.*

### Phase S4d.1.1 — AutoBridge Tests (RED)
- [ ] Create `tests/core/infra/bridge/auto-bridge.test.ts` asserting `execute` delegates to live bridge when connected, falls back to script bridge when disconnected, returns `"live"` or `"script"` from `getMode()`, and forwards `start()` and `stop()` exclusively to live bridge. <!-- sdd-owner: implementation -->
- [ ] Run `npx vitest run tests/core/infra/bridge/auto-bridge.test.ts` to confirm RED failure. <!-- sdd-owner: implementation -->

### Phase S4d.1.2 — AutoBridge Implementation (GREEN)
- [ ] Implement `AutoBridge` in `src/core/infra/bridge/auto-bridge.ts` implementing `BridgePort` accepting structural `live: BridgePort` and `script: BridgePort` dependencies. <!-- sdd-owner: implementation -->
- [ ] Run `npx vitest run tests/core/infra/bridge/auto-bridge.test.ts` to confirm GREEN status. <!-- sdd-owner: implementation -->

### Phase S4d.1.3 — Sub-Slice S4d.1 Verification Gate (REFACTOR)
- [ ] Run full test suite (`npm test`) and typecheck (`npm run build`). <!-- sdd-owner: implementation -->

---

## Sub-Slice S4d.2: Decoupled LiveBridge Coordinator Engine (~340–390 lines)

*Scope: Implement the decoupled `LiveBridge` orchestrator coordinating lifecycle, connection heuristics, auto-cleanup on Packet Tracer process termination, queue management, and command execution.*

### Phase S4d.2.1 — LiveBridge Coordinator Tests (RED)
- [ ] Create `tests/core/infra/bridge/live-bridge.test.ts` testing connection heuristics (`connected = hasSeenPolling && packetTracerRunning && (pollingActive || recentGrace)`), auto-clearing both queues when `packetTracerRunning` transitions `true -> false`, offline script execution fallback (`execute` returning mode `"script"` without enqueuing), live execution resolving result, 20,000ms execution timeout returning `queued_no_confirmation`, ERROR response throwing `Error`, `clearPendingResults()` count return, and `bootstrapScript()` delegation. <!-- sdd-owner: implementation -->
- [ ] Run `npx vitest run tests/core/infra/bridge/live-bridge.test.ts` to confirm RED failure. <!-- sdd-owner: implementation -->

### Phase S4d.2.2 — LiveBridge Coordinator Implementation (GREEN)
- [ ] Implement `LiveBridge` in `src/core/infra/bridge/live-bridge.ts` implementing `BridgePort` coordinating `HttpBridgeServer`, `PowerShellProcessDetector`, `EventBuffer`, two `AsyncQueue<string>` instances, and script builders (`buildScript`, `getBootstrapScript`). <!-- sdd-owner: implementation -->
- [ ] Run `npx vitest run tests/core/infra/bridge/live-bridge.test.ts` to confirm GREEN status. <!-- sdd-owner: implementation -->

### Phase S4d.2.3 — Sub-Slice S4d.2 Verification & Triangulation Gate (REFACTOR)
- [ ] Verify rapid status polling, zero unhandled rejections, and fake timer advances in `tests/core/infra/bridge/live-bridge.test.ts`. <!-- sdd-owner: implementation -->
- [ ] Run full test suite (`npm test`) and typecheck (`npm run build`). <!-- sdd-owner: implementation -->

---

## Sub-Slice S4d.3: Historical Façades & Composition Root Modernization (~120–160 lines)

*Scope: Update `src/bridge/index.ts` to export canonical bridge adapters and wire `createBridge` to canonical implementations, preserving all public exports.*

### Phase S4d.3.1 — Historical Façades Contract Tests (RED)
- [ ] Create `tests/bridge/facades.test.ts` asserting that `import { createBridge, AutoBridge, LiveBridge, ScriptBridge, BridgeAdapter } from "../src/bridge/index.js"` successfully resolves, `createBridge()` starts the bridge and returns an instance implementing `BridgeAdapter`, and `src/bridge/adapter.js` exports the expected type contract. <!-- sdd-owner: implementation -->
- [ ] Run `npx vitest run tests/bridge/facades.test.ts` to verify baseline behavior. <!-- sdd-owner: implementation -->

### Phase S4d.3.2 — Index Composition Root Modernization (GREEN)
- [ ] Update `src/bridge/adapter.ts` to re-export `BridgePort as BridgeAdapter` as a backward-compatible type façade. <!-- sdd-owner: implementation -->
- [ ] Update `src/bridge/index.ts` to import `AutoBridge` and `LiveBridge` from `src/core/infra/bridge/`, remove the private unexported `AutoBridge` class definition, re-export canonical classes, and keep `createBridge` wiring. <!-- sdd-owner: implementation -->
- [ ] Run `npx vitest run tests/bridge/facades.test.ts` to confirm GREEN status. <!-- sdd-owner: implementation -->

### Phase S4d.3.3 — Sub-Slice S4d.3 Verification Gate (REFACTOR)
- [ ] Run integration test suites `tests/server/server.integration.test.ts` and `tests/core/utils/pt/delegation.test.ts`. <!-- sdd-owner: implementation -->
- [ ] Run full test suite (`npm test`) and typecheck (`npm run build`). <!-- sdd-owner: implementation -->

---

## Sub-Slice S4d.4: Monolithic `live.ts` Deletion Cutover & Full Repository Gate (~545 lines changed: +10 / -531 lines)

*Scope: Replace the 531-line god file `src/bridge/live.ts` with a thin re-export façade, eliminating code duplication, and verify zero regressions across all 346 tests. Note: Due to ~531 line deletions, this unit requires explicit delivery authorization under `ask-on-risk`.*

### Phase S4d.4.1 — Pre-Cutover Characterization Baseline (RED)
- [ ] Run full test suite `npm test` to capture baseline 346 passing tests. <!-- sdd-owner: implementation -->
- [ ] Record exact additions and deletions forecast for replacing `src/bridge/live.ts` (+10 additions, -531 deletions = 541 changed lines). <!-- sdd-owner: implementation -->

### Phase S4d.4.2 — Monolithic `live.ts` Replacement with Façade (GREEN)
- [ ] Replace `src/bridge/live.ts` content with clean re-exports of `LiveBridge` from `../core/infra/bridge/live-bridge.js` and `BridgeStatus` from `../core/ports/bridge-port.js`. <!-- sdd-owner: implementation -->
- [ ] Run `npx vitest run tests/bridge/facades.test.ts tests/server/server.integration.test.ts` to confirm seamless backward compatibility. <!-- sdd-owner: implementation -->

### Phase S4d.4.3 — Repository-Wide Verification & Final Acceptance Gate (REFACTOR)
- [ ] Run primitive tool tests `npx vitest run tests/tools/primitive/tools.test.ts`. <!-- sdd-owner: implementation -->
- [ ] Run server integration tests `npx vitest run tests/server/server.integration.test.ts`. <!-- sdd-owner: implementation -->
- [ ] Run bridge delegation tests `npx vitest run tests/core/utils/pt/delegation.test.ts`. <!-- sdd-owner: implementation -->
- [ ] Run full test suite across entire repository (`npm test`) confirming 346+ tests pass with 0 failures. <!-- sdd-owner: implementation -->
- [ ] Run TypeScript production build (`npm run build`) ensuring zero type errors, strict NodeNext resolution, and clean emission in `dist/`. <!-- sdd-owner: implementation -->
