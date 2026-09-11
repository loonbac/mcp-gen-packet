# Slice 3 TUI Declarative Client Injection Specification

## Purpose

Define the normative behavioral contracts, requirements, and testable scenarios for **Slice 3 (Declarative TUI Client Injection)** of the `micro-modular-alignment` change. This slice refactors the 12 MCP client adapters under `src/tui/clients/*` (~50 lines each) from repetitive procedural monoliths that duplicate filesystem operations, JSON parsing, `.bak` backup creation, configuration mutation, and post-write verification into a pure, generic, descriptor-driven injection engine. The engine builds on the safe filesystem micro-utilities delivered in Slice 1 (`src/core/utils/fs/backup-file.ts` and `src/core/utils/fs/patch-json-config.ts`) and pairs with concise declarative descriptors (~5–15 lines each). It preserves 100% backward compatibility with existing public client contracts (`detect`, `configPath`, `inject`), keeps old module entry points as thin re-exporting facades, and guarantees zero regressions across the 29 existing tests in `tests/tui/clients.test.ts` and the full 221-test suite.

---

## Non-Goals (Scope Boundaries for S4–S5)

To protect the review budget (<400 changed lines per review slice) and maintain focused review boundaries, the following items are explicitly **excluded** from this specification:

- **S4 (Bridge Decomposition, Ports, and Infrastructure):** Decomposing `src/bridge/live.ts` into HTTP server, process detector, event buffer, monitor UI, and bridge adapter is deferred to Slice 4.
- **S5 (Catalogs & Server Handlers):** Separating catalog data maps from query functions and extracting MCP server handlers from `src/server.ts` is deferred to Slice 5.
- **Interactive TUI CLI Changes:** Modifying interactive Clack prompts, console colors, user confirmation dialogs, or workflow steps in `src/tui/index.ts`, `src/tui/configure.ts`, `src/tui/detect.ts`, or `src/tui/install.ts`.
- **New MCP Clients or Protocols:** Supporting new AI editors, IDEs, or configuration formats beyond the 12 existing clients (`opencode`, `claude`, `vscode`, `cursor`, `gemini`, `codex`, `windsurf`, `kilocode`, `kimi`, `kiro`, `qwen`, `antigravity`).
- **External Dependencies:** Zero new runtime or development dependencies added to `package.json`.

---

## Constraints and Delivery Gates

1. **Review Budget:** Each sub-slice (S3a, S3b, S3c) MUST remain strictly below **400 changed lines** (including engine code, descriptors, tests, and adapter facades).
2. **Strict TDD:** The generic engine, descriptor types, and refactored client facades MUST be developed using strict test-driven development (RED → GREEN → REFACTOR) with unit tests located under `tests/core/tui/` or `tests/tui/engine/`.
3. **Per-Phase Green:** All 221 existing tests across the repository MUST remain green (`npm test` passes with zero failures) before and after each sub-slice.
4. **Zero Regression on Client Tests:** All 29 tests in `tests/tui/clients.test.ts` MUST pass without modifications to existing test assertions or mock setups.
5. **API & Facade Backward Compatibility:** Every client adapter module in `src/tui/clients/*.ts` MUST retain its historical named export (e.g. `cursorClient`, `claudeClient`, `vscodeClient`) conforming to the `MCPClient` interface (`name`, `id`, `detect()`, `configPath()`, `inject(projectPath)`).
6. **Zero Stale Key Contamination:** Injection MUST atomically clean prior `MCP_PTB` definitions across all potential key locations (`mcp.MCP_PTB`, `mcpServers.MCP_PTB`, `servers.MCP_PTB`) before applying client-specific configuration.
7. **Safe Backup Lifecycle:** Every mutating injection on an existing file MUST create a `.bak` backup copy of the original content prior to writing updated configuration.

---

## Requirements

### Requirement: Declarative Client Descriptor Specification and Contracts

