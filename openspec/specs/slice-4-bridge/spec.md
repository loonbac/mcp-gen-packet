# Slice 4 Bridge Decomposition, Ports & Infrastructure Specification

## Purpose

Define the normative behavioral contracts, requirements, and testable scenarios for **Slice 4 (Bridge Decomposition, Ports, and Infrastructure)** of the `micro-modular-alignment` change. This slice refactors the bridge subsystem by decomposing the monolithic god file `src/bridge/live.ts` (~433 lines combining an embedded HTTP server with manual CORS for 7 routes, PowerShell child-process detection, a 400-event circular telemetry buffer, a retro Win32 monitor dashboard template, duplicated async queueing, and bridge command orchestration) and extracting the private unexported `AutoBridge` class from `src/bridge/index.ts` into:

1. **Minimal Ports (`src/core/ports/`):** Clean consumer-driven interfaces (`BridgePort`, `ProcessDetectorPort`, `EventBufferPort`) adhering strictly to the Interface Segregation Principle (ISP) and `AGENTS.md §3.6`.
2. **Dedicated Infrastructure Adapters (`src/core/infra/bridge/`):** Single-responsibility modules for circular event telemetry (`EventBuffer`), platform-aware Packet Tracer process detection with throttling (`PowerShellProcessDetector`), pure Win32 dashboard HTML rendering (`getMonitorHtml`), an isolated HTTP transport server (`HttpBridgeServer`), and the fallback routing adapter (`AutoBridge`).
3. **Decoupled Bridge Orchestrator:** A focused `LiveBridge` coordinating bridge lifecycle, queueing via the generic `AsyncQueue<T>` extracted in Slice 1, command execution with script building via `buildScript`, auto-cleanup on Packet Tracer termination, and connection heuristics.
4. **Backward-Compatible Façades:** Historical entry points (`src/bridge/live.ts`, `src/bridge/index.ts`, `src/bridge/adapter.ts`) preserved as thin delegation façades to guarantee zero regressions across server integration tests and all 346 passing tests.

---

## Non-Goals (Scope Boundaries for S5)

To protect the review budget (<400 changed lines per review slice) and preserve atomic review boundaries, the following items are explicitly **excluded** from this specification:

- **S5 (Catalogs & Server Handlers):** Separating catalog data maps from query functions in `src/catalogs/*` and extracting MCP server resource/tool dispatch handlers from `src/server.ts` is deferred to Slice 5.
- **HTTP Transport Protocol Alterations:** Modifying existing endpoint routes (`/next`, `/ping`, `/logs`, `/monitor`, `/status`, `/result`, `/queue`), HTTP verbs (`GET`, `POST`, `OPTIONS`), status codes (`200`, `204`, `404`, `500`), CORS headers, or response payloads.
- **Dashboard UI Redesign:** Changing the visual appearance, color palette, retro Win32 layout, or client-side polling logic of the `/monitor` dashboard HTML template.
- **Heuristic Parameter Modifications:** Changing timing thresholds including command timeout (20,000ms), result wait timeout (9,000ms), connection grace period (900,000ms / 15min), polling active threshold (5,000ms), or process check interval (2,000ms).
- **External Dependencies:** Adding runtime or development dependencies to `package.json` (all implementations MUST rely exclusively on Node.js built-ins: `node:http`, `node:child_process`, `node:crypto`).
- **Primitive or Composite Tools Modification:** `src/tools/primitive/*` and `src/tools/composite/*` remain untouched in this slice.

---

## Constraints and Delivery Gates

1. **Review Budget:** Each sub-slice (S4a, S4b, S4c, S4d) MUST remain strictly below **400 changed lines**, including ports, infrastructure modules, tests, and adapter façades.
2. **Strict TDD:** Every port interface, infrastructure adapter, and refactored façade MUST be developed using strict test-driven development (RED → GREEN → REFACTOR) with unit tests located under `tests/core/ports/`, `tests/core/infra/bridge/`, and `tests/bridge/`.
3. **Per-Phase Green:** All 346 pre-existing tests across the repository MUST remain green (`npm test` passes with zero failures) before and after each sub-slice.
4. **Zero Module-Level Mutable State:** Telemetry buffers, HTTP server handles, polling timestamps, queues, and connection caches MUST be owned exclusively by instance objects; module-level `let` variables are strictly prohibited.
5. **Clean Platform Degradation:** The process detector MUST handle non-Windows environments, command timeouts, and spawn failures gracefully by returning cached state without throwing unhandled exceptions.
6. **API & Façade Backward Compatibility:**
   - `src/bridge/live.ts` MUST continue exporting `LiveBridge` and `BridgeStatus`.
   - `src/bridge/index.ts` MUST continue exporting `createBridge`, `LiveBridge`, `ScriptBridge`, `AutoBridge`, and `BridgeAdapter`.
   - `src/bridge/adapter.ts` MUST continue exporting `BridgeAdapter`.
