# Slice 5 Catalogs & Server Handlers Specification

## Purpose

Define the normative behavioral contracts, requirements, and testable scenarios for **Slice 5 (Catalog Data/Queries and Server Handlers)** of the `micro-modular-alignment` change. This slice represents the **final milestone (S5)** of the architectural alignment specified in `AGENTS.md` and `proposal.md`, decomposing the remaining monolithic catalog files (`src/catalogs/devices.ts` 124L, `src/catalogs/modules.ts` 77L, `src/catalogs/links.ts` 90L, `src/catalogs/interfaces.ts` 167L) and the central server wiring file (`src/server.ts` 197L) into:

1. **Pure Catalog Data Modules (`src/catalogs/data/`):** Dedicated, static data-only modules (`device-data.ts`, `module-data.ts`, `link-data.ts`, `interface-data.ts`) containing only raw dictionaries, category maps, alias records, and pre-indexed catalog maps without query functions.
2. **Atomic Catalog Queries (`src/catalogs/queries/`):** Pure, single-responsibility query functions conforming to the strict *"one function = one file"* principle (`get-device-type.ts`, `get-device-category.ts`, `get-devices-by-category.ts`, `is-device-model.ts`, `list-device-models.ts`, `get-module-type.ts`, `is-module-model.ts`, `list-module-models.ts`, `get-modules-by-type.ts`, `get-link-type-id.ts`, `is-link-type.ts`, `list-link-types.ts`, `resolve-link-type.ts`, `get-interfaces.ts`, `has-interfaces.ts`, `list-models-with-interfaces.ts`).
3. **Dedicated MCP Resource Handlers (`src/server/handlers/resources/`):** Isolated modules for serialization and resource dispatch (`devices-resource.ts`, `modules-resource.ts`, `links-resource.ts`, `interfaces-resource.ts`, `format-resource.ts`, `register-resources.ts`) eliminating manual JSON formatting from the server wiring.
4. **Modular MCP Tool Handlers & Execution Dispatch (`src/server/handlers/tools/`):** Single-responsibility modules for Zod schema extraction (`extract-input-schema.ts`), tool result/error formatting (`format-tool-result.ts`, `format-tool-error.ts`), bridge-injected tool callback creation (`create-tool-handler.ts`), and server tool registration (`register-tools.ts`).
5. **Thin Server Composition Root (`src/server.ts`):** A clean composition root (<60 lines) that instantiates the bridge and MCP server, delegates resource and tool registrations to the handler registrars, and connects the stdio transport.
6. **Backward-Compatible Façades & 100% Suite Integrity:** Historical entry points (`src/catalogs/devices.ts`, `src/catalogs/modules.ts`, `src/catalogs/links.ts`, `src/catalogs/interfaces.ts`, `src/catalogs/index.ts`, and `src/server.ts`) preserved as thin re-export façades, ensuring all 434 existing tests remain 100% green without modification.

Upon successful delivery and canonical sync of Slice 5, all 5 scope families defined in `proposal.md` will be fulfilled, and the `micro-modular-alignment` change will be ready for archive.

---

## Non-Goals (Final Slice Scope Boundaries)

To protect the review budget (<400 changed lines per review sub-slice) and prevent architectural drift, the following items are explicitly **excluded** from this specification:

- **Subsequent Slices:** S5 is the final slice of `micro-modular-alignment`. No further slices remain; following S5 verification and sync, the change proceeds directly to archive.
- **Catalog Dataset Modifications:** Adding, removing, or renaming device models, module models, link types, or interface definitions. All catalog contents MUST remain strictly identical to current entries.
- **MCP Resource Protocol Changes:** Modifying resource URIs (`pt://catalog/devices`, `pt://catalog/modules`, `pt://catalog/links`, `pt://catalog/interfaces`), MIME types (`application/json`), or payload shapes.
- **MCP Tool Protocol Changes:** Modifying public tool names, parameter schemas, execution behavior, or output JSON envelopes.
- **Dependency Injections or External Frameworks:** Introducing third-party dependency-injection containers, service locators, or ORMs. Composition MUST use pure TypeScript functions and constructor parameter injection.
- **Removal of Façades:** Historical entry points MUST NOT be removed in this slice; backward compatibility is mandatory.
- **Modification of Other Subsystems:** `src/core/`, `src/tools/`, `src/bridge/`, and `src/tui/` modules remain untouched in this slice except for importing canonical modules if desired.

---

## Constraints and Delivery Gates

