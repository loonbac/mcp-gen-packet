# SDD Explore: micro-modular-alignment

**Change**: `micro-modular-alignment`  
**Workspace**: `/home/loonbac/Proyectos/mcp-gen-packet`  
**Date**: March 2025  
**Review Budget**: 400 lines  
**Delivery Strategy**: ask-on-risk  
**Execution Mode**: auto  
**Test Suite Status**: 125 tests passing across 10 test files (`npm test` / vitest)  

---

## 1. Executive Summary

El proyecto **MCP-PTB** implementa un servidor MCP que permite automatizar Cisco Packet Tracer mediante un puente PTBuilder (soporte en vivo por HTTP polling y respaldo por scripts `.pkt`), con autolayout, catálogos de dispositivos/módulos/enlaces/interfaces, instalador TUI para 12 clientes y herramientas compuestas.

Aunque el proyecto cuenta con una cobertura de pruebas sólida (125 tests unitarios e integración en verde), su arquitectura actual presenta **fuertes desviaciones frente al estándar de micro-modularidad extrema definido en `AGENTS.md`**:

1. **Archivos Dios y Acoplamiento Multicapa:** `src/bridge/live.ts` (433 líneas) concentra servidor HTTP, detección de procesos PowerShell, cola asíncrona en memoria, buffer de eventos, servidor de logs y un dashboard HTML/CSS/JS retro embebido.
2. **Duplicación Sistemática de Código (Boilerplate Copy-Paste):** En `src/tui/clients/`, 12 clientes repiten casi idénticamente 40-50 líneas de lógica de lectura, respaldo `.bak`, mutación JSON y verificación de archivos.
3. **Lógica de Dominio y Cálculo Repetida / Estado Mutable Global:** En `src/tools/composite/`, `create-network.ts` usa una variable global mutable (`let subnetCounter = 1;`), y ambas herramientas compuestas duplican funciones de formateo IP (`calcIp`, `parseSubnet`) en lugar de micro-utilidades puras.
4. **Ausencia de Separación Ports & Adapters y Pipelines:** No existen las capas `ports/`, `infra/`, `use_cases/`, `pipelines/stages/` estipuladas en `AGENTS.md §3.6`. La orquestación en herramientas compuestas y la inyección en clientes se hace en funciones monolíticas secuenciales sin abstracción de etapas encadenables.
5. **Riesgo de Presupuesto (400 líneas):** Una migración en bloque de todo el código afectaría más de 1,500 líneas. Bajo la política `ask-on-risk` y el límite de revisión de 400 líneas, la propuesta debe articular una estrategia de descomposición en slices o chained PRs independientes.

---

## 2. Inventario del Estado Actual

