# Design: Slice 5 Catalogs and Server Handlers

## Status

- **status**: `designed_with_delivery_gate`
- **change**: `micro-modular-alignment`
- **scope**: `slice-5-catalogs-server only; final change slice`
- **execution**: `auto`
- **artifact_store**: `openspec`
- **strict_tdd**: `true`
- **review_budget**: `<400 changed lines per review unit`
- **baseline**: `434 existing tests across 43 files`
- **requirements**: `8`
- **scenarios**: `42`
- **skill_resolution**: `fallback-path` (`gentle-ai` and `gentle-ai-cognitive-doc-design`; no phase-specific design skill path was injected)

## Executive summary

Slice 5 completes `micro-modular-alignment` by separating the four static Packet Tracer datasets from 16 atomic query modules, retaining historical catalog paths as re-export façades, extracting four MCP resource readers plus their formatter/registrar, extracting tool schema/format/dispatch/registration units, and reducing `src/server.ts` to a dependency-wiring root below 60 physical lines.

All catalog lookups remain case-sensitive and preserve current insertion order, aliases, values, resource JSON, tool names, schemas, success envelopes, error envelopes, bridge port `54321`, and startup diagnostics. Canonical implementation code imports leaf data/query/handler modules; compatibility files do not become dependencies of the new implementation.

S5a, S5b, S5c, and S5d are ordered, independently green review units, each planned below 400 changed lines. Dataset extraction must use rename-aware moves before trimming the source into façades so review tools recognize moved lines. An exact additions-plus-deletions forecast remains mandatory immediately before each unit. Aggregate S5 is over 400 lines, so `ask-on-risk` must resolve delivery packaging before implementation; this design selects neither chaining nor `size:exception`.

After S5d passes focused tests, all 434 pre-existing tests, the complete augmented suite, and `npm run build`, the accepted Slice 5 specification is synchronized to canonical OpenSpec and the completed `micro-modular-alignment` change is archived. No Slice 6 is created.

## Architecture decisions

| Topic | Decision |
|---|---|
| Data boundary | `src/catalogs/data/*.ts` exports only static records and pre-indexed maps; it contains no exported query behavior. |
| Initialization | Every catalog is created during module initialization with `const`; no module-scoped `let` or post-initialization internal mutator is introduced. Public `Map` types remain unchanged for compatibility. |
| Query granularity | Exactly 16 query functions live one per file in `src/catalogs/queries/`; each imports only the minimum data/type dependency. |
| Query purity | Queries perform no I/O and no internal mutation. List/filter queries return new arrays; `getInterfaces` preserves the existing stored-array result for known models and returns a new empty array for unknown models. |
| Ordering | Record and `Map` insertion order remains byte-observable through list queries and JSON resources and therefore must not be sorted or deduplicated during extraction. |
| Link aliases | `linkTypeCatalog` remains indexed by canonical and alias keys. Resource serialization retains the current alias-indexed duplicate values; only `listLinkTypes` deduplicates canonical names. |
| Historical imports | `devices.ts`, `modules.ts`, `links.ts`, and `interfaces.ts` become selective re-export façades; `catalogs/index.ts` re-exports those four façades. |
| Resource response type | Resource formatter/readers return the SDK-native `ReadResourceResult`; all JSON uses `JSON.stringify(data, null, 2)`. |
| Resource registration | The legacy `McpServer.resource(name, uri, callback)` overload is retained, with the descriptive catalog label as `name` and the exact `pt://catalog/*` string as `uri`. |
| Tool response type | Tool formatters and generated callbacks return SDK-native `CallToolResult`; no project-local approximation of MCP content types is added. |
| Schema extraction | `Tool.inputSchema` remains unchanged as `unknown`; the extractor performs the single localized cast to `z.ZodObject<z.ZodRawShape>` and returns `.shape`. |
| Tool defaults | `registerTools` defaults its optional array to `allTools`, but accepts an explicit `Tool[]` for isolated tests and alternate composition. |
| Script envelope | Preserve the existing truthy-code branch: script mode with non-empty `code` emits `{ mode, script }`; all other successful results emit `{ mode, data }`. |
| Error boundary | `createToolHandler` catches every thrown value and converts it once through `formatToolError`; registration and schema failures are not mislabeled as execution failures. |
| Bridge injection | `createMcpServer(bridgeOverride?)` uses `bridgeOverride ?? createBridge(54321)`; supplying an override must not construct or start the default bridge. |
| Composition root | `server.ts` owns only server/bridge/transport construction, registrar calls, startup diagnostics, connection, and its two public exports. |
| Imports | All new source imports use NodeNext `.js` specifiers and canonical `src/core/types/catalog.ts` / `src/core/types/tools.ts` types where available. |

