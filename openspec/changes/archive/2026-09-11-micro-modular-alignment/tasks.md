# Tasks: Slice 5 Catalogs Decomposition & MCP Server Handlers

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,050–1,515 lines (additions + deletions across S5a, S5b, S5c, and S5d) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (S5a: Devices & Modules) → PR 2 (S5b: Links & Interfaces) → PR 3 (S5c: MCP Resources) → PR 4 (S5d: MCP Tools & Server Root) |
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

- **Delivery Strategy:** `ask-on-risk`. The aggregate changed lines across all of Slice 5 exceed the 400-line review budget due to extracting four static datasets (153+ devices, 100+ modules, 15+ links, 25+ interfaces), 16 atomic query modules, resource serializers, tool execution wrappers, and comprehensive test suites.
- **Autonomous Sub-Slice Units:** Slice 5 is partitioned into four strictly ordered, independently reviewable, independently green sub-slices:
  1. **S5a: Devices & Modules Data, Queries & Compatibility Façades** (~260–370 lines)
  2. **S5b: Links & Interfaces Data, Queries & Aggregator Barrel** (~270–385 lines)
  3. **S5c: Dedicated MCP Resource Handlers & JSON Serialization** (~250–370 lines)
  4. **S5d: MCP Tool Handlers & Server Composition Root (<60L)** (~270–390 lines)
- **400-Line Budget Rule:** Each sub-slice MUST forecast exact additions plus deletions immediately prior to editing. For S5a and S5b, rename-aware moves (`git mv`) must be used prior to trimming to keep line churn within review budget limits.
- **Strict TDD & Zero Mutable Module State:** All data modules, queries, and handlers must strictly follow RED → GREEN → TRIANGULATE → REFACTOR with pure functions, read-only structures, and zero module-scoped `let` variables.
- **Per-Phase Green Invariant:** All 434 pre-existing tests across 43 test files must remain 100% green before and after each sub-slice.

---

## Sub-Slice S5a: Devices & Modules Data, Queries & Compatibility Façades (~260–370 lines)

*Scope: Extract static device and module datasets into `src/catalogs/data/`, implement 9 atomic query functions in `src/catalogs/queries/`, initialize the query barrel `src/catalogs/queries/index.ts`, and convert `src/catalogs/devices.ts` and `src/catalogs/modules.ts` into thin backward-compatible re-export façades.*

### Phase S5a.1 — Device Data & Query Unit Tests (RED)
- [x] Create `tests/catalogs/device-queries.test.ts` specifying R1 scenarios: lookup type ID by model (`"2911"` -> `0`, `"2960-24TT"` -> `1`, unknown -> `undefined`), lookup category (`"2911"` -> `"router"`, `"PC-PT"` -> `"pc"`, unknown -> `undefined`), filter by numeric category (`0` includes `"2911"`, `"2811"`, `"Router-PT"`), filter by string category (`"switch"` includes `"2960-24TT"`), unknown numeric category fallback to `"other"`, validate model existence (`isDeviceModel("2911")` -> `true`, unknown -> `false`), and `listDeviceModels()` returning fresh arrays with >140 items matching `deviceCatalog` order. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/catalogs/device-queries.test.ts` to confirm RED failure before queries and data modules exist. <!-- sdd-owner: implementation -->

### Phase S5a.2 — Device Data Extraction & Atomic Queries (GREEN)
- [x] Extract static device datasets into `src/catalogs/data/device-data.ts` exporting `DEVICE_TYPE_MAP`, `DEVICE_CATEGORIES`, `CATEGORY_NAMES`, and pre-indexed immutable `deviceCatalog: Map<string, DeviceEntry>` in unchanged insertion order. <!-- sdd-owner: implementation -->
- [x] Implement `src/catalogs/queries/get-device-type.ts` exporting pure function `getDeviceType(model: string): number | undefined`. <!-- sdd-owner: implementation -->
- [x] Implement `src/catalogs/queries/get-device-category.ts` exporting pure function `getDeviceCategory(model: string): DeviceCategory | undefined`. <!-- sdd-owner: implementation -->
- [x] Implement `src/catalogs/queries/get-devices-by-category.ts` exporting pure function `getDevicesByCategory(category: number | DeviceCategory): string[]` returning fresh arrays. <!-- sdd-owner: implementation -->
- [x] Implement `src/catalogs/queries/is-device-model.ts` exporting pure function `isDeviceModel(model: string): boolean`. <!-- sdd-owner: implementation -->
- [x] Implement `src/catalogs/queries/list-device-models.ts` exporting pure function `listDeviceModels(): string[]` returning a new array of models. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/catalogs/device-queries.test.ts` to verify GREEN passage for all device query unit tests. <!-- sdd-owner: implementation -->