```
src/
├── index.ts                     # 9 líneas - Punto de entrada (startServer + exit)
├── server.ts                    # 197 líneas - Configuración MCP Server, recursos y tools
├── bridge/
│   ├── adapter.ts               # 18 líneas - Interfaz BridgeAdapter
│   ├── index.ts                 # 49 líneas - createBridge + AutoBridge (clase privada)
│   ├── live.ts                  # 433 líneas - LiveBridge (God File)
│   ├── script.ts                # 20 líneas - ScriptBridge
│   └── script-builder.ts        # 56 líneas - Switch monolítico generador de scripts PT
├── catalogs/
│   ├── index.ts                 # 6 líneas - Re-exports
│   ├── devices.ts               # 124 líneas - Map estático + 5 funciones de consulta
│   ├── modules.ts               # 77 líneas - Map estático + 4 funciones de consulta
│   ├── links.ts                 # 90 líneas - Map estático + alias + 4 funciones
│   └── interfaces.ts            # 167 líneas - Map estático + 3 funciones
├── layout/
│   └── auto-layout.ts           # 52 líneas - Algoritmo determinista en rejilla
├── tools/
│   ├── index.ts                 # 25 líneas - Agregador de herramientas y getTool
│   ├── shared/
│   │   └── tool-runner.ts       # 13 líneas - createToolExecutor
│   ├── primitive/
│   │   ├── index.ts             # 45 líneas - Array y lookup
│   │   ├── add-device.ts        # 27 líneas
│   │   ├── add-link.ts          # 32 líneas
│   │   ├── add-module.ts        # 28 líneas
│   │   ├── bridge-connect.ts    # 39 líneas - Duplica script de polling de live.ts
│   │   ├── configure-ios-device.ts # 25 líneas
│   │   ├── configure-pc-ip.ts   # 34 líneas
│   │   └── get-devices.ts       # 32 líneas
│   └── composite/
│       ├── index.ts             # 25 líneas
│       ├── create-lan-segment.ts # 155 líneas - Monolito de orquestación LAN
│       └── create-network.ts    # 178 líneas - Monolito multi-VLAN con estado mutable
├── tui/
│   ├── index.ts                 # 140 líneas - Orquestador CLI Clack interactivo
│   ├── bridge.ts                # 35 líneas - Verificaciones y texto de guía
│   ├── configure.ts             # 37 líneas - Loop sobre clientes
│   ├── constants.ts             # 15 líneas - getMcpServerEntry y CLIENT_CONFIG_PATHS vacío
│   ├── detect.ts                # 20 líneas - Detección Node.js y SO
│   ├── install.ts               # 19 líneas - npm install wrapper
│   └── clients/                 # 12 adaptadores casi clonados (~50 líneas c/u)
│       ├── antigravity.ts, claude.ts, codex.ts, cursor.ts, gemini.ts,
│       ├── kilocode.ts, kimi.ts, kiro.ts, opencode.ts, qwen.ts,
│       ├── vscode.ts, windsurf.ts, index.ts, types.ts
└── types/
    └── protocol.ts              # 104 líneas - 10 interfaces/tipos mezclados
```

---

## 3. Catálogo Detallado de Violaciones a AGENTS.md

### 3.1 Archivo Dios (God File) en `src/bridge/live.ts`
- **Violación**: 433 líneas concentrando múltiples responsabilidades dispares:
  - Estructura de datos concurrente `AsyncQueue` (líneas 12-58).
  - Consulta a procesos externos del sistema operativo vía PowerShell `spawnSync` (líneas 215-231).
  - Servidor HTTP embebido con enrutamiento manual para 7 endpoints (`/next`, `/ping`, `/logs`, `/monitor`, `/status`, `/result`, `/queue`) y CORS (líneas 315-408).
  - Dashboard web embebido con plantilla HTML/CSS/JS de 80 líneas (líneas 258-313).
  - Buffer circular en memoria para 400 eventos de telemetría (líneas 119-136).
  - Lógica de heurística de conexión y estado de Packet Tracer (líneas 233-252).
  - Script bootstrap de polling en texto plano (líneas 193-213).
- **Impacto**: Cualquier cambio en la telemetría, el dashboard o el protocolo HTTP arriesga romper la comunicación del bridge; imposible testear las piezas aisladas con pruebas unitarias puras.

### 3.2 Duplicación Masiva de Código en `src/tui/clients/`
- **Violación**: Los 12 clientes (`cursor.ts`, `claude.ts`, `vscode.ts`, `windsurf.ts`, `gemini.ts`, `codex.ts`, `kilocode.ts`, `kimi.ts`, `kiro.ts`, `qwen.ts`, `antigravity.ts`, `opencode.ts`) repiten una plantilla idéntica:
  - `const backupPath = configPath + ".bak";`
  - `readFileSync(configPath, "utf-8");`
  - `JSON.parse(raw);`
  - `delete config.mcp.MCP_PTB; delete config.mcpServers.MCP_PTB; delete config.servers.MCP_PTB;`
  - `writeFileSync(backupPath, raw, "utf-8");`
  - `writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");`
  - `readFileSync` de nuevo para re-verificar.