## Dependency direction

```text
src/index.ts
  -> src/server.ts
       -> src/bridge/index.ts
       -> src/server/handlers/resources/register-resources.ts
       -> src/server/handlers/tools/register-tools.ts
       -> @modelcontextprotocol/sdk transports

src/server/handlers/resources/*
  -> src/catalogs/data/*
  -> format-resource.ts
  -> @modelcontextprotocol/sdk/types.js (types only)

src/server/handlers/tools/*
  -> src/tools/index.ts
  -> src/bridge/adapter.ts (type only)
  -> src/core/types/tools.ts (type only)
  -> @modelcontextprotocol/sdk/types.js (types only)
  -> zod

src/catalogs/{devices,modules,links,interfaces}.ts
  -> src/catalogs/data/*
  -> src/catalogs/queries/*

src/catalogs/queries/*
  -> src/catalogs/data/*
  -> src/core/types/catalog.ts (only where needed)
```

No canonical data, query, or handler imports a historical catalog façade or `src/server.ts`. `src/bridge/script-builder.ts` may continue importing `getLinkTypeId` through `src/catalogs/links.ts`; that path is a deliberate compatibility consumer, not the direction for new code.

## Exact TypeScript contracts

### S5a — Device and module data

```ts
// src/catalogs/data/device-data.ts
import type {
  DeviceCategory,
  DeviceEntry,
} from "../../core/types/catalog.js";

export const DEVICE_TYPE_MAP: Record<string, number>;
export const DEVICE_CATEGORIES: Record<number, DeviceCategory>;
export const CATEGORY_NAMES: Record<number, DeviceCategory>;
export const deviceCatalog: Map<string, DeviceEntry>;
```

`DEVICE_TYPE_MAP` preserves every current model/value pair and record order. `DEVICE_CATEGORIES` preserves the historic exported numeric mapping. `CATEGORY_NAMES` contains the same numeric category mapping used to materialize every `DeviceEntry`; unknown type IDs still materialize as category `"other"`. `deviceCatalog` is constructed completely from `DEVICE_TYPE_MAP` in one initialization expression and contains the unchanged dataset.

```ts
// src/catalogs/queries/get-device-type.ts
export function getDeviceType(model: string): number | undefined;

// src/catalogs/queries/get-device-category.ts
import type { DeviceCategory } from "../../core/types/catalog.js";
export function getDeviceCategory(
  model: string,
): DeviceCategory | undefined;

// src/catalogs/queries/get-devices-by-category.ts
import type { DeviceCategory } from "../../core/types/catalog.js";
export function getDevicesByCategory(
  category: number | DeviceCategory,
): string[];

// src/catalogs/queries/is-device-model.ts
export function isDeviceModel(model: string): boolean;

// src/catalogs/queries/list-device-models.ts
export function listDeviceModels(): string[];
```

Device queries preserve exact-string lookup. Numeric category lookup first resolves `DEVICE_CATEGORIES[category] ?? "other"`, preserving the existing behavior in which an unknown numeric ID selects models categorized as `"other"`. String category lookup compares the stored category directly. Filter/list results retain `deviceCatalog` insertion order and are new arrays.

```ts
// src/catalogs/data/module-data.ts
import type { ModuleEntry } from "../../core/types/catalog.js";

export const MODULE_MAP: Record<string, number>;
export const moduleCatalog: Map<string, ModuleEntry>;
```

```ts
// src/catalogs/queries/get-module-type.ts
export function getModuleType(model: string): number | undefined;

// src/catalogs/queries/is-module-model.ts
export function isModuleModel(model: string): boolean;

// src/catalogs/queries/list-module-models.ts
export function listModuleModels(): string[];

// src/catalogs/queries/get-modules-by-type.ts
export function getModulesByType(typeId: number): string[];
```