### Phase S5a.3 — Module Data & Query Unit Tests (RED)
- [x] Create `tests/catalogs/module-queries.test.ts` specifying R2 scenarios: lookup type ID by model (`"WIC-1T"` -> `2`, `"NM-1FE-TX"` -> `1`, unknown -> `undefined`), validate model existence (`isModuleModel("WIC-1T")` -> `true`, unknown -> `false`), filter models by type (`getModulesByType(2)` includes `"WIC-1T"` and `"WIC-2T"`), and `listModuleModels()` returning fresh arrays with >50 items matching `moduleCatalog` order. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/catalogs/module-queries.test.ts` to confirm RED failure before module queries and data module exist. <!-- sdd-owner: implementation -->

### Phase S5a.4 — Module Data Extraction & Atomic Queries (GREEN)
- [x] Extract static module datasets into `src/catalogs/data/module-data.ts` exporting `MODULE_MAP` and pre-indexed immutable `moduleCatalog: Map<string, ModuleEntry>` in unchanged insertion order. <!-- sdd-owner: implementation -->
- [x] Implement `src/catalogs/queries/get-module-type.ts` exporting pure function `getModuleType(model: string): number | undefined`. <!-- sdd-owner: implementation -->
- [x] Implement `src/catalogs/queries/is-module-model.ts` exporting pure function `isModuleModel(model: string): boolean`. <!-- sdd-owner: implementation -->
- [x] Implement `src/catalogs/queries/list-module-models.ts` exporting pure function `listModuleModels(): string[]` returning a new array of models. <!-- sdd-owner: implementation -->
- [x] Implement `src/catalogs/queries/get-modules-by-type.ts` exporting pure function `getModulesByType(typeId: number): string[]` returning fresh arrays. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/catalogs/module-queries.test.ts` to verify GREEN passage for all module query unit tests. <!-- sdd-owner: implementation -->

### Phase S5a.5 — Query Barrel & Compatibility Façades (GREEN)
- [x] Initialize `src/catalogs/queries/index.ts` exporting the 9 implemented device and module queries. <!-- sdd-owner: implementation -->
- [x] Refactor `src/catalogs/devices.ts` into a pure re-export façade exporting `DEVICE_CATEGORIES`, `deviceCatalog`, and the 5 device queries. <!-- sdd-owner: implementation -->
- [x] Refactor `src/catalogs/modules.ts` into a pure re-export façade exporting `moduleCatalog` and the 4 module queries. <!-- sdd-owner: implementation -->
- [x] Create `tests/catalogs/facades-devices-modules.test.ts` verifying export identity contracts for devices and modules. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/catalogs/facades-devices-modules.test.ts` to verify export identity contracts pass. <!-- sdd-owner: implementation -->

### Phase S5a.6 — S5a Triangulation & Verification Gate (REFACTOR)
- [x] Triangulate edge cases: case sensitivity, unknown values, immutability of returned lists, and numerical/string category equivalence. <!-- sdd-owner: implementation -->
- [x] Run regression suite: `npx vitest run tests/catalogs/catalogs.test.ts` and full suite `npm test`. <!-- sdd-owner: implementation -->
- [x] Run `npm run build` to verify clean TypeScript compilation. <!-- sdd-owner: implementation -->

---

## Sub-Slice S5b: Links & Interfaces Data, Queries & Aggregator Barrel (~270–385 lines)

*Scope: Extract static link and interface datasets into `src/catalogs/data/`, implement 7 atomic query functions in `src/catalogs/queries/`, complete the query barrel `src/catalogs/queries/index.ts`, convert `src/catalogs/links.ts` and `src/catalogs/interfaces.ts` into thin re-export façades, and update `src/catalogs/index.ts`.*

### Phase S5b.1 — Link Data & Query Unit Tests (RED)
- [x] Create `tests/catalogs/link-queries.test.ts` specifying R3 scenarios: lookup link type ID by canonical name (`"straight"` -> `8100`, `"cross"` -> `8101`), lookup link type ID by alias (`"ethernet-straight"` -> `8100`, `"ethernet-cross"` -> `8101`), unknown link type returning `undefined`, validate link type name or alias (`isLinkType("straight")` -> `true`, `isLinkType("ethernet-cross")` -> `true`, unknown -> `false`), list all unique canonical link types (`listLinkTypes()` contains 15 unique entries without duplicates), and resolve canonical name from alias (`resolveLinkType("ethernet-straight")` -> `"straight"`, `"straight"` -> `"straight"`, unknown -> `undefined`). <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/catalogs/link-queries.test.ts` to confirm RED failure before link queries and data module exist. <!-- sdd-owner: implementation -->