1. **Review Budget:** Each sub-slice (S5a, S5b, S5c, S5d) MUST remain strictly below **400 changed lines**, including data modules, queries, handlers, tests, and façades.
2. **Strict TDD:** Every query function, resource handler, tool formatter, and registration module MUST be developed using strict test-driven development (RED → GREEN → REFACTOR) with unit tests located under `tests/catalogs/` and `tests/server/`.
3. **Per-Phase Green:** All 434 pre-existing tests across 43 test files MUST remain green (`npm test` passes with zero failures) before and after each sub-slice.
4. **Zero Module-Level Mutable State:** Data maps MUST be initialized as immutable or read-only structures; no module-scoped `let` variables or runtime mutators are permitted.
5. **One Function = One File:** Each query function in `src/catalogs/queries/` and each handler in `src/server/handlers/` MUST reside in its own dedicated file with a default or named export.
6. **API & Façade Backward Compatibility:**
   - `src/catalogs/devices.ts` MUST continue exporting `DEVICE_CATEGORIES`, `deviceCatalog`, `getDeviceType`, `getDeviceCategory`, `getDevicesByCategory`, `isDeviceModel`, and `listDeviceModels`.
   - `src/catalogs/modules.ts` MUST continue exporting `moduleCatalog`, `getModuleType`, `isModuleModel`, `listModuleModels`, and `getModulesByType`.
   - `src/catalogs/links.ts` MUST continue exporting `LINK_TYPE_ALIASES`, `linkTypeCatalog`, `getLinkTypeId`, `isLinkType`, `listLinkTypes`, and `resolveLinkType`.
   - `src/catalogs/interfaces.ts` MUST continue exporting `modelInterfaces`, `getInterfaces`, `hasInterfaces`, and `listModelsWithInterfaces`.
   - `src/catalogs/index.ts` MUST continue re-exporting all the above.
   - `src/server.ts` MUST continue exporting `createMcpServer` and `startServer`.

---

## Requirements

### Requirement: Static Device Catalog Data and Atomic Queries

The system MUST decouple static device definitions from query operations:

1. Static data MUST be defined in `src/catalogs/data/device-data.ts`, exporting:
   - `DEVICE_TYPE_MAP: Record<string, number>`
   - `DEVICE_CATEGORIES: Record<number, DeviceCategory>`
   - `CATEGORY_NAMES: Record<number, DeviceCategory>`
   - `deviceCatalog: Map<string, DeviceEntry>` containing all 151 Packet Tracer models with their `model`, `typeId`, and resolved `category` (spec-bug fix: corrected from 153 to 151 to match verifiable baseline of 151 device models in `src/catalogs/data/device-data.ts`).
2. Each query function MUST reside in its own dedicated file under `src/catalogs/queries/`:
   - `get-device-type.ts`: `getDeviceType(model: string): number | undefined`
   - `get-device-category.ts`: `getDeviceCategory(model: string): DeviceCategory | undefined`
   - `get-devices-by-category.ts`: `getDevicesByCategory(category: number | DeviceCategory): string[]`
   - `is-device-model.ts`: `isDeviceModel(model: string): boolean`
   - `list-device-models.ts`: `listDeviceModels(): string[]`

#### Scenario: Lookup device type ID by model name
- GIVEN the static device catalog data
- WHEN `getDeviceType("2911")` is called
- THEN the returned type ID MUST be `0`
- WHEN `getDeviceType("2960-24TT")` is called
- THEN the returned type ID MUST be `1`
- WHEN `getDeviceType("nonexistent-model")` or `getDeviceType("")` is called
- THEN the returned value MUST be `undefined`

#### Scenario: Lookup device category by model name
- GIVEN the static device catalog data
- WHEN `getDeviceCategory("2911")` is called
- THEN the returned category MUST be `"router"`
- WHEN `getDeviceCategory("PC-PT")` is called
- THEN the returned category MUST be `"pc"`
- WHEN `getDeviceCategory("unknown-device")` is called
- THEN the returned value MUST be `undefined`

#### Scenario: Filter device models by category
- GIVEN the static device catalog data
- WHEN `getDevicesByCategory(0)` (numeric type ID) is called
- THEN the returned array MUST include `"2911"`, `"2811"`, and `"Router-PT"`
- WHEN `getDevicesByCategory("switch")` (category name) is called
- THEN the returned array MUST include `"2960-24TT"` and `"Switch-PT"`