Module queries preserve exact-string lookup and numeric equality. Filter/list results are new arrays in `moduleCatalog` insertion order.

### S5b — Link and interface data

```ts
// src/catalogs/data/link-data.ts
import type { LinkTypeEntry } from "../../core/types/catalog.js";

export const LINK_MAP: Record<string, number>;
export const LINK_TYPE_ALIASES: Record<string, string>;
export const linkTypeCatalog: Map<string, LinkTypeEntry>;
```

The data initializer preserves IDs `8100` through `8114`, bidirectional straight/cross aliases, canonical names `straight` and `cross`, alias indexing, entry arrays, and current map order. The unused transient `byId` accumulator from the old module is not retained because it contributes no exported state or result.

```ts
// src/catalogs/queries/get-link-type-id.ts
export function getLinkTypeId(name: string): number | undefined;

// src/catalogs/queries/is-link-type.ts
export function isLinkType(name: string): boolean;

// src/catalogs/queries/list-link-types.ts
export function listLinkTypes(): string[];

// src/catalogs/queries/resolve-link-type.ts
export function resolveLinkType(name: string): string | undefined;
```

`getLinkTypeId` and `isLinkType` query alias-indexed keys. `resolveLinkType` returns each entry's canonical `name`, including `"straight"` for both straight spellings and `"cross"` for both cross spellings. `listLinkTypes` returns first-seen unique canonical names without empty values.

```ts
// src/catalogs/data/interface-data.ts
export const modelInterfaces: Map<string, string[]>;
```

The map is initialized as one static `new Map([...])` dataset rather than repeated top-level `.set()` calls. Model order and each interface array's order remain unchanged.

```ts
// src/catalogs/queries/get-interfaces.ts
export function getInterfaces(model: string): string[];

// src/catalogs/queries/has-interfaces.ts
export function hasInterfaces(model: string): boolean;

// src/catalogs/queries/list-models-with-interfaces.ts
export function listModelsWithInterfaces(): string[];
```

`getInterfaces` remains `modelInterfaces.get(model) ?? []`: known models receive the stored ordered list and unknown models receive a non-throwing empty array. `listModelsWithInterfaces` returns a new key array in map order.

### Catalog query barrel and compatibility façades

```ts
// src/catalogs/queries/index.ts
export { getDeviceType } from "./get-device-type.js";
export { getDeviceCategory } from "./get-device-category.js";
export { getDevicesByCategory } from "./get-devices-by-category.js";
export { isDeviceModel } from "./is-device-model.js";
export { listDeviceModels } from "./list-device-models.js";
export { getModuleType } from "./get-module-type.js";
export { isModuleModel } from "./is-module-model.js";
export { listModuleModels } from "./list-module-models.js";
export { getModulesByType } from "./get-modules-by-type.js";
export { getLinkTypeId } from "./get-link-type-id.js";
export { isLinkType } from "./is-link-type.js";
export { listLinkTypes } from "./list-link-types.js";
export { resolveLinkType } from "./resolve-link-type.js";
export { getInterfaces } from "./get-interfaces.js";
export { hasInterfaces } from "./has-interfaces.js";
export { listModelsWithInterfaces } from "./list-models-with-interfaces.js";
```

```ts
// src/catalogs/devices.ts
export {
  DEVICE_CATEGORIES,
  deviceCatalog,
} from "./data/device-data.js";
export { getDeviceType } from "./queries/get-device-type.js";
export { getDeviceCategory } from "./queries/get-device-category.js";
export { getDevicesByCategory } from "./queries/get-devices-by-category.js";
export { isDeviceModel } from "./queries/is-device-model.js";
export { listDeviceModels } from "./queries/list-device-models.js";

// src/catalogs/modules.ts
export { moduleCatalog } from "./data/module-data.js";
export { getModuleType } from "./queries/get-module-type.js";
export { isModuleModel } from "./queries/is-module-model.js";
export { listModuleModels } from "./queries/list-module-models.js";
export { getModulesByType } from "./queries/get-modules-by-type.js";

// src/catalogs/links.ts
export {
  LINK_TYPE_ALIASES,
  linkTypeCatalog,
} from "./data/link-data.js";
export { getLinkTypeId } from "./queries/get-link-type-id.js";
export { isLinkType } from "./queries/is-link-type.js";
export { listLinkTypes } from "./queries/list-link-types.js";
export { resolveLinkType } from "./queries/resolve-link-type.js";

// src/catalogs/interfaces.ts
export { modelInterfaces } from "./data/interface-data.js";
export { getInterfaces } from "./queries/get-interfaces.js";
export { hasInterfaces } from "./queries/has-interfaces.js";
export {
  listModelsWithInterfaces,
} from "./queries/list-models-with-interfaces.js";
```