The system MUST define strongly typed declarative client descriptor interfaces (in `src/core/tui/` or `src/tui/engine/`, with canonical location decided in design). A descriptor MUST encapsulate the client's identity, path resolution logic, configuration transformation rules, post-write verification predicate, and optional filesystem or serialization options without embedding procedural filesystem I/O loops.

The descriptor type MUST specify:
- `id`: unique client identifier matching historical values (e.g. `"cursor"`, `"claude"`, `"vscode"`).
- `name`: display name matching historical values (e.g. `"Cursor"`, `"Claude Code"`, `"VS Code"`).
- `resolveConfigPath`: zero-argument function returning the absolute path to the configuration file or `null`.
- `format`: declarative target format category (such as `"mcpServers"`, `"mcp"`, `"servers"`, or `"custom"`).
- `patch`: configuration mutator function that applies the client's payload given current content and normalized project script path.
- `verify`: predicate function that evaluates the re-read configuration and returns `true` if and only if the injected configuration is valid.
- `ensureDir`: optional boolean flag indicating whether the parent directory of the configuration file MUST be created if missing (required for Claude Code).
- `customSerializer`: optional parse/serialize pair for non-standard formats (such as TOML for Codex).

#### Scenario: Define standard multi-server JSON client descriptor
- GIVEN a client identifier `"cursor"` and display name `"Cursor"`
- WHEN a `ClientDescriptor` is created for Cursor
- THEN `resolveConfigPath()` MUST resolve to `join(homedir(), ".cursor", "mcp.json")`
- AND `format` MUST indicate multi-server configuration under `"mcpServers"`
- AND `verify` MUST confirm `mcpServers.MCP_PTB` is present in the updated configuration

#### Scenario: Define platform-aware client descriptor with working directory
- GIVEN a client identifier `"vscode"` and display name `"VS Code"`
- WHEN a `ClientDescriptor` is created for VS Code
- THEN `resolveConfigPath()` MUST resolve to `%APPDATA%/Code/User/mcp.json` on Windows, `~/Library/Application Support/Code/User/mcp.json` on macOS, and `~/.config/Code/User/mcp.json` on Linux
- AND `format` MUST indicate configuration under `"servers"`
- AND `patch` MUST include both `args: [scriptPath]` and `cwd: projectPath`

#### Scenario: Define dedicated single-server file descriptor with directory prerequisite
- GIVEN a client identifier `"claude"` and display name `"Claude Code"`
- WHEN a `ClientDescriptor` is created for Claude Code
- THEN `resolveConfigPath()` MUST resolve to `join(homedir(), ".claude", "mcp", "MCP_PTB.json")`
- AND `ensureDir` MUST be `true`
- AND `patch` MUST produce a top-level object containing `{ command: "node", args: [scriptPath] }`
- AND `verify` MUST confirm both `command` and `args` exist on the root object

#### Scenario: Define custom-format descriptor with TOML parser and serializer
- GIVEN a client identifier `"codex"` and display name `"Codex"`
- WHEN a `ClientDescriptor` is created for Codex
- THEN `resolveConfigPath()` MUST resolve to `join(homedir(), ".codex", "config.toml")`
- AND `customSerializer` MUST provide TOML parse and stringify implementations
- AND `verify` MUST confirm the output file exists and is non-empty

---

### Requirement: Generic Pure Client Injection Engine (`createClientFromDescriptor`)

The system MUST provide a reusable client injection engine (in `src/core/tui/` or `src/tui/engine/`) that takes a `ClientDescriptor` and constructs a fully compliant `MCPClient` object (`detect`, `configPath`, `inject`). The engine MUST orchestrate configuration detection, path normalization, stale key cleanup, backup generation via `backupFile` or safe filesystem primitives, atomic configuration update, and post-write verification without throwing unhandled exceptions.