#### Scenario: Validate model existence and list all device models
- GIVEN the static device catalog data
- WHEN `isDeviceModel("2911")` is called
- THEN the result MUST be `true`
- WHEN `isDeviceModel("unknown-model")` is called
- THEN the result MUST be `false`
- WHEN `listDeviceModels()` is called
- THEN the returned array MUST contain all device model names with length greater than 140

---

### Requirement: Static Module Catalog Data and Atomic Queries

The system MUST decouple static module definitions from query operations:

1. Static data MUST be defined in `src/catalogs/data/module-data.ts`, exporting:
   - `MODULE_MAP: Record<string, number>`
   - `moduleCatalog: Map<string, ModuleEntry>` containing all module models and their `typeId`.
2. Each query function MUST reside in its own dedicated file under `src/catalogs/queries/`:
   - `get-module-type.ts`: `getModuleType(model: string): number | undefined`
   - `is-module-model.ts`: `isModuleModel(model: string): boolean`
   - `list-module-models.ts`: `listModuleModels(): string[]`
   - `get-modules-by-type.ts`: `getModulesByType(typeId: number): string[]`

#### Scenario: Lookup module type ID by model name
- GIVEN the static module catalog data
- WHEN `getModuleType("WIC-1T")` is called
- THEN the returned type ID MUST be `2`
- WHEN `getModuleType("NM-1FE-TX")` is called
- THEN the returned type ID MUST be `1`
- WHEN `getModuleType("INVALID-MODULE")` is called
- THEN the returned value MUST be `undefined`

#### Scenario: Validate module existence and list all module models
- GIVEN the static module catalog data
- WHEN `isModuleModel("WIC-1T")` is called
- THEN the result MUST be `true`
- WHEN `isModuleModel("NONEXISTENT")` is called
- THEN the result MUST be `false`
- WHEN `listModuleModels()` is called
- THEN the returned array MUST contain all module model names with length greater than 100

#### Scenario: Filter module models by numeric type ID
- GIVEN the static module catalog data
- WHEN `getModulesByType(1)` is called
- THEN the returned array MUST contain `"NM-1E"` and have length greater than 0
- WHEN `getModulesByType(2)` is called
- THEN the returned array MUST contain `"WIC-1T"` and have length greater than 0

---

### Requirement: Static Link Type Catalog Data, Aliases and Atomic Queries

The system MUST decouple static link type definitions and aliases from query operations:

1. Static data MUST be defined in `src/catalogs/data/link-data.ts`, exporting:
   - `LINK_MAP: Record<string, number>`
   - `LINK_TYPE_ALIASES: Record<string, string>`
   - `linkTypeCatalog: Map<string, LinkTypeEntry>` containing indexed link types with canonical `name`, numeric `id`, and associated `aliases`.
2. Each query function MUST reside in its own dedicated file under `src/catalogs/queries/`:
   - `get-link-type-id.ts`: `getLinkTypeId(name: string): number | undefined`
   - `is-link-type.ts`: `isLinkType(name: string): boolean`
   - `list-link-types.ts`: `listLinkTypes(): string[]`
   - `resolve-link-type.ts`: `resolveLinkType(name: string): string | undefined`

#### Scenario: Lookup link type ID by canonical name and alias
- GIVEN the static link catalog data
- WHEN `getLinkTypeId("ethernet-straight")` is called
- THEN the returned ID MUST be `8100`
- WHEN `getLinkTypeId("straight")` is called
- THEN the returned ID MUST be `8100`
- AND `getLinkTypeId("straight")` MUST equal `getLinkTypeId("ethernet-straight")`
- WHEN `getLinkTypeId("cross")` and `getLinkTypeId("ethernet-cross")` are called
- THEN both returned IDs MUST be `8101`
- WHEN `getLinkTypeId("unknown-link-type")` is called
- THEN the returned value MUST be `undefined`

#### Scenario: Validate bidirectional aliases and resolve canonical name
- GIVEN the `LINK_TYPE_ALIASES` mapping
- THEN `LINK_TYPE_ALIASES["straight"]` MUST equal `"ethernet-straight"`
- AND `LINK_TYPE_ALIASES["ethernet-straight"]` MUST equal `"straight"`
- AND `LINK_TYPE_ALIASES["cross"]` MUST equal `"ethernet-cross"`
- AND `LINK_TYPE_ALIASES["ethernet-cross"]` MUST equal `"cross"`
- WHEN `resolveLinkType("straight")` is called
- THEN the returned canonical name MUST be `"straight"`
- WHEN `resolveLinkType("ethernet-straight")` is called
- THEN the returned canonical name MUST be `"straight"`

