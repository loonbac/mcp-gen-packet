# Design: Slice 3 Declarative TUI Client Injection

## Status

- **status**: `designed_with_delivery_gate`
- **change**: `micro-modular-alignment`
- **scope**: `slice-3-tui only`
- **execution**: `auto`
- **artifact_store**: `openspec`
- **strict_tdd**: `true`
- **review_budget**: `<400 changed lines per review unit`
- **skill_resolution**: `fallback-path` (`gentle-ai` and `gentle-ai-cognitive-doc-design`; no phase-specific design skill path was injected)

## Executive summary

Slice 3 places the reusable client injection engine in **`src/tui/engine/`**, not `src/core/tui/`. The engine is application-level TUI behavior: it creates the historical `MCPClient` API and depends inward on existing core filesystem primitives. Putting it under `src/core/tui/` would make core own a presentation adapter contract and would weaken the established `src/tui -> src/core` dependency direction.

`injectClient(descriptor)` is a pure factory: constructing a client performs no filesystem work. Its returned `detect`, `configPath`, and asynchronous `inject` methods preserve the public API. At injection time the engine normalizes paths, removes stale `MCP_PTB` entries, delegates the safe update to `patchJsonConfig`, and maps the result back to the historical client result shape. JSON remains the default; Codex supplies a descriptor-owned TOML codec. `backupFile` and `patchJsonConfig` receive narrowly compatible extensions so the production path remains staged and atomic while `tests/tui/clients.test.ts` continues to work unchanged with its partial `node:fs` mock.

The three requested logical sub-slices remain S3a, S3b, and S3c. Because additions **and deletions** count toward the 400-line budget, S3b and S3c are split into smaller independently green review units. Their PR/chain packaging remains an `ask-on-risk` human-control gate; no chain strategy or `size:exception` is selected by this design.

## Scope decisions

| Topic | Decision |
|---|---|
| Engine location | `src/tui/engine/` owns descriptor contracts, the `MCPClient` contract, stale-key cleanup, and the pure client factory. |
| Core boundary | `src/core/**` remains unaware of TUI clients. The engine may import `src/core/utils/fs/{backup-file,patch-json-config}.ts`. |
| Historical type path | `src/tui/clients/types.ts` becomes a type-only re-export from `../engine/mcp-client.js`. |
| Descriptor ownership | Every client has one module under `src/tui/clients/descriptors/`; repeated family payloads are produced by focused descriptor factories. |
| Factory purity | `injectClient(descriptor)` performs no I/O and mutates neither the descriptor nor module state. I/O begins only when a returned method is invoked. |
| Patch purity | A descriptor `patch` returns a new root config. Shared cleanup clones only affected containers and never mutates the parsed input. |
| JSON updates | The engine delegates reading, backup, staged writing, decoding, verification, and commit to `patchJsonConfig`. |
| TOML updates | Codex uses the same update transaction through descriptor-provided `deserialize`/`serialize` functions; JSON remains the utility default. |
| Missing files | An optional `initial` factory explicitly authorizes creation. Without it, missing files return a failure and are not written. |
| Directory creation | `ensureDir: true` creates `dirname(configPath)` recursively before update; only Claude sets it. |
| Backup semantics | Existing files, including empty files, are backed up before commit. New files have no physical backup, while the client success result keeps reporting the historical `<path>.bak` value. |
| Verification | The staged serialized content is re-read, deserialized, and verified before commit. No third read is introduced, preserving the legacy two-read mock contract. |
| Registry | `ALL_CLIENTS` and `getAvailableClients()` remain in `src/tui/clients/index.ts` with the exact historical order. |

## Dependency direction

```text
src/tui/configure.ts
  -> src/tui/clients/types.ts                 (compatibility type façade)
       -> src/tui/engine/mcp-client.ts

src/tui/clients/*.ts                          (historical value façades)
  -> src/tui/clients/descriptors/*.ts
  -> src/tui/engine/inject-client.ts
       -> src/tui/engine/remove-stale-mcp-ptb.ts
       -> src/core/utils/fs/patch-json-config.ts
            -> src/core/utils/fs/backup-file.ts

src/core/** -X-> src/tui/**
```