### Phase S5b.2 — Link Data Extraction & Atomic Queries (GREEN)
- [x] Extract static link datasets into `src/catalogs/data/link-data.ts` exporting `LINK_MAP`, `LINK_TYPE_ALIASES`, and pre-indexed immutable `linkTypeCatalog: Map<string, LinkTypeEntry>` with preserved alias indexing. <!-- sdd-owner: implementation -->
- [x] Implement `src/catalogs/queries/get-link-type-id.ts` exporting pure function `getLinkTypeId(type: string): number | undefined`. <!-- sdd-owner: implementation -->
- [x] Implement `src/catalogs/queries/is-link-type.ts` exporting pure function `isLinkType(type: string): boolean`. <!-- sdd-owner: implementation -->
- [x] Implement `src/catalogs/queries/list-link-types.ts` exporting pure function `listLinkTypes(): string[]` returning deduplicated canonical link names. <!-- sdd-owner: implementation -->
- [x] Implement `src/catalogs/queries/resolve-link-type.ts` exporting pure function `resolveLinkType(aliasOrName: string): string | undefined`. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/catalogs/link-queries.test.ts` to verify GREEN passage for all link query unit tests. <!-- sdd-owner: implementation -->

### Phase S5b.3 — Interface Map Data & Query Unit Tests (RED)
- [x] Create `tests/catalogs/interface-queries.test.ts` specifying R4 scenarios: query router/switch interfaces (`"2911"` -> GigabitEthernet + Serial, `"2960-24TT"` -> FastEthernet + GigabitEthernet), query end-device interfaces (`"PC-PT"` -> `["FastEthernet0"]`, `"Server-PT"` -> `["FastEthernet0"]`, `"Laptop-PT"` -> `["FastEthernet0", "Wireless0"]`), unknown model lookup returning empty array `[]` without throwing, presence check (`hasInterfaces("2911")` -> `true`, unknown -> `false`), and `listModelsWithInterfaces()` returning all keys from `modelInterfaces`. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/catalogs/interface-queries.test.ts` to confirm RED failure before interface queries and data module exist. <!-- sdd-owner: implementation -->

### Phase S5b.4 — Interface Data Extraction & Atomic Queries (GREEN)
- [x] Extract static interface dataset into `src/catalogs/data/interface-data.ts` exporting `modelInterfaces: Map<string, string[]>` as a single immutable map initialization preserving exact model and interface order. <!-- sdd-owner: implementation -->
- [x] Implement `src/catalogs/queries/get-interfaces.ts` exporting pure function `getInterfaces(model: string): string[]` returning stored array for known models and fresh empty array `[]` for unknown models. <!-- sdd-owner: implementation -->
- [x] Implement `src/catalogs/queries/has-interfaces.ts` exporting pure function `hasInterfaces(model: string): boolean`. <!-- sdd-owner: implementation -->
- [x] Implement `src/catalogs/queries/list-models-with-interfaces.ts` exporting pure function `listModelsWithInterfaces(): string[]` returning a new array of models. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/catalogs/interface-queries.test.ts` to verify GREEN passage for all interface query unit tests. <!-- sdd-owner: implementation -->

### Phase S5b.5 — Query Barrel Completion & All Compatibility Façades (GREEN)
- [x] Update `src/catalogs/queries/index.ts` appending the 7 link and interface queries to re-export all 16 atomic catalog query functions. <!-- sdd-owner: implementation -->
- [x] Refactor `src/catalogs/links.ts` into a pure re-export façade exporting `LINK_TYPE_ALIASES`, `linkTypeCatalog`, and the 4 link queries. <!-- sdd-owner: implementation -->
- [x] Refactor `src/catalogs/interfaces.ts` into a pure re-export façade exporting `modelInterfaces` and the 3 interface queries. <!-- sdd-owner: implementation -->
- [x] Update `src/catalogs/index.ts` re-exporting all symbols from `devices.js`, `modules.js`, `links.js`, and `interfaces.js`. <!-- sdd-owner: implementation -->
- [x] Create `tests/catalogs/facades-links-interfaces.test.ts` verifying export identity contracts for links, interfaces, index barrel, and consumer compatibility with `src/bridge/script-builder.ts`. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/catalogs/facades-links-interfaces.test.ts` to verify export identity contracts pass. <!-- sdd-owner: implementation -->