#### Scenario: List canonical link types
- GIVEN the static link catalog data
- WHEN `listLinkTypes()` is called
- THEN the returned array MUST contain unique canonical link type names
- AND the length of unique entries MUST equal 15 (spec-bug fix: corrected from greater than 15 to equal 15 to match verifiable baseline of exactly 15 unique canonical link types in `src/catalogs/data/link-data.ts`).

---

### Requirement: Static Model Interfaces Catalog Data and Atomic Queries

The system MUST decouple static device interface mappings from query operations:

1. Static data MUST be defined in `src/catalogs/data/interface-data.ts`, exporting:
   - `modelInterfaces: Map<string, string[]>` mapping device model names to their pre-configured interface identifier lists.
2. Each query function MUST reside in its own dedicated file under `src/catalogs/queries/`:
   - `get-interfaces.ts`: `getInterfaces(model: string): string[]`
   - `has-interfaces.ts`: `hasInterfaces(model: string): boolean`
   - `list-models-with-interfaces.ts`: `listModelsWithInterfaces(): string[]`

#### Scenario: Query interfaces for router and switch models
- GIVEN the static interface catalog data
- WHEN `getInterfaces("2911")` is called
- THEN the returned array MUST contain `"GigabitEthernet0/0"`, `"GigabitEthernet0/1"`, `"GigabitEthernet0/2"`, `"Serial0/0/0"`, and `"Serial0/0/1"`
- WHEN `getInterfaces("2960-24TT")` is called
- THEN the returned array MUST contain `"FastEthernet0/1"`, `"FastEthernet0/24"`, `"GigabitEthernet0/1"`, and `"GigabitEthernet0/2"`

#### Scenario: Query interfaces for end devices
- GIVEN the static interface catalog data
- WHEN `getInterfaces("PC-PT")` is called
- THEN the returned array MUST contain `"FastEthernet0"`
- WHEN `getInterfaces("Server-PT")` is called
- THEN the returned array MUST contain `"FastEthernet0"`
- WHEN `getInterfaces("Laptop-PT")` is called
- THEN the returned array MUST contain `"FastEthernet0"` and `"Wireless0"`

#### Scenario: Query unknown models gracefully
- GIVEN the static interface catalog data
- WHEN `getInterfaces("UNKNOWN-MODEL-999")` is called
- THEN the returned array MUST be an empty array `[]` without throwing an exception

#### Scenario: Inspect interface presence and enumerate supported models
- GIVEN the static interface catalog data
- WHEN `hasInterfaces("2911")` is called
- THEN the result MUST be `true`
- WHEN `hasInterfaces("NONEXISTENT")` is called
- THEN the result MUST be `false`
- WHEN `listModelsWithInterfaces()` is called
- THEN the returned array MUST contain all models present in `modelInterfaces`

---

### Requirement: Backward-Compatible Catalog Façades and Aggregator Barrel

The system MUST preserve all historical catalog entry points as backward-compatible delegation façades:

1. `src/catalogs/devices.ts` MUST re-export `DEVICE_CATEGORIES`, `deviceCatalog`, `getDeviceType`, `getDeviceCategory`, `getDevicesByCategory`, `isDeviceModel`, and `listDeviceModels`.
2. `src/catalogs/modules.ts` MUST re-export `moduleCatalog`, `getModuleType`, `isModuleModel`, `listModuleModels`, and `getModulesByType`.
3. `src/catalogs/links.ts` MUST re-export `LINK_TYPE_ALIASES`, `linkTypeCatalog`, `getLinkTypeId`, `isLinkType`, `listLinkTypes`, and `resolveLinkType`.
4. `src/catalogs/interfaces.ts` MUST re-export `modelInterfaces`, `getInterfaces`, `hasInterfaces`, and `listModelsWithInterfaces`.
5. `src/catalogs/index.ts` MUST re-export all symbols from the four catalog modules.

#### Scenario: Preserve existing test suite and internal consumer imports
- GIVEN existing modules or tests importing from `../../src/catalogs/devices`
- WHEN importing `deviceCatalog`, `getDeviceType`, `getDevicesByCategory`, and `DEVICE_CATEGORIES`
- THEN all imported symbols MUST resolve identically to pre-refactor behavior
- AND running `tests/catalogs/catalogs.test.ts` and `tests/catalogs/interfaces.test.ts` MUST pass without modifications