```ts
// src/catalogs/index.ts
export * from "./devices.js";
export * from "./modules.js";
export * from "./links.js";
export * from "./interfaces.js";
```

Raw implementation records (`DEVICE_TYPE_MAP`, `CATEGORY_NAMES`, `MODULE_MAP`, and `LINK_MAP`) are canonical data-path exports, not additions to historical façades. This keeps the prior façade surface precise while allowing direct data tests.

### S5c — Resource formatting, readers, and registration

```ts
// src/server/handlers/resources/format-resource.ts
import type { ReadResourceResult } from
  "@modelcontextprotocol/sdk/types.js";

export function formatJsonResource(
  uri: string,
  data: unknown,
): ReadResourceResult;
```

The implementation returns exactly:

```ts
{
  contents: [{
    uri,
    mimeType: "application/json",
    text: JSON.stringify(data, null, 2),
  }],
}
```

```ts
// src/server/handlers/resources/devices-resource.ts
import type { ReadResourceResult } from
  "@modelcontextprotocol/sdk/types.js";

export const DEVICES_RESOURCE_URI = "pt://catalog/devices";
export const DEVICES_RESOURCE_NAME = "Device catalog from PTBuilder";
export function readDevicesResource(): Promise<ReadResourceResult>;

// src/server/handlers/resources/modules-resource.ts
export const MODULES_RESOURCE_URI = "pt://catalog/modules";
export const MODULES_RESOURCE_NAME = "Module catalog from PTBuilder";
export function readModulesResource(): Promise<ReadResourceResult>;

// src/server/handlers/resources/links-resource.ts
export const LINKS_RESOURCE_URI = "pt://catalog/links";
export const LINKS_RESOURCE_NAME = "Link types catalog from PTBuilder";
export function readLinksResource(): Promise<ReadResourceResult>;

// src/server/handlers/resources/interfaces-resource.ts
export const INTERFACES_RESOURCE_URI = "pt://catalog/interfaces";
export const INTERFACES_RESOURCE_NAME = "Interface map from PTBuilder";
export function readInterfacesResource(): Promise<ReadResourceResult>;
```

Each reader snapshots its catalog into the current resource payload and delegates only envelope serialization to `formatJsonResource`:

- devices: ordered array of `{ model, typeId, category }`;
- modules: ordered array of `{ model, typeId }`;
- links: ordered array of every `linkTypeCatalog.values()` entry, including alias-indexed duplicates;
- interfaces: insertion-ordered `Record<string, string[]>` produced from `modelInterfaces`.

```ts
// src/server/handlers/resources/register-resources.ts
import { McpServer } from
  "@modelcontextprotocol/sdk/server/mcp.js";

export function registerCatalogResources(server: McpServer): void;
```

Registration calls `server.resource(NAME, URI, readHandler)` exactly four times in devices, modules, links, interfaces order. Readers ignore SDK callback arguments, so they remain directly callable zero-argument units while satisfying the callback contract structurally.

### S5d — Tool handlers and server composition

```ts
// src/server/handlers/tools/extract-input-schema.ts
import { z } from "zod";
import type { Tool } from "../../../tools/index.js";

export function extractInputSchema(tool: Tool): z.ZodRawShape;
```

Only this module casts `tool.inputSchema` to `z.ZodObject<z.ZodRawShape>` and reads `.shape`. Tool definitions and their Zod objects are not cloned or rewritten.