### Phase S5b.6 — S5b Triangulation & Verification Gate (REFACTOR)
- [x] Triangulate edge cases: case sensitivity, whitespace inputs, alias symmetry, and immutability of returned interface lists. <!-- sdd-owner: implementation -->
- [x] Run regression suite: `npx vitest run tests/catalogs/catalogs.test.ts tests/catalogs/interfaces.test.ts` and full suite `npm test`. <!-- sdd-owner: implementation -->
- [x] Run `npm run build` to verify clean TypeScript compilation. <!-- sdd-owner: implementation -->

---

## Sub-Slice S5c: Dedicated MCP Resource Handlers & JSON Serialization (~250–370 lines)

*Scope: Extract pure JSON envelope formatting and four catalog snapshot readers into `src/server/handlers/resources/`, implement `registerCatalogResources`, and cut over resource registration in `src/server.ts` while keeping tools temporarily inline.*

### Phase S5c.1 — Resource Formatter Unit Tests (RED)
- [x] Create `tests/server/resources/format-resource.test.ts` specifying R6 envelope formatting: URI preservation, MIME type `application/json`, valid 2-space pretty-printed JSON text serialization, and SDK-native `ReadResourceResult` return shape. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/server/resources/format-resource.test.ts` to confirm RED failure. <!-- sdd-owner: implementation -->

### Phase S5c.2 — Pure Resource Formatter Implementation (GREEN)
- [x] Implement `src/server/handlers/resources/format-resource.ts` exporting pure function `formatJsonResource(uri: string, data: unknown): ReadResourceResult`. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/server/resources/format-resource.test.ts` to verify GREEN passage. <!-- sdd-owner: implementation -->

### Phase S5c.3 — Catalog Resource Readers Unit Tests (RED)
- [x] Create `tests/server/resources/catalog-resources.test.ts` specifying R6 scenarios:
  - `devices-resource`: URI `pt://catalog/devices`, returns array of `{ model, typeId, category }` matching `deviceCatalog.values()`.
  - `modules-resource`: URI `pt://catalog/modules`, returns array of `{ model, typeId }` matching `moduleCatalog.values()`.
  - `links-resource`: URI `pt://catalog/links`, returns array of `{ name, id, aliases }` preserving `linkTypeCatalog.values()` including duplicate alias-indexed entries.
  - `interfaces-resource`: URI `pt://catalog/interfaces`, returns dictionary `Record<string, string[]>` preserving insertion order of `modelInterfaces`. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/server/resources/catalog-resources.test.ts` to confirm RED failure. <!-- sdd-owner: implementation -->

### Phase S5c.4 — Catalog Resource Readers Implementation (GREEN)
- [x] Implement `src/server/handlers/resources/devices-resource.ts` exporting `DEVICES_RESOURCE_URI`, `DEVICES_RESOURCE_NAME`, and `readDevicesResource(): Promise<ReadResourceResult>`. <!-- sdd-owner: implementation -->
- [x] Implement `src/server/handlers/resources/modules-resource.ts` exporting `MODULES_RESOURCE_URI`, `MODULES_RESOURCE_NAME`, and `readModulesResource(): Promise<ReadResourceResult>`. <!-- sdd-owner: implementation -->
- [x] Implement `src/server/handlers/resources/links-resource.ts` exporting `LINKS_RESOURCE_URI`, `LINKS_RESOURCE_NAME`, and `readLinksResource(): Promise<ReadResourceResult>`. <!-- sdd-owner: implementation -->
- [x] Implement `src/server/handlers/resources/interfaces-resource.ts` exporting `INTERFACES_RESOURCE_URI`, `INTERFACES_RESOURCE_NAME`, and `readInterfacesResource(): Promise<ReadResourceResult>`. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/server/resources/catalog-resources.test.ts` to verify GREEN passage for all four resource readers. <!-- sdd-owner: implementation -->

