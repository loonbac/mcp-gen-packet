# Tasks: Slice 3 Declarative TUI Client Injection

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 1,380–1,820 lines aggregate across S3 (additions + deletions across 12 clients, engine, codecs, and tests) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (S3a: engine & contracts) → PR 2 (S3b.1: standard batch 1) → PR 3 (S3b.2: standard batch 2) → PR 4 (S3b.3: local array) → PR 5 (S3c.1: VS Code & Claude) → PR 6 (S3c.2: Codex TOML & registry) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

```text
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High
```

---

## Delivery Gate & Review Strategy Recommendation

Under the `ask-on-risk` delivery strategy, because the aggregate forecast for Slice 3 (1,380–1,820 changed lines across 22 source files and 7 test files, counting both additions and deletions of legacy client bodies) exceeds the 400-line review budget, human confirmation is required before applying changes.

To eliminate review overload and protect review rigor without monolithic diffs, Slice 3 is partitioned into six autonomous, independently green work units:
1. **S3a: Injection Engine, Contracts & Safe Filesystem Helpers** (~260–340 lines)
2. **S3b.1: Standard Multi-Server JSON Clients — Batch 1 (Cursor, Gemini, Windsurf, Kimi)** (~260–340 lines)
3. **S3b.2: Standard Multi-Server JSON Clients — Batch 2 (Kiro, Qwen, Antigravity)** (~200–280 lines)
4. **S3b.3: Local Command Array Clients (OpenCode, Kilocode)** (~180–260 lines)
5. **S3c.1: Specialized Single-File and Platform Clients (VS Code, Claude Code)** (~220–300 lines)
6. **S3c.2: Bounded TOML Codec, Codex Descriptor & Registry Finalization** (~260–340 lines)

Each work unit possesses crisp start, finish, verification (`npx vitest run <path>`, `npm test`, `npm run build`), and rollback boundaries.

---

## Sub-Slice S3a: Generic Engine, Descriptor Types, Cleanup & FS Utilities (~260–340 lines)

Autonomous work unit establishing the canonical client interfaces, pure client factory, pure stale-key cleanup, and backward-compatible extensions to filesystem utilities for partial mock tolerance.

### Phase S3a.1 — Stale Key Cleanup Tests (RED)

- [x] Write failing unit tests in `tests/tui/engine/remove-stale-mcp-ptb.test.ts` verifying removal of `mcp.MCP_PTB`, `mcpServers.MCP_PTB`, and `servers.MCP_PTB` containers, retention of sibling keys, removal of falsy/empty stale entries, non-mutation of input objects, and handling of empty or missing containers. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/tui/engine/remove-stale-mcp-ptb.test.ts` to confirm RED failure due to missing module. <!-- sdd-owner: implementation -->

### Phase S3a.2 — Stale Key Cleanup Implementation (GREEN)

- [x] Implement pure function `removeStaleMcpPtb<T extends Record<string, unknown>>(current: Readonly<T>): T` in `src/tui/engine/remove-stale-mcp-ptb.ts` cloning affected root keys without in-place mutation. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/tui/engine/remove-stale-mcp-ptb.test.ts` to observe GREEN passage. <!-- sdd-owner: implementation -->

### Phase S3a.3 — Filesystem Helpers Compatibility (RED → GREEN)

- [x] Write failing unit tests in `tests/core/utils/fs/backup-file.test.ts` and `tests/core/utils/fs/patch-json-config.test.ts` asserting:
  - `backupFile` writes provided in-memory snapshot without extra source reads.
  - `patchJsonConfig` supports `initial()` factory for missing files.
  - `patchJsonConfig` supports custom `deserialize`/`serialize` codecs.
  - `patchJsonConfig` safely checks `renameSync` and `unlinkSync` existence via `Reflect.has` before invocation, falling back to `writeFileSync` under partial mocks where `renameSync` is undefined. <!-- sdd-owner: implementation -->