- **Impacto**: Viola directamente la máxima de AGENTS.md: *"Si una pieza de código tiene que ser copiada y pegada en otro lugar, no pertenecía a ese archivo: pertenecía a un micro-módulo propio."* Además, cualquier fix en el manejo de respaldo o permisos de archivo debe replicarse manualmente 12 veces.

### 3.3 Estado Global Mutable y Falta de Pureza en `src/tools/composite/create-network.ts`
- **Violación**: Línea 18:
  ```typescript
  let subnetCounter = 1;
  function nextSubnet(): string { ... }
  ```
  En la línea 35 se hace `subnetCounter = 1;` dentro del método `execute`.
- **Impacto**: Estado mutable a nivel de módulo que introduce efectos colaterales, rompe la concurrencia y contradice el principio de funciones puras e idempotentes.

### 3.4 Formato y Cálculo de Red Repetido
- **Violación**: `calcIp(baseIp, index)` está copiado idénticamente en:
  - `src/tools/composite/create-lan-segment.ts` (líneas 32-37)
  - `src/tools/composite/create-network.ts` (líneas 24-29)
  Además, `parseSubnet` vive acoplado dentro de `create-lan-segment.ts`.
- **Impacto**: Viola AGENTS.md §6 ("Lógica de Formato Repetida"). Debe ser una micro-utilidad en `src/utils/network/calc-ip.ts`.

### 3.5 Duplicación del Script Bootstrap entre Bridge y Tools
- **Violación**:
  - `src/bridge/live.ts`: método `bootstrapScript()` (líneas 193-213).
  - `src/tools/primitive/bridge-connect.ts`: constante `BOOTSTRAP_SCRIPT` (líneas 16-17).
  Ambos definen la misma cadena de JavaScript inyectable en Packet Tracer.

### 3.6 Servicios Monolíticos sin Pipelines en Herramientas Compuestas
- **Violación**: `create-lan-segment.ts` (155 líneas) y `create-network.ts` (178 líneas) ejecutan un guion monolítico procedimental:
  1. Parseo de parámetros Zod.
  2. Cálculo manual de direccionamiento IP.
  3. Cálculo de layout de dispositivos.
  4. Acumulación manual de llamadas `add_device`.
  5. Acumulación manual de llamadas `configure_pc_ip` y `configure_ios_device`.
  6. Acumulación manual de llamadas `add_link`.
  7. Loop secuencial de ejecución contra el bridge con `try/catch`.
- **Impacto**: No hay pipelines componibles con etapas reutilizables (`stages/`) como exige AGENTS.md §3.6.

### 3.7 Catálogos con Datos y Funciones Mezcladas
- **Violación**: En `devices.ts`, `modules.ts`, `links.ts`, e `interfaces.ts`, los diccionarios de datos masivos (tablas de modelos) conviven en el mismo archivo con múltiples funciones utilitarias de filtrado y búsqueda (`getDeviceType`, `getDeviceCategory`, `getDevicesByCategory`, `isDeviceModel`, `listDeviceModels`).
- **Impacto**: No cumple la regla "1 función = 1 archivo".

### 3.8 Monolito de Enrutamiento en `src/server.ts`
- **Violación**: `server.ts` (197 líneas) declara el servidor MCP, registra 4 recursos inline con formateo JSON explícito y enlaza las 9 herramientas en un bucle con lógica inline de manejo de errores y serialización de `ToolResult`.

### 3.9 Mezcla de Dominio en `src/types/protocol.ts`
- **Violación**: Un único archivo de 104 líneas agrupa protocolos de transporte del bridge, tipos de ejecución, catálogos y especificaciones de topología física/lógica.

---

## 4. Oportunidades de Atomización por Directorio

Siguiendo estrictamente AGENTS.md (§3.3 Utils, §3.6 Backend Architecture, §4 Test de Atomización):