7. **Lifecycle Safety:** Calling `start()` repeatedly on an already listening bridge MUST be an idempotent no-op. Calling `stop()` on a stopped bridge MUST be a safe no-op.

---

## Requirements

### Requirement: Minimal Bridge and Subsystem Ports (`BridgePort`, `ProcessDetectorPort`, `EventBufferPort`)

The system MUST define minimal, consumer-driven interfaces under `src/core/ports/` adhering to the Interface Segregation Principle:

1. `src/core/ports/bridge-port.ts`:
   - `execute(method: string, params: Record<string, unknown>): Promise<ToolResult>`
   - `isConnected(): boolean`
   - `getMode(): ExecutionMode`
   - `start(): void`
   - `stop(): void`
2. `src/core/ports/process-detector-port.ts`:
   - `isPacketTracerRunning(): boolean`
3. `src/core/ports/event-buffer-port.ts`:
   - `push(kind: string, detail: string): void`
   - `setEvent(kind: string, detail: string): void`
   - `getLastEvent(): string`
   - `getRecent(limit?: number): BridgeEvent[]`
   - `readonly size: number`
   - `clear(): void`

The port modules MUST also export the canonical domain types `BridgeEvent` (`{ ts: string; kind: string; detail: string }`) and `BridgeStatus` (`running`, `connected`, `pollingActive`, `packetTracerRunning`, `lastPollAgoSeconds`, `queueDepth`, `polls`, `queued`, `resultsReceived`, `lastEvent`).

#### Scenario: Consume BridgePort contract for execution and lifecycle
- GIVEN a component requiring Packet Tracer automation
- WHEN consuming `BridgePort`
- THEN it MUST provide `execute(method, params)`, `isConnected()`, `getMode()`, `start()`, and `stop()`
- AND `execute` MUST return a `Promise<ToolResult>`

#### Scenario: Consume ProcessDetectorPort for process inspection
- GIVEN a component requiring external process status
- WHEN consuming `ProcessDetectorPort`
- THEN it MUST provide `isPacketTracerRunning(): boolean` without exposing underlying OS command execution or shell mechanics

#### Scenario: Consume EventBufferPort for telemetry tracking
- GIVEN an instance implementing `EventBufferPort`
- WHEN `push(kind, detail)` or `setEvent(kind, detail)` is invoked
- THEN events MUST be recorded with ISO-8601 timestamps
- AND `getRecent(limit)` MUST return recorded events up to the specified limit

---

### Requirement: Dedicated Circular Telemetry Event Buffer (`EventBuffer`)

The system MUST provide a concrete circular event buffer `EventBuffer` in `src/core/infra/bridge/event-buffer.ts` implementing `EventBufferPort`. The buffer MUST maintain a fixed maximum capacity (default 400 events) using FIFO eviction, provide ISO-8601 timestamping, track the `lastEvent` identifier, and support safe retrieval and clearing.

#### Scenario: Chronological event recording within capacity
- GIVEN an empty `EventBuffer` with capacity 400
- WHEN pushing 3 events: `"init"`, `"listening"`, `"enqueue"`
- THEN `size` MUST equal `3`
- AND `getLastEvent()` MUST return `"enqueue"`
- AND `getRecent()` MUST return all 3 events in exact insertion order with valid ISO-8601 `ts` strings

#### Scenario: FIFO eviction when capacity is exceeded
- GIVEN an `EventBuffer` configured with capacity `5`
- WHEN pushing 6 events sequentially (`"ev1"` through `"ev6"`)
- THEN `size` MUST remain `5`
- AND the oldest event (`"ev1"`) MUST be evicted
- AND `getRecent()` MUST return `["ev2", "ev3", "ev4", "ev5", "ev6"]`