- [x] Extend `backupFile` in `src/core/utils/fs/backup-file.ts` with optional `snapshot?: string | NodeJS.ArrayBufferView` parameter. <!-- sdd-owner: implementation -->
- [x] Extend `patchJsonConfig` and `PatchOptions<T>` in `src/core/utils/fs/patch-json-config.ts` to accept `initial`, `deserialize`, `serialize`, and partial-mock-safe filesystem invocation without breaking atomic rename in production. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/core/utils/fs/` to verify GREEN passage across all filesystem tests. <!-- sdd-owner: implementation -->

### Phase S3a.4 — Contracts & Engine Tests (RED)

- [x] Define canonical public contracts `MCPClient` and `ClientInjectionResult` in `src/tui/engine/mcp-client.ts`. <!-- sdd-owner: implementation -->
- [x] Define descriptor interfaces `ClientDescriptor`, `ClientPatchContext`, `ClientFormat`, and `ClientConfig` in `src/tui/engine/client-descriptor.ts`. <!-- sdd-owner: implementation -->
- [x] Update `src/tui/clients/types.ts` to re-export `MCPClient` and `ClientInjectionResult` from `../engine/mcp-client.js` as a backward-compatible façade. <!-- sdd-owner: implementation -->
- [x] Write failing unit tests in `tests/tui/engine/inject-client.test.ts` covering:
  - Pure factory instantiation with zero filesystem I/O at construction time.
  - `detect()` returning false on null config path, or delegating to `existsSync` / custom detector.
  - `configPath()` invoking descriptor resolver dynamically.
  - `inject(projectPath)` calculating normalized `scriptPath`, executing stale cleanup, applying patch, verifying output, and returning `{ success: true, backup }`.
  - Directory creation when `ensureDir: true`.
  - Error capture returning `{ success: false, error }` without unhandled rejections. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/tui/engine/inject-client.test.ts` to confirm RED failure. <!-- sdd-owner: implementation -->

### Phase S3a.5 — Pure Engine Implementation (GREEN)

- [x] Implement `injectClient<TConfig>(descriptor: ClientDescriptor<TConfig>): MCPClient` in `src/tui/engine/inject-client.ts` integrating `removeStaleMcpPtb` and `patchJsonConfig`. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/tui/engine/inject-client.test.ts` to observe GREEN passage. <!-- sdd-owner: implementation -->

### Phase S3a.6 — Triangulation & Verification Gate (REFACTOR)

- [x] Triangulate edge cases in `tests/tui/engine/inject-client.test.ts` for empty existing file backup, verification predicate failure, and custom codec exceptions. <!-- sdd-owner: implementation -->
- [x] Run legacy test suite `npx vitest run tests/tui/clients.test.ts` to verify zero regression on existing clients. <!-- sdd-owner: implementation -->
- [x] Run full test suite `npm test` and build check `npm run build`. <!-- sdd-owner: implementation -->

---

## Sub-Slice S3b.1: Standard Multi-Server JSON Clients — Batch 1 (~260–340 lines)

Autonomous work unit creating the shared `mcpServers` descriptor factory and refactoring the first 4 standard clients (Cursor, Gemini, Windsurf, Kimi) into declarative descriptors and thin façades.

### Phase S3b.1.1 — Batch 1 Descriptors Tests (RED)

- [x] Write failing unit tests in `tests/tui/engine/batch1-descriptors.test.ts` covering:
  - Standardized `mcpServers.MCP_PTB` payloads with `command: "node"` and `args: [scriptPath]`, with no `cwd`.
  - Path resolution for Cursor (`~/.cursor/mcp.json`), Gemini (`~/.gemini/settings.json`), Windsurf (`~/.codeium/windsurf/mcp_config.json`), and Kimi (`~/.kimi/mcp.json`).
  - Missing-file policy: Cursor and Gemini fail if missing; Windsurf and Kimi initialize with `{}`. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/tui/engine/batch1-descriptors.test.ts` to confirm RED failure. <!-- sdd-owner: implementation -->

### Phase S3b.1.2 — Batch 1 Descriptors & Façades (GREEN)

- [x] Implement declarative descriptors in `src/tui/clients/cursor.ts`, `gemini.ts`, `windsurf.ts`, and `kimi.ts`. <!-- sdd-owner: implementation -->
- [x] Create descriptors in `src/tui/clients/cursor.ts`, `gemini.ts`, `windsurf.ts`, and `kimi.ts`. <!-- sdd-owner: implementation -->
- [x] Refactor procedural client modules `src/tui/clients/cursor.ts`, `gemini.ts`, `windsurf.ts`, and `kimi.ts` into thin façades delegating to `injectClient(descriptor)`. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/tui/engine/batch1-descriptors.test.ts` and `tests/tui/clients.test.ts` to confirm GREEN passage under existing partial `node:fs` mocks. <!-- sdd-owner: implementation -->

### Phase S3b.1.3 — Triangulation & Verification Gate (REFACTOR)

- [x] Triangulate path normalization (forward slashes in Windows-style paths) across Batch 1 descriptors in `tests/tui/engine/batch1-descriptors.test.ts`. <!-- sdd-owner: implementation -->
- [x] Run full test suite `npm test` and build check `npm run build`. <!-- sdd-owner: implementation -->

---

## Sub-Slice S3b.2: Standard Multi-Server JSON Clients — Batch 2 (~200–280 lines)

Autonomous work unit refactoring the remaining 3 standard multi-server clients (Kiro, Qwen, Antigravity) into declarative descriptors and thin façades.

### Phase S3b.2.1 — Batch 2 Descriptors Tests (RED)

- [x] Add failing unit tests in `tests/tui/engine/descriptor-families.test.ts` covering path resolution, payload shape, and `{}` initialization policy for Kiro (`~/.kiro/settings/mcp.json`), Qwen (`~/.qwen/settings.json`), and Antigravity (`~/.gemini/antigravity/mcp_config.json`). <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/tui/engine/descriptor-families.test.ts` to confirm RED failure for Batch 2 clients. <!-- sdd-owner: implementation -->