Client migrations can land incrementally because `ALL_CLIENTS` may temporarily contain both legacy procedural clients and descriptor-created clients while each review unit remains green.

## Exact TypeScript contracts

All source imports use NodeNext `.js` specifiers.

### Historical public contract

```ts
// src/tui/engine/mcp-client.ts
export type ClientInjectionResult =
  | { readonly success: true; readonly backup?: string }
  | { readonly success: false; readonly error: string; readonly backup?: string };

export interface MCPClient {
  readonly name: string;
  readonly id: string;
  detect(): boolean;
  configPath(): string | null;
  inject(projectPath: string): Promise<ClientInjectionResult>;
}
```

```ts
// src/tui/clients/types.ts
export type {
  ClientInjectionResult,
  MCPClient,
} from "../engine/mcp-client.js";
```

The value shape and asynchronous `inject(projectPath)` contract remain unchanged. Existing imports through `src/tui/clients/types.ts` continue to compile.

### Descriptor contract

```ts
// src/tui/engine/client-descriptor.ts
export type ClientConfig = Record<string, unknown>;
export type ClientFormat =
  | "mcpServers"
  | "mcp"
  | "servers"
  | "single"
  | "custom";

export interface ClientPatchContext {
  readonly projectPath: string;
  readonly scriptPath: string;
}

interface BaseClientDescriptor<TConfig> {
  readonly id: string;
  readonly name: string;
  readonly configPath: () => string | null;
  readonly detect?: (configPath: string) => boolean;
  readonly patch: (
    current: Readonly<TConfig>,
    context: Readonly<ClientPatchContext>,
  ) => TConfig;
  readonly verify?: (
    written: Readonly<TConfig>,
    serialized: string,
  ) => boolean;
  readonly ensureDir?: boolean;
  readonly initial?: () => TConfig;
}

export type ClientDescriptor<TConfig = ClientConfig> =
  | (BaseClientDescriptor<TConfig> & {
      readonly format: Exclude<ClientFormat, "custom">;
      readonly deserialize?: never;
      readonly serialize?: never;
    })
  | (BaseClientDescriptor<TConfig> & {
      readonly format: "custom";
      readonly deserialize: (raw: string) => TConfig;
      readonly serialize: (config: Readonly<TConfig>) => string;
    });
```

`initial` is necessary to represent existing creation behavior without hiding it in filesystem code. It is enabled for Claude and for legacy clients that already accept a missing config (`windsurf`, `kilocode`, `kimi`, `kiro`, `qwen`, and `antigravity`). Cursor, Gemini, OpenCode, VS Code, and Codex continue to fail safely when their target file is absent.

### Pure factory

```ts
// src/tui/engine/inject-client.ts
export function injectClient<TConfig>(
  descriptor: ClientDescriptor<TConfig>,
): MCPClient;
```

Factory behavior:

1. Copy only `id` and `name` into the returned object; do not run `configPath`, `detect`, or filesystem code during construction.
2. `configPath()` calls the descriptor resolver each time and returns its string or `null` unchanged.
3. `detect()` returns `false` for a null path; otherwise it calls `descriptor.detect(path)` or defaults to `existsSync(path)`.
4. `inject(projectPath)` resolves the path once, normalizes `projectPath` slashes, and computes `scriptPath = join(projectPath, "dist", "index.js").replace(/\\/g, "/")`.
5. If `ensureDir` is true, create `dirname(configPath)` recursively before patching.
6. Pass a composed pure patch to `patchJsonConfig`: first `removeStaleMcpPtb(current)`, then `descriptor.patch(cleaned, context)`.
7. Pass `initial`, `verify`, and custom codec functions through update options.
8. Return all failures as `{ success: false, error, backup? }`; do not leak synchronous exceptions through the promised API.
9. On success, report `result.backup ?? configPath + ".bak"` to retain historical client return values even when a new file did not require a physical backup.