#### Scenario: Set event updates lastEvent and appends to event log
- GIVEN an `EventBuffer` with `lastEvent` initialized to `"idle"`
- WHEN `setEvent("listening", "Escuchando en http://127.0.0.1:54321")` is called
- THEN `getLastEvent()` MUST return `"listening"`
- AND the event log MUST contain an event with `kind: "listening"` and matching detail

#### Scenario: Retrieve bounded subset of recent events
- GIVEN an `EventBuffer` containing 50 events
- WHEN `getRecent(10)` is called
- THEN it MUST return exactly the last 10 events
- WHEN `getRecent(100)` is called
- THEN it MUST return all 50 events without error

#### Scenario: Clear event buffer
- GIVEN an `EventBuffer` containing 25 events
- WHEN `clear()` is invoked
- THEN `size` MUST equal `0`
- AND `getLastEvent()` MUST reset to `"idle"`
- AND `getRecent()` MUST return an empty array `[]`

---

### Requirement: Platform-Aware PowerShell Process Detector (`PowerShellProcessDetector`)

The system MUST provide a platform-aware process detector `PowerShellProcessDetector` in `src/core/infra/bridge/powershell-detector.ts` implementing `ProcessDetectorPort`. The detector MUST inspect Packet Tracer execution state via PowerShell `Get-Process`, enforce a throttle interval (2,000ms) to prevent excessive child process spawning, and degrade gracefully on non-Windows platforms or spawn errors by returning cached state.

#### Scenario: Detect running Packet Tracer process via PowerShell
- GIVEN PowerShell execution returns stdout `"1"` with exit code 0
- WHEN `isPacketTracerRunning()` is called
- THEN it MUST return `true`

#### Scenario: Detect inactive Packet Tracer process
- GIVEN PowerShell execution returns stdout `"0"` or empty string with exit code 0
- WHEN `isPacketTracerRunning()` is called
- THEN it MUST return `false`

#### Scenario: Throttle process checks within interval
- GIVEN an initial check that executed PowerShell at timestamp $T$
- WHEN `isPacketTracerRunning()` is called again at $T + 500\text{ms}$ (less than 2000ms)
- THEN it MUST return the cached boolean without spawning a new child process

#### Scenario: Clean degradation on execution error or non-Windows environment
- GIVEN `spawnSync` returns an error (e.g. `ENOENT` on Linux/macOS or timeout)
- WHEN `isPacketTracerRunning()` is called
- THEN it MUST NOT throw an exception
- AND it MUST return the last cached status (defaulting to `false`)

---

### Requirement: Pure Retro Monitor HTML View Template (`getMonitorHtml`)

The system MUST provide a pure template function `getMonitorHtml()` in `src/core/infra/bridge/monitor-template.ts` that generates the retro Win32/Windows 95-styled dashboard HTML page for `/monitor`. The function MUST be pure, deterministic, and free from Node.js HTTP or process dependencies.

#### Scenario: Generate complete Win32 retro monitor HTML document
- GIVEN no input arguments
- WHEN `getMonitorHtml()` is invoked
- THEN it MUST return a complete HTML5 document starting with `<!doctype html>`
- AND it MUST declare `<html lang="es">` and `<title>Bridge Monitor</title>`
- AND it MUST include inline styles defining the Win32 window, sunken borders, and teal background `#008080`
- AND it MUST contain status DOM targets: `#running`, `#connected`, `#pollingActive`, `#packetTracerRunning`, `#lastEvent`, `#queueDepth`, `#polls`, `#queued`, `#results`, `#lastPollAgo`
- AND it MUST include client-side polling logic targeting `/status` and `/logs`

#### Scenario: Deterministic and idempotent output
- GIVEN multiple successive invocations of `getMonitorHtml()`
- WHEN comparing the generated strings
- THEN all invocations MUST produce byte-identical HTML output

---

### Requirement: Modular HTTP Bridge Transport Server (`HttpBridgeServer`)

The system MUST provide a dedicated HTTP transport server `HttpBridgeServer` in `src/core/infra/bridge/http-bridge-server.ts` that encapsulates Node.js `http.Server` and manages the 7 bridge endpoints, CORS handling, asynchronous request body reading, and server lifecycle.