```ts
// src/server/handlers/tools/format-tool-result.ts
import type { CallToolResult } from
  "@modelcontextprotocol/sdk/types.js";
import type { ToolResult } from "../../../core/types/tools.js";

export function formatToolResult(result: ToolResult): CallToolResult;

// src/server/handlers/tools/format-tool-error.ts
import type { CallToolResult } from
  "@modelcontextprotocol/sdk/types.js";

export function formatToolError(error: unknown): CallToolResult;
```

`formatToolResult` emits one text block. For `result.mode === "script" && result.code`, text is `JSON.stringify({ mode: result.mode, script: result.code })`; otherwise it is `JSON.stringify({ mode: result.mode, data: result.data })`. It never sets `isError: true`.

`formatToolError` derives `message` with `error instanceof Error ? error.message : String(error)` and returns one text block containing `JSON.stringify({ error: message })` plus `isError: true`.

```ts
// src/server/handlers/tools/create-tool-handler.ts
import type { CallToolResult } from
  "@modelcontextprotocol/sdk/types.js";
import type { BridgeAdapter } from "../../../bridge/adapter.js";
import type { Tool } from "../../../tools/index.js";

export type McpToolHandler = (
  args: Record<string, unknown>,
) => Promise<CallToolResult>;

export function createToolHandler(
  tool: Tool,
  bridge: BridgeAdapter,
): McpToolHandler;
```

The generated callback executes `tool.execute(bridge, args)` once. Fulfillment delegates to `formatToolResult`; rejection or a synchronous throw delegates to `formatToolError` and never escapes.

```ts
// src/server/handlers/tools/register-tools.ts
import { McpServer } from
  "@modelcontextprotocol/sdk/server/mcp.js";
import type { BridgeAdapter } from "../../../bridge/adapter.js";
import type { Tool } from "../../../tools/index.js";

export function registerTools(
  server: McpServer,
  bridge: BridgeAdapter,
  tools?: Tool[],
): void;
```

The implementation default is `tools = allTools`. For each entry, it calls:

```ts
server.tool(
  tool.name,
  tool.description,
  extractInputSchema(tool),
  createToolHandler(tool, bridge),
);
```

Registration preserves supplied order and registers duplicates exactly as supplied; deduplication or tool lookup belongs outside this unit.

```ts
// src/server.ts
import { McpServer } from
  "@modelcontextprotocol/sdk/server/mcp.js";
import type { BridgeAdapter } from "./bridge/adapter.js";

export function createMcpServer(
  bridgeOverride?: BridgeAdapter,
): McpServer;

export function startServer(): Promise<void>;
```

`createMcpServer` performs this exact sequence:

1. Resolve `const bridge = bridgeOverride ?? createBridge(54321)`.
2. Construct `new McpServer({ name: "MCP-PTB", version: "0.1.0" })`.
3. Call `registerCatalogResources(server)`.
4. Call `registerTools(server, bridge, allTools)`.
5. Return the same server instance.

`startServer` constructs through `createMcpServer()`, constructs `StdioServerTransport`, emits the existing two pre-connect `console.error` diagnostics, awaits `server.connect(transport)`, and then emits the existing started diagnostic. It does not catch errors; `src/index.ts` remains the process-level catch boundary. `src/server.ts` must contain fewer than 60 physical lines and no catalog imports, Zod import, JSON formatting, handler closures, or registration loop.

## Runtime data flow

### Catalog query flow

```text
historical or canonical caller
  -> one query leaf
       -> one static data map/record
       -> scalar lookup OR newly allocated ordered result array

historical caller
  -> catalogs/{devices,modules,links,interfaces}.ts façade
       -> same query leaf/data export identity
```

### Resource flow

```text
MCP read request
  -> registerCatalogResources callback
       -> one catalog reader
            -> canonical data Map values/entries
            -> resource-specific DTO snapshot
            -> formatJsonResource(uri, dto)
                 -> one pretty JSON content item
```

### Tool flow

```text
MCP tool call
  -> registered callback from createToolHandler
       -> tool.execute(injected bridge, validated args)
            success -> formatToolResult -> CallToolResult
            throw   -> formatToolError  -> CallToolResult(isError=true)
```

### Startup flow

