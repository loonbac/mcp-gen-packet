import { existsSync } from "node:fs";
import { join } from "node:path";

export function checkBridgeStatus(): { connected: boolean; message: string } {
  // Try to connect to WS port 9090
  // For now, return disconnected (bridge check happens at runtime)
  return { connected: false, message: "El estado del bridge solo se puede verificar cuando el servidor MCP está en ejecución" };
}

export function getPtExtensionPath(projectPath: string): string {
  return join(projectPath, "pt-extension", "BridgeBuilder.pts");
}

export function checkPtExtension(projectPath: string): boolean {
  return existsSync(getPtExtensionPath(projectPath));
}

export function getBridgeGuide(projectPath: string): string[] {
  return [
    "",
    "  Para instalar BridgeBuilder en Packet Tracer:",
    "",
    "  1. Abre Cisco Packet Tracer",
    "  2. Ve a: Extensions > Scripting > Configure PT Script Modules",
    "  3. Haz clic en 'Add...' y selecciona:",
    `     ${getPtExtensionPath(projectPath)}`,
    "  4. Haz clic en OK",
    "  5. La ventana del bridge se abrirá automáticamente al iniciar PT la próxima vez",
    "",
    "  ¡Listo! No se requiere configuración.",
    "",
  ];
}