The server MUST handle:
1. `OPTIONS *`: CORS preflight responding with status 200 and allowed headers (`Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: GET, POST, OPTIONS`, `Access-Control-Allow-Headers: Content-Type`).
2. `GET /next`: Dequeue command from command queue. If present, returns command string (200); if empty, returns 200 with empty body. Notifies polling listener with timestamp.
3. `GET /ping`: Responds 200 with `"pong"`.
4. `GET /logs`: Responds 200 JSON with `{ status, events }`.
5. `GET /monitor`: Responds 200 HTML with `getMonitorHtml()`.
6. `GET /status`: Responds 200 JSON with status serialization matching protocol fields.
7. `GET /result`: Awaits result queue dequeue with 9,000ms timeout. Responds 200 with result string, or 204 No Content on timeout.
8. `POST /result`: Reads request body, enqueues to result queue, increments result counter, responds 200 with `"ok"`.
9. `POST /queue`: Reads request body, enqueues non-empty payload to command queue, increments queued counter, responds 200 with `"queued"`.
10. Default / unmatched route: Responds 404 with empty body.
11. Port conflict handling: Catches `EADDRINUSE`, prevents server crash, logs external bridge assumption, and sets listening status to `false`.
12. Uncaught route error handling: Responds 500 `"internal-error"` and records error event without terminating the server.

#### Scenario: Handle CORS preflight request
- GIVEN a running `HttpBridgeServer`
- WHEN an `OPTIONS` request is received on any path
- THEN response status MUST be `200`
- AND header `Access-Control-Allow-Origin` MUST be `"*"`
- AND header `Access-Control-Allow-Methods` MUST include `"GET, POST, OPTIONS"`

#### Scenario: Dispatch enqueued command on GET /next
- GIVEN a command `"alert('test');"` enqueued in the command queue
- WHEN `GET /next` is requested
- THEN response status MUST be `200`
- AND response body MUST be `"alert('test');"`
- AND the polling timestamp MUST be updated to current time

#### Scenario: Health check response on GET /ping
- GIVEN a running `HttpBridgeServer`
- WHEN `GET /ping` is requested
- THEN response status MUST be `200`
- AND response body MUST be `"pong"`
- AND a `"ping"` event MUST be recorded in the event buffer

#### Scenario: Status serialization on GET /status
- GIVEN a bridge with status `{ connected: true, running: true, polls: 5 }`
- WHEN `GET /status` is requested
- THEN response status MUST be `200`
- AND response `Content-Type` MUST be `"application/json; charset=utf-8"`
- AND JSON payload MUST include `connected: true`, `running: true`, `polls: 5`

#### Scenario: Result dequeue on GET /result with timeout
- GIVEN an empty result queue
- WHEN `GET /result` is requested and no result is posted within 9s
- THEN response status MUST be `204`
- AND a `"result-timeout"` event MUST be recorded

#### Scenario: Post result reception on POST /result
- GIVEN a running `HttpBridgeServer`
- WHEN `POST /result` is submitted with body `JSON.stringify({ ok: true })`
- THEN the body MUST be enqueued to the result queue
- AND response status MUST be `200`
- AND response body MUST be `"ok"`

#### Scenario: Enqueue command via POST /queue
- GIVEN a running `HttpBridgeServer`
- WHEN `POST /queue` is submitted with body `"device.setName('R1');"`
- THEN the body MUST be enqueued to the command queue
- AND response status MUST be `200`
- AND response body MUST be `"queued"`

#### Scenario: Handle unknown endpoint with 404
- GIVEN a running `HttpBridgeServer`
- WHEN `GET /unknown-path` is requested
- THEN response status MUST be `404`

#### Scenario: Handle EADDRINUSE port collision gracefully
- GIVEN an existing process already listening on port 54321
- WHEN `server.listen(54321, "127.0.0.1")` is called
- THEN an `EADDRINUSE` error MUST be captured
- AND `server.isListening()` MUST be `false`
- AND a `"port-in-use"` event MUST be logged
- AND the process MUST NOT crash

---

### Requirement: Extracted AutoBridge Fallback Adapter (`AutoBridge`)

The system MUST extract the private fallback adapter from `src/bridge/index.ts` into a standalone, reusable class `AutoBridge` in `src/core/infra/bridge/auto-bridge.ts` implementing `BridgePort`. The adapter MUST route commands to `LiveBridge` when connected and fall back to `ScriptBridge` when disconnected.