### Stale-key cleanup

```ts
// src/tui/engine/remove-stale-mcp-ptb.ts
export function removeStaleMcpPtb<T extends Record<string, unknown>>(
  current: Readonly<T>,
): T;
```

The function removes own `MCP_PTB` entries from these three containers before any descriptor applies its target payload:

- `mcp.MCP_PTB`
- `mcpServers.MCP_PTB`
- `servers.MCP_PTB`

It preserves sibling keys and existing empty containers. It checks property ownership rather than truthiness, so malformed or falsy stale values are also removed. Codex overwrites its exact `mcp.servers.MCP_PTB` TOML section after this generic cleanup.

## Filesystem utility compatibility

S3a makes minimal backward-compatible extensions to the Slice 1 helpers rather than duplicating a transaction in TUI code.

### `backupFile`

The existing two-argument API remains valid. An optional third snapshot argument allows `patchJsonConfig` to back up bytes it already read:

```ts
export function backupFile(
  targetPath: string,
  backupSuffix?: string,
  snapshot?: string | NodeJS.ArrayBufferView,
): string;
```

When `snapshot` is present, `backupFile` writes it to the backup through `writeFileSync`; it does not perform another source read or require `copyFileSync`. Standalone calls without a snapshot retain byte-preserving copy behavior and all existing tests.

### `patchJsonConfig`

The existing JSON defaults and call sites remain valid. Options gain optional codec and missing-file initialization hooks:

```ts
export interface PatchOptions<T> {
  readonly backupSuffix?: string;
  readonly initial?: () => T;
  readonly deserialize?: (raw: string) => T;
  readonly serialize?: (value: Readonly<T>) => string;
  readonly verify?: (written: T, serialized: string) => boolean;
}

export type PatchJsonConfigResult =
  | { readonly success: true; readonly backup?: string }
  | { readonly success: false; readonly error: string; readonly backup?: string };
```

Defaults remain `JSON.parse` and two-space JSON serialization with the current trailing newline. If a file exists, the helper reads once and calls `backupFile(path, suffix, raw)` before commit. If it does not exist, it uses `initial()` or returns the existing missing-file failure.

Production keeps the current sibling-temp verification and `renameSync` commit. To tolerate the partial `node:fs` mock in `tests/tui/clients.test.ts`, filesystem capabilities are accessed through the module namespace and checked with `Reflect.has` before access. When `renameSync` is absent, the helper writes the already serialized and verified bytes to the target using `writeFileSync`; when `unlinkSync` is absent, mock-only cleanup is skipped. Normal Node always has both capabilities, so production remains atomic. This fallback must not run before parse, patch, serialization, and verification succeed.

This arrangement preserves the legacy mock sequence:

```text
read #1 original -> write backup -> write staged content
-> read #2 verification content -> atomic rename in production
                               \-> verified direct write in partial mock
```

No new `readFileSync` call may be added to client injection. The existing test factory mocks only `existsSync`, `readFileSync`, `writeFileSync`, and `mkdirSync`; S3 must not require test changes to add `copyFileSync`, `renameSync`, or `unlinkSync`.

## Descriptor families

### Family A: seven `mcpServers` clients

A focused `createMcpServersDescriptor` factory supplies the common pure patch and verification. Each client descriptor supplies only identity, path, and whether legacy missing-file creation is allowed.