#### Scenario: Detect client availability based on configuration file existence
- GIVEN a client descriptor with `resolveConfigPath()` returning `"/path/to/config.json"`
- AND `existsSync("/path/to/config.json")` returns `true`
- WHEN `client.detect()` is called
- THEN it MUST return `true`
- WHEN `existsSync("/path/to/config.json")` returns `false`
- THEN `client.detect()` MUST return `false`

#### Scenario: Return null configPath when path resolver cannot resolve
- GIVEN a client descriptor whose `resolveConfigPath()` returns `null`
- WHEN `client.configPath()` is called
- THEN it MUST return `null`

#### Scenario: Execute successful transactional injection with backup and verification
- GIVEN a target configuration file containing existing configuration `{ "otherServer": { "command": "run" } }`
- AND a client descriptor targeting `"mcpServers"`
- AND project path `"/workspace/project"`
- WHEN `client.inject("/workspace/project")` is called
- THEN the target file MUST be backed up to `configPath + ".bak"`
- AND any previous `mcp.MCP_PTB`, `mcpServers.MCP_PTB`, or `servers.MCP_PTB` MUST be purged
- AND the updated file MUST contain `mcpServers.MCP_PTB` with `command: "node"` and `args: ["/workspace/project/dist/index.js"]`
- AND sibling properties like `otherServer` MUST be preserved
- AND the return value MUST be `{ success: true, backup: configPath + ".bak" }`

#### Scenario: Handle missing configuration file gracefully without unhandled exception
- GIVEN a client descriptor targeting a file that does not exist
- AND the descriptor does NOT specify creating new files from scratch
- WHEN `client.inject(projectPath)` is executed and reading the target fails
- THEN the engine MUST catch the error
- AND MUST return `{ success: false, error: expect.any(String) }`
- AND MUST NOT throw an unhandled exception to the caller

#### Scenario: Handle malformed JSON configuration safely
- GIVEN a target configuration file containing malformed, unparseable JSON text
- WHEN `client.inject(projectPath)` is called
- THEN the engine MUST catch the parsing exception
- AND MUST return `{ success: false, error: expect.any(String) }`
- AND the target file MUST NOT be overwritten with corrupt data

#### Scenario: Fail injection when post-write verification predicate returns false
- GIVEN a target configuration file and project path
- AND the descriptor's `verify` predicate evaluates to `false` on the written content
- WHEN `client.inject(projectPath)` is called
- THEN the engine MUST detect verification failure
- AND MUST return `{ success: false, error: expect.stringContaining("Verificación fallida") }`

---

### Requirement: Standard Multi-Server JSON Clients Migration (Batch 1)

The system MUST migrate the 7 standard multi-server clients to declarative descriptors and thin facades while maintaining identical behavior:
1. `cursor`: `~/.cursor/mcp.json`
2. `gemini`: `~/.gemini/settings.json`
3. `windsurf`: `~/.codeium/windsurf/mcp_config.json`
4. `kimi`: `~/.kimi/mcp.json`
5. `kiro`: `~/.kiro/settings/mcp.json`
6. `qwen`: `~/.qwen/settings.json`
7. `antigravity`: `~/.gemini/antigravity/mcp_config.json`

All 7 clients MUST configure `mcpServers.MCP_PTB = { command: "node", args: [scriptPath] }` without `cwd`.

#### Scenario: Inject Cursor client configuration
- GIVEN `cursorClient` and existing configuration `{ "mcpServers": {} }` in `~/.cursor/mcp.json`
- WHEN `cursorClient.inject("/test/project")` is called
- THEN `mcpServers.MCP_PTB` MUST be `{ command: "node", args: ["/test/project/dist/index.js"] }`
- AND `cursorClient.inject` MUST return `{ success: true, backup: expect.any(String) }`

#### Scenario: Inject Windsurf client configuration with stale key cleanup
- GIVEN `windsurfClient` and configuration containing stale `{ "servers": { "MCP_PTB": { "cwd": "/old" } } }`
- WHEN `windsurfClient.inject("/test/project")` is called
- THEN the stale `servers.MCP_PTB` entry MUST be deleted
- AND `mcpServers.MCP_PTB` MUST be added
- AND `windsurfClient.inject` MUST return `{ success: true, backup: expect.any(String) }`