#### Scenario: Route execution to LiveBridge when connected
- GIVEN an `AutoBridge` composed with a connected `LiveBridge` and a `ScriptBridge`
- WHEN `execute("add_device", params)` is invoked
- THEN `execute` MUST be called on the `LiveBridge`
- AND `getMode()` MUST return `"live"`

#### Scenario: Route execution to ScriptBridge when disconnected
- GIVEN an `AutoBridge` composed with a disconnected `LiveBridge` and a `ScriptBridge`
- WHEN `execute("add_device", params)` is invoked
- THEN `execute` MUST be called on the `ScriptBridge`
- AND `getMode()` MUST return `"script"`

#### Scenario: Delegate lifecycle methods to LiveBridge
- GIVEN an `AutoBridge`
- WHEN `start()` or `stop()` is invoked
- THEN the call MUST be forwarded directly to the underlying `LiveBridge`

---

### Requirement: Decoupled LiveBridge Coordinator and Engine

The system MUST provide a decoupled coordinator `LiveBridge` in `src/core/infra/bridge/live-bridge.ts` implementing `BridgePort`. The coordinator MUST assemble `HttpBridgeServer`, `ProcessDetectorPort`, `EventBufferPort`, `AsyncQueue<string>` (from `src/core/utils/async/async-queue.js`), `buildScript`, and `getBootstrapScript`.

The coordinator MUST encapsulate:
1. **Connection Heuristics:** `getStatus()` evaluates `connected = hasSeenPolling && packetTracerRunning && (pollingActive || recentGrace)`.
2. **Auto-Cleanup on Process Termination:** When `packetTracerRunning` transitions from `true` to `false`, automatically clear both command and result queues, reset polling state (`hasSeenPolling = false`, `lastPollAt = 0`), and log `"queue-auto-cleared"`.
3. **Execution Routing:**
   - If `!isConnected()`, return `{ mode: "script", data: { method, params }, code: buildScript(method, params) }`.
   - If `isConnected()`, enqueue `code` to the command queue and wait for result via result queue with 20,000ms timeout.
   - If timeout expires, return `{ mode: "live", data: { method, params, status: "queued_no_confirmation", code } }`.
   - If result starts with `"ERROR"` (case-insensitive), throw `new Error(result)`.
   - Otherwise, return `{ mode: "live", data: { method, params, result, code } }`.
4. **Bootstrap Script Delegation:** `bootstrapScript()` delegates to `getBootstrapScript({ host, port })`.
5. **Pending Results Discard:** `clearPendingResults()` drops all pending result queue entries and returns the count of discarded items.

#### Scenario: Execute command in script mode when disconnected
- GIVEN a `LiveBridge` where `isConnected()` is `false`
- WHEN `execute("add_device", { name: "R1", model: "2911" })` is called
- THEN it MUST NOT enqueue the command
- AND it MUST return `{ mode: "script", data: { method: "add_device", params: { name: "R1", model: "2911" } }, code: expect.any(String) }`

#### Scenario: Execute command successfully in live mode
- GIVEN a `LiveBridge` where `isConnected()` is `true`
- AND a result `"SUCCESS: R1 created"` is enqueued within 20s
- WHEN `execute("add_device", { name: "R1", model: "2911" })` is called
- THEN it MUST enqueue the command script
- AND return `{ mode: "live", data: { method: "add_device", params: expect.any(Object), result: "SUCCESS: R1 created", code: expect.any(String) } }`

#### Scenario: Command timeout returns queued_no_confirmation
- GIVEN a `LiveBridge` where `isConnected()` is `true`
- AND no result is posted within the 20s execution timeout
- WHEN `execute("add_device", params)` is called
- THEN it MUST return `{ mode: "live", data: { method: "add_device", params, status: "queued_no_confirmation", code: expect.any(String) } }`
- AND MUST NOT throw an exception

#### Scenario: Bridge error response throws Error
- GIVEN a `LiveBridge` where `isConnected()` is `true`
- AND the result received from Packet Tracer is `"ERROR: Invalid device model"`
- WHEN `execute("add_device", params)` is called
- THEN it MUST throw `new Error("ERROR: Invalid device model")`