### Phase S3b.2.2 — Batch 2 Descriptors & Façades (GREEN)

- [x] Create descriptors in `src/tui/clients/descriptors/kiro.ts`, `qwen.ts`, and `antigravity.ts` using `createMcpServersDescriptor`. <!-- sdd-owner: implementation -->
- [x] Refactor procedural client modules `src/tui/clients/kiro.ts`, `qwen.ts`, and `antigravity.ts` into thin façades delegating to `injectClient(descriptor)`. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/tui/engine/descriptor-families.test.ts` and `tests/tui/clients.test.ts` to confirm GREEN passage. <!-- sdd-owner: implementation -->

### Phase S3b.2.3 — Triangulation & Verification Gate (REFACTOR)

- [x] Triangulate stale key removal for Batch 2 clients verifying that prior `servers.MCP_PTB` or `mcp.MCP_PTB` entries are purged upon injection. <!-- sdd-owner: implementation -->
- [x] Run full test suite `npm test` and build check `npm run build`. <!-- sdd-owner: implementation -->

---

## Sub-Slice S3b.3: Local Command Array Clients (~180–260 lines)

Autonomous work unit creating the shared local array descriptor factory and refactoring OpenCode and Kilocode into declarative descriptors and thin façades.

### Phase S3b.3.1 — Local Array Descriptors Tests (RED)

- [x] Write failing unit tests in `tests/tui/engine/local-mcp-descriptors.test.ts` covering:
  - `createLocalMcpDescriptor` factory producing `mcp.MCP_PTB` with `command: ["node", scriptPath]` and `type: "local"`.
  - Path resolution for OpenCode (`~/.config/opencode/opencode.json`) and Kilocode (`~/.config/kilo/opencode.json`).
  - Missing-file policy: OpenCode requires existing file; Kilocode initializes missing with `{}`. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/tui/engine/local-mcp-descriptors.test.ts` to confirm RED failure. <!-- sdd-owner: implementation -->

### Phase S3b.3.2 — Local Array Descriptors & Façades (GREEN)

- [x] Implement `createLocalMcpDescriptor` in `src/tui/clients/descriptors/create-local-mcp-descriptor.ts`. <!-- sdd-owner: implementation -->
- [x] Create descriptors in `src/tui/clients/descriptors/opencode.ts` and `kilocode.ts`. <!-- sdd-owner: implementation -->
- [x] Refactor procedural client modules `src/tui/clients/opencode.ts` and `kilocode.ts` into thin façades delegating to `injectClient(descriptor)`. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/tui/engine/local-mcp-descriptors.test.ts` and `tests/tui/clients.test.ts` to confirm GREEN passage. <!-- sdd-owner: implementation -->

### Phase S3b.3.3 — Triangulation & Verification Gate (REFACTOR)

- [x] Triangulate error handling for OpenCode and Kilocode when filesystem reads fail, asserting `{ success: false, error }` is returned without unhandled exceptions. <!-- sdd-owner: implementation -->
- [x] Run full test suite `npm test` and build check `npm run build`. <!-- sdd-owner: implementation -->

---

## Sub-Slice S3c.1: Specialized Clients — VS Code & Claude Code (~220–300 lines)

Autonomous work unit refactoring VS Code (cross-platform path resolution, `servers` section, `cwd` inclusion) and Claude Code (dedicated file per server, parent directory creation) into declarative descriptors and thin façades.

### Phase S3c.1.1 — Specialized Descriptors Tests (RED)

- [x] Write failing unit tests in `tests/tui/engine/specialized-descriptors.test.ts` covering:
  - VS Code platform path resolution (Windows `APPDATA/Code/User/mcp.json`, macOS `~/Library/Application Support/Code/User/mcp.json`, Linux `~/.config/Code/User/mcp.json`).
  - VS Code payload: `servers.MCP_PTB` containing `command: "node"`, `args: [scriptPath]`, and `cwd: projectPath` (with normalized forward slashes).
  - Claude Code path resolution: `~/.claude/mcp/MCP_PTB.json`.
  - Claude Code `ensureDir: true` creating `~/.claude/mcp` recursively.
  - Claude Code payload: root object `{ command: "node", args: [scriptPath] }`.
  - Claude Code verification verifying `command` and `args` on root object. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/tui/engine/specialized-descriptors.test.ts` to confirm RED failure. <!-- sdd-owner: implementation -->