#### Scenario: Preserve bridge script-builder import
- GIVEN `src/bridge/script-builder.ts` importing `getLinkTypeId` from `../catalogs/links.js`
- WHEN building a link command script
- THEN `getLinkTypeId` MUST resolve correctly via the façade

---

### Requirement: Dedicated MCP Resource Handlers and JSON Content Serialization

The system MUST extract MCP resource content serialization and endpoint handlers into `src/server/handlers/resources/`:

1. `format-resource.ts`: pure helper `formatJsonResource(uri: string, data: unknown)` returning `{ contents: [{ uri, mimeType: "application/json", text: JSON.stringify(data, null, 2) }] }`.
2. `devices-resource.ts`: handler for `pt://catalog/devices`, returning formatted JSON array of `{ model: string, typeId: number, category: string }`.
3. `modules-resource.ts`: handler for `pt://catalog/modules`, returning formatted JSON array of `{ model: string, typeId: number }`.
4. `links-resource.ts`: handler for `pt://catalog/links`, returning formatted JSON array of `{ name: string, id: number, aliases: string[] }`.
5. `interfaces-resource.ts`: handler for `pt://catalog/interfaces`, returning formatted JSON object of `Record<string, string[]>`.
6. `register-resources.ts`: registrar function `registerCatalogResources(server: McpServer)` binding all 4 resource URIs with their titles and handlers.

#### Scenario: Format JSON resource envelope
- GIVEN a URI `"pt://catalog/test"` and a data object `{ key: "value" }`
- WHEN `formatJsonResource("pt://catalog/test", { key: "value" })` is called
- THEN the result MUST have `contents` array with one element
- AND the element MUST have `uri: "pt://catalog/test"`, `mimeType: "application/json"`, and `text` containing valid pretty-printed JSON

#### Scenario: Execute devices catalog resource handler
- GIVEN the `devices-resource` handler
- WHEN the handler is executed
- THEN it MUST return an MCP resource response for URI `"pt://catalog/devices"`
- AND the parsed JSON text MUST be an array of objects having `model`, `typeId`, and `category` properties matching all device entries

#### Scenario: Execute modules catalog resource handler
- GIVEN the `modules-resource` handler
- WHEN the handler is executed
- THEN it MUST return an MCP resource response for URI `"pt://catalog/modules"`
- AND the parsed JSON text MUST be an array of objects having `model` and `typeId` properties matching all module entries

#### Scenario: Execute links catalog resource handler
- GIVEN the `links-resource` handler
- WHEN the handler is executed
- THEN it MUST return an MCP resource response for URI `"pt://catalog/links"`
- AND the parsed JSON text MUST be an array of objects having `name`, `id`, and `aliases` properties matching all link type entries

#### Scenario: Execute interfaces catalog resource handler
- GIVEN the `interfaces-resource` handler
- WHEN the handler is executed
- THEN it MUST return an MCP resource response for URI `"pt://catalog/interfaces"`
- AND the parsed JSON text MUST be a dictionary mapping model names to array of interface strings

#### Scenario: Register all catalog resources on MCP server
- GIVEN an instance of `McpServer`
- WHEN `registerCatalogResources(server)` is called
- THEN the server MUST have registered resources for `"pt://catalog/devices"`, `"pt://catalog/modules"`, `"pt://catalog/links"`, and `"pt://catalog/interfaces"`

---

### Requirement: Modular MCP Tool Schema Extraction, Result Formatting and Execution Handler

The system MUST extract tool registration, schema translation, execution callback creation, and result/error serialization into single-responsibility modules under `src/server/handlers/tools/`:

1. `extract-input-schema.ts`: `extractInputSchema(tool: Tool): z.ZodRawShape` extracting `.shape` from `tool.inputSchema`.
2. `format-tool-result.ts`: `formatToolResult(result: ToolResult)` formatting:
   - Script mode: `{ content: [{ type: "text", text: JSON.stringify({ mode: result.mode, script: result.code }) }] }`
   - Data mode: `{ content: [{ type: "text", text: JSON.stringify({ mode: result.mode, data: result.data }) }] }`