| Client | Config path | `initial` |
|---|---|---|
| Cursor | `~/.cursor/mcp.json` | no |
| Gemini CLI | `~/.gemini/settings.json` | no |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` | `{}` |
| Kimi | `~/.kimi/mcp.json` | `{}` |
| Kiro IDE | `~/.kiro/settings/mcp.json` | `{}` |
| Qwen Code | `~/.qwen/settings.json` | `{}` |
| Antigravity | `~/.gemini/antigravity/mcp_config.json` | `{}` |

Their common postcondition is:

```ts
mcpServers.MCP_PTB = {
  command: "node",
  args: [scriptPath],
};
```

No `cwd` is added.

### Family B: two local command-array clients

A focused `createLocalMcpDescriptor` factory supplies:

```ts
mcp.MCP_PTB = {
  command: ["node", scriptPath],
  type: "local",
};
```

OpenCode resolves `~/.config/opencode/opencode.json` and requires an existing file. Kilocode resolves `~/.config/kilo/opencode.json` and retains its existing `{}` initialization behavior.

### Family C: three specialized clients

- **VS Code** uses its current platform-aware path resolver and writes `servers.MCP_PTB = { command: "node", args: [scriptPath], cwd: normalizedProjectPath }`.
- **Claude Code** resolves `~/.claude/mcp/MCP_PTB.json`, sets `ensureDir: true` and `initial: () => ({})`, then replaces the root with `{ command: "node", args: [scriptPath] }`.
- **Codex** resolves `~/.codex/config.toml`, uses `format: "custom"`, and supplies a dedicated codec from `src/tui/clients/codecs/codex-toml.ts`. Its patch replaces the exact `[mcp.servers.MCP_PTB]` section with `command = ["node", scriptPath]`; verification retains the specified non-empty-file predicate.

The Codex codec supports the existing bounded subset needed by this adapter: dotted section names, scalar strings, and string arrays. It preserves unrelated parsed sections semantically but does not promise comment or whitespace preservation and does not claim to be a general TOML library.

## Data flow

```text
client façade import
  -> descriptor
  -> injectClient(descriptor)                 [pure, no I/O]
  -> MCPClient

MCPClient.inject(projectPath)
  -> resolve config path once
  -> normalize projectPath and dist/index.js path
  -> ensure parent directory when declared
  -> patchJsonConfig
       -> read existing text or obtain descriptor.initial()
       -> deserialize (JSON default or Codex codec)
       -> remove three stale MCP_PTB locations          [pure]
       -> descriptor.patch(clean config, context)       [pure]
       -> serialize
       -> backup original when it existed
       -> write and re-read sibling staged content
       -> deserialize and descriptor.verify
       -> commit staged bytes
  -> map helper result to Promise<ClientInjectionResult>