#### Scenario: Inject Gemini, Kimi, Kiro, Qwen, and Antigravity configurations
- GIVEN any of `geminiClient`, `kimiClient`, `kiroClient`, `qwenClient`, or `antigravityClient`
- WHEN `inject("/test/project")` is called
- THEN the injected payload MUST reside under `mcpServers.MCP_PTB`
- AND `args` MUST point to `"/test/project/dist/index.js"` with normalized slashes
- AND the operation MUST succeed and return the backup path

---

### Requirement: Local Command Array JSON Clients Migration (Batch 2)

The system MUST migrate the 2 local command array clients to declarative descriptors and thin facades:
1. `opencode`: `~/.config/opencode/opencode.json`
2. `kilocode`: `~/.config/kilo/opencode.json`

Both clients MUST configure `mcp.MCP_PTB = { command: ["node", scriptPath], type: "local" }` and verify against `verifyConfig.mcp?.MCP_PTB`.

#### Scenario: Inject OpenCode client configuration
- GIVEN `opencodeClient` and existing configuration in `~/.config/opencode/opencode.json`
- WHEN `opencodeClient.inject("/test/project")` is called
- THEN `mcp.MCP_PTB` MUST be `{ command: ["node", "/test/project/dist/index.js"], type: "local" }`
- AND stale entries under `mcpServers` or `servers` MUST be removed
- AND `opencodeClient.inject` MUST return `{ success: true, backup: expect.any(String) }`

#### Scenario: Inject Kilocode client configuration
- GIVEN `kilocodeClient` and existing configuration in `~/.config/kilo/opencode.json`
- WHEN `kilocodeClient.inject("/test/project")` is called
- THEN `mcp.MCP_PTB` MUST be `{ command: ["node", "/test/project/dist/index.js"], type: "local" }`
- AND `kilocodeClient.inject` MUST return `{ success: true, backup: expect.any(String) }`

#### Scenario: Handle OpenCode injection filesystem error
- GIVEN `opencodeClient` and filesystem reading throws an I/O error
- WHEN `opencodeClient.inject("/test/project")` is called
- THEN it MUST return `{ success: false, error: expect.any(String) }`
- AND MUST NOT throw

---

### Requirement: Specialized Single-File and Custom-Format Clients Migration (Batch 3)

The system MUST migrate the 3 specialized clients to declarative descriptors and thin facades:
1. `vscodeClient`: platform-dependent path resolution, payload under `servers.MCP_PTB` with `cwd: projectPath.replace(/\\/g, "/")`, verified against `verifyConfig.servers?.MCP_PTB`.
2. `claudeClient`: dedicated file per server at `~/.claude/mcp/MCP_PTB.json`, creates parent directory `~/.claude/mcp/` if missing, payload `{ command: "node", args: [scriptPath] }`, verified against `verifyConfig.command && verifyConfig.args`.
3. `codexClient`: TOML configuration at `~/.codex/config.toml`, payload under `[mcp.servers.MCP_PTB]` with `command = ["node", scriptPath]`, verified against non-empty written file.

#### Scenario: Inject VS Code configuration with platform path and working directory
- GIVEN `vscodeClient` and project path `"/test/project"`
- WHEN `vscodeClient.inject("/test/project")` is called
- THEN `servers.MCP_PTB` MUST equal `{ command: "node", args: ["/test/project/dist/index.js"], cwd: "/test/project" }`
- AND `vscodeClient.inject` MUST return `{ success: true, backup: expect.any(String) }`