#### Scenario: Auto-clear queues when Packet Tracer process terminates
- GIVEN a `LiveBridge` with 3 enqueued commands and 2 pending results
- AND Packet Tracer was previously running
- WHEN `getStatus()` detects Packet Tracer has closed (`packetTracerRunning: false`)
- THEN both command queue and result queue MUST be cleared
- AND `hasSeenPolling` MUST be reset to `false`
- AND a `"queue-auto-cleared"` event MUST be recorded

#### Scenario: Generate bootstrap script via delegation
- GIVEN a `LiveBridge` configured with host `"127.0.0.1"` and port `54321`
- WHEN `bootstrapScript()` is called
- THEN the returned script MUST match `getBootstrapScript({ host: "127.0.0.1", port: 54321 })`

---

### Requirement: Backward-Compatible Bridge Façades & Registry

The system MUST preserve historical module entry points as thin delegating façades:

1. `src/bridge/live.ts`: Re-exports `LiveBridge` and `BridgeStatus` from `src/core/infra/bridge/live-bridge.js` (or delegates to canonical implementation).
2. `src/bridge/adapter.ts`: Re-exports `BridgeAdapter` conforming to `BridgePort`.
3. `src/bridge/index.ts`: Re-exports `createBridge`, `LiveBridge`, `ScriptBridge`, `AutoBridge`, and `BridgeAdapter`.
4. All existing server integration tests in `tests/server/server.integration.test.ts` and primitive tool tests in `tests/tools/primitive/tools.test.ts` MUST pass without modifications to test assertions.

#### Scenario: Instantiate LiveBridge from historical import path
- GIVEN an import `import { LiveBridge } from "../src/bridge/live.js"`
- WHEN `new LiveBridge("127.0.0.1", 54321)` is instantiated
- THEN it MUST satisfy the `BridgeAdapter` interface
- AND provide all public methods: `start()`, `stop()`, `enqueue()`, `clearPendingResults()`, `sendAndWait()`, `bootstrapScript()`, `getStatus()`, `isConnected()`, `getMode()`, `execute()`

#### Scenario: Factory function createBridge retains historical contract
- GIVEN an import `import { createBridge } from "../src/bridge/index.js"`
- WHEN `createBridge(54321)` is invoked
- THEN it MUST start the live bridge
- AND return an `AutoBridge` instance implementing `BridgeAdapter`

#### Scenario: Full test suite regression prevention
- GIVEN the decomposed bridge subsystem, ports, and backward-compatible façades
- WHEN `npm test` is executed across the entire repository
- THEN all 346 tests MUST pass with zero failures

---

## Sub-Slice Delivery Plan (<400 Lines per Review Slice)

To ensure strict adherence to the review budget constraint (<400 changed lines per review slice), Slice 4 is partitioned into four discrete, independently green sub-slices:

| Sub-Slice | Scope | Forecasted Lines | Review Boundary |
|---|---|---|---|
| **S4a** | Minimal Ports (`BridgePort`, `ProcessDetectorPort`, `EventBufferPort` in `src/core/ports/`) + `EventBuffer` (`src/core/infra/bridge/event-buffer.ts`) + unit tests in `tests/core/ports/` and `tests/core/infra/bridge/event-buffer.test.ts` | ~160–220 lines | Sub-slice S4a PR / review unit |
| **S4b** | Process Detection (`PowerShellProcessDetector` in `src/core/infra/bridge/powershell-detector.ts`) + Retro Monitor HTML template (`getMonitorHtml` in `src/core/infra/bridge/monitor-template.ts`) + unit tests | ~170–230 lines | Sub-slice S4b PR / review unit |
| **S4c** | HTTP Bridge Transport Server (`HttpBridgeServer` in `src/core/infra/bridge/http-bridge-server.ts`) handling 7 endpoints, CORS, EADDRINUSE, body parsing + unit tests in `tests/core/infra/bridge/http-bridge-server.test.ts` | ~240–310 lines | Sub-slice S4c PR / review unit |
| **S4d** | Fallback adapter (`AutoBridge` in `src/core/infra/bridge/auto-bridge.ts`), decoupled coordinator (`LiveBridge` in `src/core/infra/bridge/live-bridge.ts`), thin backward-compatible façades (`src/bridge/live.ts`, `src/bridge/index.ts`, `src/bridge/adapter.ts`) + integration tests & 346-test suite validation | ~250–340 lines | Sub-slice S4d PR / review unit |

