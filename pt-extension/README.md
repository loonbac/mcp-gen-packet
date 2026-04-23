# Extensión MCP-PTB Bridge para Packet Tracer

Una extensión que carga PTBuilder original y inyecta el bridge WebSocket en tiempo de ejecución.

## Problema Resuelto

Packet Tracer requiere un archivo `.pts` en formato binario propietario. NO podemos crear un `.pts` desde cero —，我们必须使用原始的 PTBuilder.pts 文件。

## Arquitectura

```
┌──────────────────────────────────────────────────────────────┐
│                    Flujo de Conexión                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Load PTBuilder.pts (original binary, 82KB)               │
│     ├── PTBuilder carga normalmente                         │
│     └── Sin bridge código — usa PTBuilder nativo             │
│                                                              │
│  2. MCP server llama pt_bridge_connect                        │
│     └── Envía bootstrap script via WebSocket/script          │
│                                                              │
│  3. PTBuilder ejecuta: $se('runCode', bootstrapScript)       │
│     └── Inyecta WebSocket client en PT webview               │
│                                                              │
│  4. Bridge conecta a ws://localhost:9090                     │
│     └── bidirectional communication                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Instalación

1. **Copia el archivo `BridgeBuilder.pts`** a tu carpeta de extensiones de Packet Tracer:
   - Ubicación típica: `C:\Program Files\Cisco Packet Tracer 7.x\extensions\`

2. **Abre Packet Tracer**

3. Ve a **Extensions → Scripting → Configure PT Script Modules**

4. Haz clic en **Add**

5. Selecciona `BridgeBuilder.pts`

6. Haz clic en **OK**

7. **Reinicia Packet Tracer**

## Uso

### Paso 1: Iniciar el servidor MCP

```bash
cd MCP-PTB
npm start
```

### Paso 2: Conectar el bridge (primera vez o tras reiniciar PT)

Desde tu cliente MCP, llama a la herramienta:

```json
{
  "name": "packet_tracer_bridge_connect",
  "arguments": {}
}
```

O si estás usando el CLI:

```bash
mcp-cli call packet_tracer_bridge_connect
```

### Paso 3: Usar las herramientas MCP

Una vez conectado, puedes usar todas las herramientas:

```json
// Agregar un router
{
  "name": "packet_tracer_add_device",
  "arguments": {
    "name": "R1",
    "model": "2911",
    "x": 200,
    "y": 200
  }
}

// Agregar un switch
{
  "name": "packet_tracer_add_device", 
  "arguments": {
    "name": "S1",
    "model": "2960-24TT",
    "x": 400,
    "y": 200
  }
}

// Conectarlos
{
  "name": "packet_tracer_add_link",
  "arguments": {
    "device1": "R1",
    "interface1": "GigabitEthernet0/0",
    "device2": "S1",
    "interface2": "FastEthernet0/1"
  }
}
```

## Herramientas Disponibles

| Herramienta | Descripción |
|-------------|-------------|
| `packet_tracer_bridge_connect` | Inyecta el bridge WebSocket en PTBuilder |
| `packet_tracer_add_device` | Agrega un dispositivo |
| `packet_tracer_add_link` | Conecta dos dispositivos |
| `packet_tracer_add_module` | Agrega un módulo a un dispositivo |
| `packet_tracer_configure_pc_ip` | Configura IP de un PC |
| `packet_tracer_configure_ios_device` | Envía comandos CLI a dispositivo IOS |
| `packet_tracer_get_devices` | Lista dispositivos |

## Auto-Reconexión

El bridge implementa auto-reconexión:
- Si la conexión WebSocket se pierde, el bridge intenta reconectar automáticamente
- Si el servidor MCP se reinicia, el bridge se reconecta sin necesidad de llamar `pt_bridge_connect` de nuevo

## Solución de Problemas

### "Unable to setContent" error

Este error indica que estás usando un `.pts` incorrecto. Asegúrate de:
1. Usar el `BridgeBuilder.pts` de este repositorio (copiado del PTBuilder original)
2. NO usar archivos concatenados de JavaScript — PT no puede leer texto plano

### pt_bridge_connect retorna error "PT not connected"

Esto es esperado si PTBuilder no está corriendo. Verifica:
1. Packet Tracer está abierto
2. La extensión está cargada (Extensions → Scripting → debe mostrar "PTBuilder")

### Los comandos no se ejecutan

1. Verifica que `pt_bridge_connect` fue llamado exitosamente
2. Verifica que el modelo del dispositivo es correcto
3. Revisa la consola de Packet Tracer por errores

## Estructura de Archivos

```
pt-extension/
├── BridgeBuilder.pts   # Original PTBuilder (copiado de PTBuilder\Builder.pts)
└── README.md           # Este archivo

NOTA: El archivo .pts es el ORIGINAL de PTBuilder, no modificado.
      El bridge se inyecta en tiempo de ejecución via MCP.
```

## Por Qué Esto Funciona

1. **El .pts de PTBuilder es binario propietario** — no podemos crear uno válido
2. **El original PTBuilder.pts funciona** — tiene todas las funciones de automation
3. **El bridge se inyecta** — via `$se('runCode', script)` que ejecuta JavaScript arbitrario
4. **WebSocket bidireccional** — una vez inyectado, el bridge conecta de vuelta al servidor MCP

## Licencia

MIT