#### Scenario: Inject Claude Code configuration with directory creation and isolated file
- GIVEN `claudeClient` and configuration directory `~/.claude/mcp/` does not exist
- WHEN `claudeClient.inject("/test/project")` is called
- THEN the directory `~/.claude/mcp/` MUST be created recursively
- AND the file `MCP_PTB.json` MUST be written with `{ command: "node", args: ["/test/project/dist/index.js"] }`
- AND `claudeClient.inject` MUST return `{ success: true, backup: expect.anything() }`

#### Scenario: Inject Codex configuration using TOML format
- GIVEN `codexClient` and configuration file `~/.codex/config.toml`
- WHEN `codexClient.inject("/test/project")` is called
- THEN the file MUST be parsed and serialized as TOML
- AND the written content MUST contain `mcp` section with command array
- AND `codexClient.inject` MUST return `{ success: true, backup: expect.any(String) }`

---

### Requirement: Client Aggregate Registry & Backward-Compatible Public Facades

The system MUST preserve the aggregate client registry in `src/tui/clients/index.ts` exporting:
- `ALL_CLIENTS`: array of all 12 `MCPClient` instances in exact historical order (`[opencodeClient, claudeClient, vscodeClient, cursorClient, geminiClient, codexClient, windsurfClient, kilocodeClient, kimiClient, kiroClient, qwenClient, antigravityClient]`).
- `getAvailableClients()`: function returning only clients whose `detect()` method returns `true`.

All historical module entry points under `src/tui/clients/*.ts` MUST remain importable and satisfy the 29 tests in `tests/tui/clients.test.ts` without changes to test assertions.

#### Scenario: Filter available clients based on detection status
- GIVEN `ALL_CLIENTS` registered in `src/tui/clients/index.ts`
- AND `existsSync` returns `false` for all paths
- WHEN `getAvailableClients()` is called
- THEN it MUST return an empty array `[]`
- WHEN `existsSync` returns `true` for all paths
- THEN `getAvailableClients()` MUST return all 12 clients matching `ALL_CLIENTS.length`

#### Scenario: Preserve exact ordering and exports in client registry
- GIVEN the imported `ALL_CLIENTS` array from `src/tui/clients/index.ts`
- WHEN inspecting client elements
- THEN element 0 MUST be `opencodeClient` (id `"opencode"`)
- AND element 1 MUST be `claudeClient` (id `"claude"`)
- AND element 2 MUST be `vscodeClient` (id `"vscode"`)
- AND element 3 MUST be `cursorClient` (id `"cursor"`)
- AND element 11 MUST be `antigravityClient` (id `"antigravity"`)

#### Scenario: Full suite regression prevention
- GIVEN the refactored TUI client adapters and engine
- WHEN running `npm test` across the full test suite
- THEN all 29 tests in `tests/tui/clients.test.ts` MUST pass
- AND all 221 repository tests MUST pass with zero failures

---

## Sub-Slice Delivery Plan (<400 Lines per Review Slice)

To ensure strict compliance with the review budget constraint (<400 changed lines per review slice), Slice 3 is partitioned into three independently green sub-slices:

| Sub-Slice | Scope | Forecasted Lines | Review Boundary |
|---|---|---|---|
| **S3a** | Common descriptor types (`ClientDescriptor`), generic injection engine (`createClientFromDescriptor` / `injectClientConfig`), and comprehensive unit tests under `tests/core/tui/` or `tests/tui/engine/` | ~160–220 lines | Sub-slice S3a PR / review unit |
| **S3b** | Descriptors and thin adapter facades for Batch 1 (7 standard `mcpServers` clients: Cursor, Gemini, Windsurf, Kimi, Kiro, Qwen, Antigravity) + Batch 2 (2 `mcp` local clients: OpenCode, Kilocode) + verification against `tests/tui/clients.test.ts` | ~180–240 lines | Sub-slice S3b PR / review unit |
| **S3c** | Descriptors and thin adapter facades for Batch 3 (3 specialized clients: VS Code, Claude Code, Codex) + registry verification in `src/tui/clients/index.ts` + full 221-test suite validation | ~180–250 lines | Sub-slice S3c PR / review unit |