### 4.1 `src/core/ports/` (Traits / Interfaces Mínimas)
- `bridge-port.ts`: Trait mínimo de ejecución (`execute(method, params): Promise<ToolResult>`, `isConnected(): boolean`, `getMode(): ExecutionMode`).
- `process-detector-port.ts`: Trait mínimo para chequear estado de Packet Tracer (`isRunning(): boolean`).
- `client-injector-port.ts`: Trait para inyección en clientes MCP.

### 4.2 `src/core/utils/` (1 Función = 1 Archivo Puro)
- `utils/network/calc-ip.ts`: `(baseIp: string, hostIndex: number) => string`
- `utils/network/parse-subnet.ts`: `(subnet: string) => { baseIp: string; prefix?: number }`
- `utils/network/subnet-allocator.ts`: Generador puro e inmutable de subredes.
- `utils/async/async-queue.ts`: Cola asíncrona genérica con timeout.
- `utils/fs/backup-file.ts`: Respaldo atómico de archivo a `.bak`.
- `utils/fs/update-json-config.ts`: Lectura segura, patch y verificación de JSON.
- `utils/pt/bootstrap-script.ts`: Fuente única de la cadena JavaScript de polling PT.

### 4.3 `src/core/pipelines/` & `src/core/pipelines/stages/` (Composición)
- `core/pipelines/pipeline.ts`: Ejecutor componible por etapas `.pipe(stage).execute(context)`.
- `stages/network/allocate-subnets-stage.ts`
- `stages/network/generate-devices-stage.ts`
- `stages/network/layout-devices-stage.ts`
- `stages/network/generate-addressing-stage.ts`
- `stages/network/generate-links-stage.ts`
- `stages/network/execute-operations-stage.ts`

### 4.4 `src/core/infra/` (Implementaciones Concretas)
- `infra/bridge/live-http-server.ts`: Servidor Node HTTP puro (sin PowerShell ni UI).
- `infra/bridge/powershell-process-detector.ts`: Implementación de `ProcessDetectorPort`.
- `infra/bridge/bridge-monitor-view.ts`: Generación del HTML retro del monitor aislada.
- `infra/bridge/live-bridge-adapter.ts`: Adaptador que conecta el servidor HTTP y el detector.
- `infra/bridge/script-bridge-adapter.ts`: Generador de scripts.
- `infra/bridge/auto-bridge-adapter.ts`: Router live/script (antes clase privada en index.ts).

### 4.5 `src/core/use_cases/` (1 Caso de Uso = 1 Archivo)
- `use_cases/tools/add-device.ts`
- `use_cases/tools/add-link.ts`
- `use_cases/tools/add-module.ts`
- `use_cases/tools/configure-pc-ip.ts`
- `use_cases/tools/configure-ios-device.ts`
- `use_cases/tools/get-devices.ts`
- `use_cases/tools/bridge-connect.ts`
- `use_cases/tools/create-lan-segment.ts` (compuesto usando Pipeline)
- `use_cases/tools/create-network.ts` (compuesto usando Pipeline)

### 4.6 `src/tui/`
- `tui/core/generic-client-injector.ts`: Motor reutilizable de inyección basado en configuración declarativa.
- `tui/clients/descriptors/`: Cada cliente define únicamente metadatos: ID, nombre, path resolver y formato de clave (`servers` vs `mcpServers` vs archivo propio).
- `tui/steps/detect-step.ts`, `tui/steps/select-step.ts`, `tui/steps/install-step.ts`, `tui/steps/configure-step.ts`.

### 4.7 `src/catalogs/`
- Separar datos estáticos (`data/device-map.ts`, `data/module-map.ts`, etc.) de las funciones de consulta atómicas (`queries/get-device-type.ts`, `queries/get-devices-by-category.ts`).
- Mantener los índices retrocompatibles para no romper ningún test existente.

---