```

Malformed input fails before backup or target write. Verification failure may return the backup path but leaves the production target unchanged. Descriptor patch failures and codec failures are caught and converted to the client error result.

## File change plan

| Logical slice | Path | Change |
|---|---|---|
| S3a | `src/tui/engine/mcp-client.ts` | Add canonical public client/result contracts. |
| S3a | `src/tui/engine/client-descriptor.ts` | Add descriptor union and patch context. |
| S3a | `src/tui/engine/remove-stale-mcp-ptb.ts` | Add pure cross-format stale-key cleanup. |
| S3a | `src/tui/engine/inject-client.ts` | Add pure factory and runtime orchestration. |
| S3a | `src/tui/clients/types.ts` | Convert to compatibility type façade. |
| S3a | `src/core/utils/fs/backup-file.ts` | Add optional already-read snapshot support. |
| S3a | `src/core/utils/fs/patch-json-config.ts` | Add codec/initial hooks and partial-mock-safe capability fallback. |
| S3a | `tests/tui/engine/{inject-client,remove-stale-mcp-ptb}.test.ts` | Cover engine contracts and pure cleanup. |
| S3a | `tests/core/utils/fs/{backup-file,patch-json-config}.test.ts` | Triangulate snapshot, custom codec, creation, and production atomic path. |
| S3b | `src/tui/clients/descriptors/create-mcp-servers-descriptor.ts` | Common standard JSON descriptor factory. |
| S3b | `src/tui/clients/descriptors/create-local-mcp-descriptor.ts` | Common local-array descriptor factory. |
| S3b | `src/tui/clients/descriptors/{cursor,gemini,windsurf,kimi,kiro,qwen,antigravity,opencode,kilocode}.ts` | One path/identity descriptor per standard client. |
| S3b | Matching nine `src/tui/clients/*.ts` files | Replace procedures with descriptor + `injectClient` façades. |
| S3b | `tests/tui/engine/descriptor-families.test.ts` | Table-test paths, payloads, verification, and missing-file policy. |
| S3c | `src/tui/clients/descriptors/{vscode,claude,codex}.ts` | Add specialized descriptors. |
| S3c | `src/tui/clients/codecs/codex-toml.ts` | Extract bounded Codex TOML codec. |
| S3c | `src/tui/clients/{vscode,claude,codex}.ts` | Replace procedures with thin façades. |
| S3c | `src/tui/clients/index.ts` | Preserve exact registry order; no behavior rewrite. |
| S3c | `tests/tui/engine/{specialized-descriptors,codex-toml}.test.ts` | Test platform paths, cwd, directory creation, root payload, and TOML round-trip. |

`src/tui/index.ts`, `configure.ts`, `detect.ts`, `install.ts`, dependencies, and interactive behavior remain untouched.

## Strict TDD matrix

| Unit | RED-first coverage | Required triangulation |
|---|---|---|
| Descriptor types/factory | Factory returns historical methods without construction-time I/O | Null path, default and custom detect, resolver called per method, exceptions become error results. |
| Stale cleanup | Remove one stale entry | Remove all three simultaneously, include falsy values, preserve sibling keys, prove input non-mutation. |
| JSON transaction | Existing JSON succeeds with backup | Missing without `initial`, creation with `initial`, empty existing file backup, malformed JSON no write, verify false no commit. |
| Partial mock compatibility | Exact four-export `node:fs` mock succeeds | Two-read sequence only; no access to absent copy/rename/unlink exports. |
| Standard family | One `mcpServers` client payload | Seven paths/names/ids, no `cwd`, normalized slash, mixed missing-file policies. |
| Local array family | OpenCode command array | Kilocode initialization, stale `mcpServers`/`servers` removal, read error becomes failure. |
| VS Code | Linux path and `servers` payload | Windows APPDATA fallback, macOS path, normalized `cwd`. |
| Claude | Dedicated root payload | Recursive parent creation, existing empty file backup, new file has no physical backup. |
| Codex | Inject exact dotted TOML section | Preserve unrelated parsed section, array quoting, empty output verification failure. |
| Registry/facades | Historical named exports resolve | Exact 12-client order and `getAvailableClients()` filtering. |

Per independently green review unit:

```text
RED:        npx vitest run <new focused test path>
GREEN:      npx vitest run <new focused test path>
COMPAT:     npx vitest run tests/tui/clients.test.ts
FS SAFETY:  npx vitest run tests/core/utils/fs/
FULL:       npm test
TYPE:       npm run build
```

The 29 historical client assertions and their mock setup are immutable acceptance inputs. New tests may be added, but existing assertions and mocked exports must not be changed.

## Review units and line budget

Changed-line forecasts count additions and deletions. The spec's logical S3b and S3c batches cannot credibly remain below 400 as single diffs because deleting the duplicated client bodies alone consumes much of the budget. They are therefore implemented through these smaller green review units:

| Order | Logical slice | Review unit | Forecast | Green boundary |
|---:|---|---|---:|---|
| 1 | **S3a** | Engine, contracts, cleanup, helper compatibility, focused tests | 300–380 | Engine tests, fs utility tests, legacy client suite, full suite, build. |
| 2 | **S3b.1** | Standard descriptors/facades: Cursor, Gemini, Windsurf, Kimi | 300–380 | Four migrated clients plus full suite and build. |
| 3 | **S3b.2** | Standard descriptors/facades: Kiro, Qwen, Antigravity | 220–320 | Remaining standard clients plus full suite and build. |
| 4 | **S3b.3** | Array descriptors/facades: OpenCode, Kilocode | 180–280 | Both local-array clients plus full suite and build. |
| 5 | **S3c.1** | Specialized JSON: VS Code and Claude | 240–340 | Platform/single-file tests plus full suite and build. |
| 6 | **S3c.2** | Codex codec/descriptor/facade and final registry verification | 280–380 | All 12 descriptor-driven, exact registry order, full suite, build. |

Before editing each unit, tasks must record an exact forecast from the then-current tree. If a forecast is `>=400` or uncertain, stop under `ask-on-risk` and split again. These review units do not choose whether delivery uses separate PRs or a chained PR stack.

## Compatibility and rollout

1. Land S3a additively; only the type façade and core helper extensions touch existing paths, and no client is migrated yet.
2. Migrate clients in S3b.1–S3b.3 while allowing the registry to contain mixed old/new implementations.
3. Migrate VS Code and Claude before Codex so the custom codec cannot obscure JSON-specialization regressions.
4. Migrate Codex last and then assert all twelve registry entries are engine-created in exact historical order.
5. Do not modify interactive TUI orchestration or add clients/dependencies.
6. Rollback is review-unit local: restore only the affected client façade bodies/descriptors; S3a may remain because it is additive and backward compatible.
7. No user configuration migration is required. Existing `.bak` files are neither deleted nor restored automatically.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Engine placed in core | Reverses dependency ownership and couples core to TUI API | Keep engine and canonical `MCPClient` in `src/tui/engine/`; core exposes only generic fs primitives. |
| Partial Vitest fs mock lacks copy/rename/unlink | Migrated client tests fail despite correct production behavior | Reuse the first-read snapshot for backup and capability-check optional fs methods without accessing absent exports. |
| Extra verification read consumes mock data | Legacy tests return `undefined` or malformed data | Verify the staged write with exactly the existing second read; do not add a post-commit third read. |
| Stale entries survive because their values are falsy | Multiple conflicting client definitions remain | Remove own properties by key presence, not truthiness, before every descriptor patch. |
| Descriptor mutates parsed config | Shared fixtures or sibling data change unexpectedly | Pure cleanup plus return-new-root patch policy; test input identity and sibling preservation. |
| Missing-file behavior is accidentally homogenized | Some clients stop creating files or begin creating unsupported files | Encode the current per-client policy explicitly through `initial`. |
| Empty existing files are not backed up | Safety requirement is violated | Branch on file existence, not raw-text truthiness. |
| Codex codec claims full TOML support | Valid unsupported TOML may be rewritten incorrectly | Name and test it as a bounded Codex codec; preserve current no-dependency scope and document supported values. |
| Backup result points to a non-created file for new configs | Return metadata can be misunderstood | Preserve this historical API behavior deliberately while tests separately assert physical backup only for existing files. |
| Logical S3b/S3c exceed 400 changed lines | Review gate violation | Use S3b.1–S3b.3 and S3c.1–S3c.2; forecast additions plus deletions before each edit. |

## SDD result

- **status**: `designed_with_delivery_gate`
- **executive_summary**: Place a pure descriptor-to-`MCPClient` factory in `src/tui/engine/`, compose it over safe core backup/patch utilities, model JSON and bounded TOML codecs explicitly, purge stale keys immutably, preserve all historical façades, and migrate the three client families through six independently green sub-400 review units.
- **artifacts**:
  - `openspec/changes/micro-modular-alignment/proposal.md`
  - `openspec/changes/micro-modular-alignment/specs/slice-3-tui/spec.md`
  - `openspec/changes/micro-modular-alignment/specs/slice-3-tui/design.md`
- **next_recommended**: `tasks` — create RED-first tasks in order S3a, S3b.1, S3b.2, S3b.3, S3c.1, S3c.2; record an exact additions-plus-deletions forecast before each; and pause for the `ask-on-risk` PR/chain packaging decision before delivery.
- **risks**: Partial `node:fs` mock incompatibility, verification-read drift, stale falsy entries, per-client missing-file behavior drift, bounded Codex TOML limitations, misleading backup metadata for newly created files, and review-unit forecasts approaching 400 changed lines.
- **skill_resolution**: `fallback-path`