```text
src/index.ts
  -> startServer
       -> createMcpServer
            -> injected bridge OR createBridge(54321)
            -> McpServer
            -> four resources
            -> nine tools
       -> StdioServerTransport
       -> diagnostics
       -> await server.connect
```

## State and compatibility invariants

| Invariant | Enforcement |
|---|---|
| No mutable process-wide query state | Query leaves have no local persistent state; data is initialized once with `const`. |
| Dataset identity | Characterization compares complete ordered entries before and after extraction, not only sample models. |
| Exact lookup behavior | No normalization, trimming, case folding, coercion, sorting, or fallback beyond existing behavior. |
| Fresh aggregate arrays | Device/module/link list and filter queries allocate on every call. |
| Known interface result | `getInterfaces` preserves the current known-model array and non-throwing unknown `[]` behavior. |
| Resource bytes | URI, MIME type, two-space indentation, DTO field order, map order, and link duplicates remain unchanged. |
| Tool bytes | Success/error JSON remains compact because no indentation argument is passed. |
| Error containment | Only tool execution errors become MCP tool errors; `startServer` connection failures still reach `src/index.ts`. |
| Default bridge | Exactly one `createBridge(54321)` call occurs only when no override is supplied. |
| Public imports | Every symbol listed by the specification remains available from its historical module and aggregate barrel. |
| Server exports | `createMcpServer` and `startServer` remain named exports from `src/server.ts`. |

## File change plan

| Unit | Path | Change |
|---|---|---|
| S5a | `src/catalogs/data/device-data.ts` | Rename/extract unchanged device records and pre-indexed map. |
| S5a | `src/catalogs/data/module-data.ts` | Rename/extract unchanged module records and pre-indexed map. |
| S5a | `src/catalogs/queries/{get-device-type,get-device-category,get-devices-by-category,is-device-model,list-device-models}.ts` | Add five atomic device queries. |
| S5a | `src/catalogs/queries/{get-module-type,is-module-model,list-module-models,get-modules-by-type}.ts` | Add four atomic module queries. |
| S5a | `src/catalogs/queries/index.ts` | Add the complete query re-export façade; S5b appends its seven exports. |
| S5a | `src/catalogs/{devices,modules}.ts` | Replace implementations with compatibility re-exports. |
| S5a | `tests/catalogs/{device-queries,module-queries,facades}.test.ts` | RED-first complete data, query, and old/canonical identity coverage. |
| S5b | `src/catalogs/data/{link-data,interface-data}.ts` | Rename/extract unchanged link/interface datasets. |
| S5b | `src/catalogs/queries/{get-link-type-id,is-link-type,list-link-types,resolve-link-type}.ts` | Add four atomic link queries. |
| S5b | `src/catalogs/queries/{get-interfaces,has-interfaces,list-models-with-interfaces}.ts` | Add three atomic interface queries. |
| S5b | `src/catalogs/{links,interfaces,index}.ts` | Replace implementations/update barrel with compatibility re-exports. |
| S5b | `tests/catalogs/{link-queries,interface-queries,facades}.test.ts` | RED-first aliases, ordering, unknowns, arrays, and façade coverage. |
| S5c | `src/server/handlers/resources/format-resource.ts` | Add pure MCP JSON envelope formatter. |
| S5c | `src/server/handlers/resources/{devices,modules,links,interfaces}-resource.ts` | Add four catalog snapshot readers. |
| S5c | `src/server/handlers/resources/register-resources.ts` | Add four-resource registrar. |
| S5c | `src/server.ts` | Replace only inline resource blocks with registrar call; leave tool loop until S5d. |
| S5c | `tests/server/resources/{format,devices,modules,links,interfaces,register}.test.ts` | RED-first formatter, payload, order, and registration tests. |
| S5d | `src/server/handlers/tools/{extract-input-schema,format-tool-result,format-tool-error,create-tool-handler,register-tools}.ts` | Add five focused tool-handler units. |
| S5d | `src/server.ts` | Remove inline schema/tool logic and finish the <60-line composition root with bridge override. |
| S5d | `tests/server/tools/{extract-input-schema,format-tool-result,format-tool-error,create-tool-handler,register-tools}.test.ts` | RED-first unit tests. |
| S5d | `tests/server/server-composition.test.ts` | Verify registrar order, default/override bridge behavior, metadata, transport, logs, and connection. |