### Phase S5c.5 — Resource Registrar & Server Cutover (RED → GREEN)
- [x] Create `tests/server/resources/register-resources.test.ts` asserting that `registerCatalogResources(server)` calls `server.resource(name, uri, callback)` exactly 4 times with exact names, URIs, and handlers in devices, modules, links, interfaces order. <!-- sdd-owner: implementation -->
- [x] Implement `src/server/handlers/resources/register-resources.ts` exporting `registerCatalogResources(server: McpServer): void`. <!-- sdd-owner: implementation -->
- [x] Refactor resource registration in `src/server.ts` to replace inline `server.resource` blocks with a single call to `registerCatalogResources(server)`. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/server/resources/register-resources.test.ts` to verify GREEN passage. <!-- sdd-owner: implementation -->

### Phase S5c.6 — S5c Triangulation & Verification Gate (REFACTOR)
- [x] Triangulate: verify resource payloads match existing server integration expectations in `tests/server/server.integration.test.ts`. <!-- sdd-owner: implementation -->
- [x] Run regression suite: `npx vitest run tests/server/server.integration.test.ts` and full suite `npm test`. <!-- sdd-owner: implementation -->
- [x] Run `npm run build` to verify clean TypeScript compilation. <!-- sdd-owner: implementation -->

---

## Sub-Slice S5d: MCP Tool Handlers & Server Composition Root (<60L) (~270–390 lines)

*Scope: Extract tool schema extraction, result/error formatting, and execution handler generation into `src/server/handlers/tools/`, implement `registerTools`, and refactor `src/server.ts` into a dependency-injectable composition root under 60 physical lines.*

### Phase S5d.1 — Tool Schema Extraction & Formatters Tests (RED)
- [x] Create `tests/server/tools/extract-input-schema.test.ts` specifying R7: extracts `.shape` from `tool.inputSchema` (e.g. `addDeviceTool`). <!-- sdd-owner: implementation -->
- [x] Create `tests/server/tools/format-tool-result.test.ts` specifying R7: formats live/data result as `{ content: [{ type: "text", text: JSON.stringify({ mode, data }) }] }`, script mode with non-empty code as `{ content: [{ type: "text", text: JSON.stringify({ mode, script }) }] }`, and never sets `isError: true`. <!-- sdd-owner: implementation -->
- [x] Create `tests/server/tools/format-tool-error.test.ts` specifying R7: formats `Error` instances and non-Error primitives into `{ content: [{ type: "text", text: JSON.stringify({ error: message }) }], isError: true }`. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/server/tools/` to confirm RED failure before tool handler modules exist. <!-- sdd-owner: implementation -->

### Phase S5d.2 — Tool Schema Extraction & Formatters Implementation (GREEN)
- [x] Implement `src/server/handlers/tools/extract-input-schema.ts` exporting pure function `extractInputSchema(tool: Tool): z.ZodRawShape`. <!-- sdd-owner: implementation -->
- [x] Implement `src/server/handlers/tools/format-tool-result.ts` exporting pure function `formatToolResult(result: ToolResult): CallToolResult`. <!-- sdd-owner: implementation -->
- [x] Implement `src/server/handlers/tools/format-tool-error.ts` exporting pure function `formatToolError(error: unknown): CallToolResult`. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/server/tools/extract-input-schema.test.ts tests/server/tools/format-tool-result.test.ts tests/server/tools/format-tool-error.test.ts` to verify GREEN passage. <!-- sdd-owner: implementation -->

### Phase S5d.3 — Tool Handler Callback & Registrar Tests (RED)
- [x] Create `tests/server/tools/create-tool-handler.test.ts` specifying R7: executes `tool.execute(bridge, args)`, returns formatted result on success, catches synchronous throws and promise rejections returning formatted error with `isError: true` without unhandled rejections. <!-- sdd-owner: implementation -->
- [x] Create `tests/server/tools/register-tools.test.ts` specifying R7: binds all tools via `server.tool(name, description, schema, handler)`, defaults to `allTools` (9 tools: 7 primitive, 2 composite), and accepts custom tool arrays for isolation. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/server/tools/create-tool-handler.test.ts tests/server/tools/register-tools.test.ts` to confirm RED failure. <!-- sdd-owner: implementation -->