3. `format-tool-error.ts`: `formatToolError(error: unknown)` formatting `{ content: [{ type: "text", text: JSON.stringify({ error: message }) }], isError: true }`.
4. `create-tool-handler.ts`: `createToolHandler(tool: Tool, bridge: BridgeAdapter)` returning an async callback `(args: Record<string, unknown>) => Promise<McpToolResponse>` that executes `tool.execute(bridge, args)`, formats the result with `formatToolResult`, and catches errors with `formatToolError`.
5. `register-tools.ts`: `registerTools(server: McpServer, bridge: BridgeAdapter, tools?: Tool[])` iterating through tools, extracting schemas via `extractInputSchema`, and binding each tool via `server.tool(name, description, schema, handler)`.

#### Scenario: Extract input schema from tool definition
- GIVEN a Tool with a ZodObject inputSchema (e.g. `addDeviceTool`)
- WHEN `extractInputSchema(tool)` is called
- THEN the returned value MUST be a `z.ZodRawShape` representing the tool's parameter shape

#### Scenario: Format successful tool result in live mode
- GIVEN a `ToolResult` with `{ mode: "live", data: { success: true, id: "R1" } }`
- WHEN `formatToolResult(result)` is called
- THEN the returned response MUST contain a text content block with JSON string `{ "mode": "live", "data": { "success": true, "id": "R1" } }`
- AND `isError` MUST NOT be set to `true`

#### Scenario: Format successful tool result in script mode
- GIVEN a `ToolResult` with `{ mode: "script", code: "var dev = pt.addDevice(...);" }`
- WHEN `formatToolResult(result)` is called
- THEN the returned response MUST contain a text content block with JSON string `{ "mode": "script", "script": "var dev = pt.addDevice(...);" }`

#### Scenario: Format tool execution error
- GIVEN an error instance `new Error("Device already exists")`
- WHEN `formatToolError(error)` is called
- THEN the returned response MUST contain a text content block with JSON string `{ "error": "Device already exists" }`
- AND `isError` MUST equal `true`

#### Scenario: Execute tool via generated handler with error safety
- GIVEN a tool and a mock bridge
- WHEN the tool succeeds
- THEN the handler returned by `createToolHandler(tool, bridge)` MUST return the formatted success response
- WHEN the tool throws an exception
- THEN the handler returned by `createToolHandler(tool, bridge)` MUST catch the exception and return a formatted error response with `isError: true` without throwing an unhandled rejection

#### Scenario: Register tools on MCP server
- GIVEN an instance of `McpServer`, a bridge adapter, and the array `allTools`
- WHEN `registerTools(server, bridge, allTools)` is called
- THEN all 9 tools (7 primitive, 2 composite) MUST be registered with their respective names, descriptions, and schemas

---

### Requirement: Thin MCP Server Composition Root

The system MUST reduce `src/server.ts` to a thin composition root (<60 lines) responsible solely for wiring dependencies:

1. `createMcpServer(bridgeOverride?: BridgeAdapter): McpServer`:
   - Instantiates bridge adapter via `createBridge(54321)` or uses `bridgeOverride` if supplied.
   - Instantiates `new McpServer({ name: "MCP-PTB", version: "0.1.0" })`.
   - Invokes `registerCatalogResources(server)` to register catalog endpoints.
   - Invokes `registerTools(server, bridge, allTools)` to register tools.
   - Returns the configured `McpServer` instance.
2. `startServer(): Promise<void>`:
   - Calls `createMcpServer()`.
   - Creates a `StdioServerTransport` instance.
   - Emits startup diagnostic messages to `console.error`.
   - Calls `server.connect(transport)`.
3. `src/server.ts` MUST NOT contain embedded resource serialization logic, inline JSON stringification, or manual tool dispatch loops.

#### Scenario: Instantiate configured MCP server via composition root
- GIVEN the refactored `createMcpServer()`
- WHEN called without arguments
- THEN it MUST instantiate a default bridge on port 54321, register all 4 resources, register all 9 tools, and return an initialized `McpServer`

#### Scenario: Dependency injection support for testing
- GIVEN a mock `BridgeAdapter`
- WHEN `createMcpServer(mockBridge)` is called
- THEN it MUST use the supplied mock bridge for all tool executions instead of creating a real socket bridge

#### Scenario: Start MCP server over stdio transport
- GIVEN the `startServer()` function
- WHEN executed
- THEN it MUST create an MCP server, bind stdio transport, and connect successfully

#### Scenario: Maintain integration test integrity
- GIVEN the existing integration test suite in `tests/server/server.integration.test.ts`
- WHEN running the suite against the refactored `src/server.ts`
- THEN all tests covering tool registration, tool execution, catalog resource availability, and schemas MUST pass without modifications