### Phase S3c.1.2 — Specialized Descriptors & Façades (GREEN)

- [x] Implement VS Code descriptor in `src/tui/clients/descriptors/vscode.ts`. <!-- sdd-owner: implementation -->
- [x] Implement Claude Code descriptor in `src/tui/clients/descriptors/claude.ts`. <!-- sdd-owner: implementation -->
- [x] Refactor procedural client modules `src/tui/clients/vscode.ts` and `claude.ts` into thin façades delegating to `injectClient(descriptor)`. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/tui/engine/specialized-descriptors.test.ts` and `tests/tui/clients.test.ts` to confirm GREEN passage. <!-- sdd-owner: implementation -->

### Phase S3c.1.3 — Triangulation & Verification Gate (REFACTOR)

- [x] Triangulate platform switching (`process.env.APPDATA`, `process.env.XDG_CONFIG_HOME`, `darwin`) in `tests/tui/engine/specialized-descriptors.test.ts` to guarantee 100% path coverage for VS Code. <!-- sdd-owner: implementation -->
- [x] Triangulate Claude Code injection on existing empty file vs missing file to verify backup generation and directory creation. <!-- sdd-owner: implementation -->
- [x] Run full test suite `npm test` and build check `npm run build`. <!-- sdd-owner: implementation -->

---

## Sub-Slice S3c.2: Bounded Codex TOML Codec, Codex Descriptor & Registry (~260–340 lines)

Autonomous work unit extracting the bounded TOML codec, refactoring the Codex client, and validating the final client registry and complete test suite.

### Phase S3c.2.1 — Codex TOML Codec Tests (RED)

- [x] Write failing unit tests in `tests/tui/engine/codex-toml.test.ts` covering:
  - Parsing TOML sections (`[section]`, `[section.sub]`), scalar strings, and string arrays (`command = ["node", "..."]`).
  - Serializing TOML maintaining section hierarchy and array brackets.
  - Round-trip fidelity preserving existing unrelated sections in `~/.codex/config.toml`.
  - Stripping comments and whitespace tolerance. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/tui/engine/codex-toml.test.ts` to confirm RED failure. <!-- sdd-owner: implementation -->

### Phase S3c.2.2 — Codex TOML Codec Implementation (GREEN)

- [x] Implement pure functions `parseCodexToml` and `stringifyCodexToml` in `src/tui/clients/codecs/codex-toml.ts`. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/tui/engine/codex-toml.test.ts` to observe GREEN passage. <!-- sdd-owner: implementation -->

### Phase S3c.2.3 — Codex Descriptor, Façade & Registry Verification (GREEN)

- [x] Implement Codex descriptor in `src/tui/clients/descriptors/codex.ts` utilizing `format: "custom"`, `parseCodexToml`, `stringifyCodexToml`, and non-empty output verification. <!-- sdd-owner: implementation -->
- [x] Refactor procedural client module `src/tui/clients/codex.ts` into a thin façade delegating to `injectClient(descriptor)`. <!-- sdd-owner: implementation -->
- [x] Verify `src/tui/clients/index.ts` preserves exact historical client order (`ALL_CLIENTS` with opencode, claude, vscode, cursor, gemini, codex, windsurf, kilocode, kimi, kiro, qwen, antigravity) and `getAvailableClients()` filtering. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/tui/clients.test.ts` to verify all 29 historical client tests pass without mock changes. <!-- sdd-owner: implementation -->

### Phase S3c.2.4 — Triangulation & Slice 3 Final Acceptance Gate (REFACTOR)

- [x] Triangulate Codex injection with existing complex TOML configurations to ensure unrelated sections are preserved. <!-- sdd-owner: implementation -->
- [x] Run all engine test suites (`npx vitest run tests/tui/engine/ tests/core/utils/fs/`). <!-- sdd-owner: implementation -->
- [x] Run complete repository test suite (`npm test`) confirming all 221+ tests pass with 0 failures. <!-- sdd-owner: implementation -->
- [x] Run type compilation check (`npm run build`) ensuring zero TypeScript errors. <!-- sdd-owner: implementation -->