### Phase S5d.4 — Tool Handler Callback & Registrar Implementation (GREEN)
- [x] Implement `src/server/handlers/tools/create-tool-handler.ts` exporting `createToolHandler(tool: Tool, bridge: BridgeAdapter): McpToolHandler`. <!-- sdd-owner: implementation -->
- [x] Implement `src/server/handlers/tools/register-tools.ts` exporting `registerTools(server: McpServer, bridge: BridgeAdapter, tools?: Tool[]): void`. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/server/tools/create-tool-handler.test.ts tests/server/tools/register-tools.test.ts` to verify GREEN passage. <!-- sdd-owner: implementation -->

### Phase S5d.5 — Server Composition Root (<60L) with Bridge Injection (RED → GREEN)
- [x] Create `tests/server/server-composition.test.ts` specifying R8: `createMcpServer(bridgeOverride?)` uses supplied bridge without constructing default bridge on 54321, uses `createBridge(54321)` when no override is supplied, registers 4 resources and 9 tools, and `startServer()` binds stdio transport, logs diagnostics, and connects. <!-- sdd-owner: implementation -->
- [x] Refactor `src/server.ts` into a thin composition root (<60 physical lines) importing only `McpServer`, `StdioServerTransport`, `createBridge`, `allTools`, `registerCatalogResources`, and `registerTools`. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run tests/server/server-composition.test.ts` to verify composition root tests pass. <!-- sdd-owner: implementation -->

### Phase S5d.6 — S5d Triangulation, Physical Line Count & Final Suite Gate (REFACTOR)
- [x] Verify `src/server.ts` physical line count is strictly below 60 lines (excluding empty/comment lines: target <50L). <!-- sdd-owner: implementation -->
- [x] Run complete integration suite `npx vitest run tests/server/server.integration.test.ts` to verify 100% backward compatibility of MCP tools and resources. <!-- sdd-owner: implementation -->
- [x] Run full repository test suite `npm test` verifying all 434 pre-existing tests plus all new tests pass with zero failures. <!-- sdd-owner: implementation -->
- [x] Run `npm run build` to verify clean TypeScript compilation under NodeNext. <!-- sdd-owner: implementation -->

---

## Post-S5: Verification Audit, Canonical Spec Sync & Archive Plan

*Scope: Complete final verification of `micro-modular-alignment`, synchronize the accepted Slice 5 specification into canonical OpenSpec, and archive the change.*

### Phase S5-Close.1 — Full Behavioral & Architectural Verification Audit
- [x] Execute complete test suite `npm test` and build check `npm run build`, capturing terminal evidence. <!-- sdd-owner: implementation -->
- [x] Audit all 8 requirements and 42 scenarios across S5a–S5d in `openspec/changes/micro-modular-alignment/verify-report.md`. <!-- sdd-owner: implementation -->
- [x] Audit architectural invariants: exactly 16 query files (one function per file), pure data modules with zero query exports, `src/server.ts` <60 lines, and all historical catalog exports preserved. <!-- sdd-owner: implementation -->

### Phase S5-Close.2 — Canonical Spec Synchronization
- [x] Synchronize accepted Slice 5 specification to `openspec/specs/slice-5-catalogs-server/spec.md`. <!-- sdd-owner: parent -->
- [x] Create `openspec/changes/micro-modular-alignment/sync-report.md` recording canonical specification promotion. <!-- sdd-owner: parent -->

### Phase S5-Close.3 — Final Change Archive
- [x] Archive `micro-modular-alignment` change recording that all 5 milestone families (S1–S5) are complete with zero remaining slices. <!-- sdd-owner: parent -->