## 5. Riesgos y Restricciones

1. **Riesgo de Presupuesto de Revisión (Threshold: 400 líneas):**
   - El código total a refactorizar supera las 1,500 líneas. Intentar reestructurar todo en un solo cambio rompería categóricamente el presupuesto de 400 líneas.
   - **Mitigación**: Aplicar la disciplina `ask-on-risk` y dividir el cambio en una cadena de etapas/PRs atómicos (por ejemplo: Slice 1 - Micro-utilidades y tipos; Slice 2 - Pipeline y Herramientas compuestas; Slice 3 - TUI e inyectores declarativos; Slice 4 - Bridge y Servidor).
2. **Preservación de la Suite de Pruebas (Strict TDD):**
   - Hay 125 pruebas en 10 archivos. Cualquier cambio de rutas de exportación puede romper suites existentes si no se mantienen re-exports o adaptadores de compatibilidad.
   - **Mitigación**: `per_phase_green: true`. Los contratos públicos originales deben seguir funcionando en cada commit/fase.
3. **Plataforma y Dependencias Nativas (NixOS / Node / PowerShell):**
   - Detección de procesos PowerShell solo aplica en Windows; en Linux/macOS debe degradar limpiamente como actualmente.
   - Herramientas auxiliares de entorno no deben ser ejecutadas si dependen de binarios no enlazados nativamente.

---

## 6. Alcance Recomendado para la Fase Proposal

La propuesta (`openspec/changes/micro-modular-alignment/proposal.md`) debería definir:
1. **Contrato de Arquitectura Modular de Destino**: Estructura canónica de carpetas (`ports/`, `infra/`, `use_cases/`, `pipelines/stages/`, `utils/`, `types/`).
2. **Desglose en Slices Acotados (<400 líneas por slice)**:
   - **Slice 1 (Utils & Pure Helpers)**: Extraer `calc-ip`, `parse-subnet`, `async-queue`, `bootstrap-script` y modularizar `types/`.
   - **Slice 2 (Composite Tools & Pipelines)**: Implementar `Pipeline` con stages y refactorizar `create-lan-segment` y `create-network` eliminando el estado mutable global.
   - **Slice 3 (TUI Client Injector)**: Unificar la inyección de los 12 clientes en un motor genérico declarativo (`update-json-config`).
   - **Slice 4 (Bridge Decomposition & Ports)**: Descomponer `live.ts` en `HttpServer`, `ProcessDetector`, `EventBuffer`, `MonitorView` y `BridgeAdapter`.
   - **Slice 5 (Catalogs & Server Handlers)**: Separar datos de queries en catálogos y extraer handlers de recursos/herramientas en `src/server.ts`.
3. **Estrategia de Retrocompatibilidad**: Política de re-export en índices históricos para que las pruebas pasen en todo momento.

---

## 7. SDD Results & Metadata

- **status**: `explored`
- **executive_summary**: Mapeo exhaustivo del repositorio actual frente a la filosofía de micro-modularidad extrema de AGENTS.md. Se identificaron 9 grupos de violaciones principales (destacando el archivo dios `live.ts` de 433 líneas, duplicación en 12 clientes TUI, estado global mutable y falta de pipelines en herramientas compuestas). Se mapeó la estructura de destino y se estableció la necesidad de encadenar el trabajo en slices para respetar el presupuesto de 400 líneas.
- **artifacts**: `openspec/changes/micro-modular-alignment/explore.md`
- **next_recommended**: Solicitar confirmación de delivery (`ask-on-risk`) para proceder a la fase `proposal` dividida en slices/chained PRs bajo presupuesto de 400 líneas.
- **risks**: Amplitud del refactor vs límite de 400 líneas; riesgo de regresión en 125 tests existentes si los puntos de exportación sufren roturas abruptas.
- **skill_resolution**: `none` (no se inyectaron rutas de habilidades previas en el preflight).