No data barrel is added: resource/query modules import exact data leaves. No generic `server/handlers/index.ts` is added: `server.ts` imports the two registrar leaves directly.

## Strict TDD and scenario traceability

The 8 requirements and all 42 normative scenarios receive explicit test names matching the specification language. Existing tests remain unchanged; new tests characterize canonical leaves and wiring that the current suite does not reach.

| Requirement | RED-first focus | Triangulation and regression |
|---|---|---|
| R1 Device data/queries | Complete ordered `DEVICE_TYPE_MAP` to `deviceCatalog` parity; valid/invalid type and category lookups. | Numeric/string filters, unknown numeric fallback to `other`, existence, fresh full lists, façade identity. |
| R2 Module data/queries | Complete ordered `MODULE_MAP` parity; valid/invalid type lookup. | Existence, fresh full lists, type filters, façade identity. |
| R3 Link data/queries | Every name/ID and bidirectional alias; canonical resolution. | Unique ordered canonical list, unknowns, alias-indexed map shape, façade identity. |
| R4 Interface data/queries | Full ordered model/interface fixture parity; router/switch/end-device examples. | Unknown `[]`, presence checks, model enumeration, sorted existing arrays, façade identity. |
| R5 Catalog façades | Every historical named import resolves to the canonical value/function identity. | `catalogs/index.ts` exports all historical symbols; unchanged bridge script-builder behavior. |
| R6 Resources | Exact formatter envelope and parseable pretty JSON. | Full payload parity for four catalogs, URI/MIME/order/duplicates, exactly four registrar calls. |
| R7 Tool handlers | Zod shape identity, live/data result, script result, Error and non-Error formatting. | Success once, sync/async failures contained, explicit/default tool registration, all nine tools/order/schemas. |
| R8 Server root | Override avoids default bridge; default uses port 54321; metadata and both registrars execute once. | Four resources/nine tools through MCP transport, stdio connect/log order, <60-line structural check, old integration suite. |

Each review unit records evidence in this order:

```text
RED:       npx vitest run <new focused test files>
GREEN:     npx vitest run <new focused test files>
COMPAT:    npx vitest run tests/catalogs/catalogs.test.ts \
                               tests/catalogs/interfaces.test.ts \
                               tests/server/server.integration.test.ts
FULL:      npm test
TYPE:      npm run build
BUDGET:    additions + deletions for the review unit are <400
```

Tests use injected bridges and method spies. They do not open the default HTTP bridge except where an MCP transport-level composition assertion requires it; that assertion supplies `bridgeOverride`. `startServer` tests mock `createMcpServer`/transport or isolate transport construction so they never take ownership of process stdio.

## Ordered review units and budget

The implementation order is mandatory: **S5a → S5b → S5c → S5d**. Targets count additions plus deletions, including tests and façades; they are not permission to rely on net-line counts.

| Order | Review unit | Planned content | Target |
|---:|---|---|---:|
| 1 | **S5a devices + modules** | Two rename-aware data moves, 9 queries, query barrel start, 2 façades, focused tests. | 260–370 |
| 2 | **S5b links + interfaces** | Two rename-aware data moves, 7 queries, barrel completion, 3 façades, focused tests. | 270–385 |
| 3 | **S5c resources** | Formatter, 4 readers, registrar, server resource cutover, focused tests. | 250–370 |
| 4 | **S5d tools + root** | 5 tool units, injected composition root <60L, focused/composition tests. | 270–390 |

For S5a and S5b, move each historical implementation to its data path before deleting query code and recreating the historical façade. The forecast and final measurement must use the repository's review/GitHub rename detection; if a move is not recognized, its additions and deletions count in full. If any unit forecast is `>=400`, is uncertain, or loses rename detection, stop under `ask-on-risk` and split that logical unit at a green boundary. No chain strategy and no `size:exception` are inferred.

## Rollout, verification, and archive

1. **S5a** lands device/module data and queries while every old device/module import still resolves.
2. **S5b** completes all 16 queries and four catalog façades; `src/bridge/script-builder.ts` remains unchanged and passes through the link façade.
3. **S5c** cuts resource serialization/registration out of `server.ts`; tool registration remains temporarily inline and green.
4. **S5d** cuts tool handling out, adds bridge injection, and reduces `server.ts` below 60 physical lines.
5. Every boundary runs focused tests, unchanged catalog/server tests, all 434 pre-existing tests, the augmented full suite, build, and changed-line measurement.
6. Final verification audits all 8 requirements, all 42 scenarios, the 16 one-function query files, absence of query functions in data modules, exact historical exports, four resources, nine tools, and server line count.
7. Once verification is green, synchronize the accepted Slice 5 specification to `openspec/specs/slice-5-catalogs-server/spec.md` according to the repository's OpenSpec workflow.
8. Archive `micro-modular-alignment` immediately after canonical sync and verification. The archive record must include S5 evidence and confirm that S1–S5 are complete; no follow-up slice remains inside this change.
9. Rollback is unit-local: restore the previous façade target/server block for the failing unit and do not archive until all gates are green. No data migration or persistent-state rollback is required.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Rename detection fails for large datasets | S5a/S5b exceed 400 changed lines despite a small conceptual move. | Move first, forecast with rename-aware diff, stop and split under `ask-on-risk` if uncertain. |
| `Map` extraction reorders entries | Lists and resource JSON drift while sample lookups remain green. | Compare complete ordered entry arrays before/after and never sort during extraction. |
| Link resource is accidentally deduplicated | Payload no longer matches current alias-indexed `Map.values()`. | Deduplicate only in `listLinkTypes`; assert resource length/order and duplicate canonical entries. |
| Resource registration arguments are reversed | Catalog resources register descriptive text as URI. | Test `server.resource(NAME, URI, handler)` call positions and transport-read exact URIs. |
| MCP SDK types drift from local object literals | Build fails or handlers silently widen content types. | Return `ReadResourceResult`/`CallToolResult` and run `npm run build` in every unit. |
| Zod schema cast spreads across registration | Tool typing becomes coupled and hard to revise. | Localize the only cast in `extract-input-schema.ts`; assert returned shape identity. |
| Script formatting changes for absent/empty code | Existing JSON envelope changes in an edge case. | Preserve the current `mode === "script" && code` branch and characterize empty/missing code. |
| Injected server still creates default bridge | Tests open a real listener and dependency injection is false. | Spy on `createBridge`; assert zero calls with override and one `54321` call without it. |
| `startServer` test captures real stdio | Tests hang or interfere with Vitest. | Mock the transport/connect boundary and verify construction/log/call order without connecting process stdio. |
| Aggregate S5 is treated as one review | Review policy is violated even if each logical area is sound. | Preserve four green units and resolve packaging through the existing `ask-on-risk` gate before code work. |
| Archive happens before canonical sync | Accepted Slice 5 behavior is lost from active specs. | Verify, sync canonical spec, record evidence, then archive in that order. |

## SDD result

- **status**: `designed_with_delivery_gate`
- **executive_summary**: Separate four immutable-initialization catalog datasets from 16 atomic queries, preserve catalog façades, extract typed MCP resource/tool handlers, inject the bridge into `createMcpServer`, and leave `server.ts` below 60 lines while preserving all protocol behavior.
- **artifacts**:
  - `openspec/changes/micro-modular-alignment/proposal.md`
  - `openspec/changes/micro-modular-alignment/specs/slice-5-catalogs-server/spec.md`
  - `openspec/changes/micro-modular-alignment/specs/slice-5-catalogs-server/design.md`
  - `openspec/changes/micro-modular-alignment/design.md`
- **next_recommended**: `tasks` — produce RED-first tasks in strict S5a → S5b → S5c → S5d order, capture an exact additions-plus-deletions forecast before each unit, resolve aggregate delivery packaging through `ask-on-risk`, and end S5 with full verification, canonical spec sync, and archive.
- **risks**: Rename-detection line inflation, insertion-order drift, accidental link deduplication, reversed resource registration arguments, SDK/Zod typing drift, real bridge/stdio side effects in tests, aggregate review size, and premature archive.
- **skill_resolution**: `fallback-path`
