import * as p from "@clack/prompts";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { detectSystem } from "./detect.js";
import { runInstall } from "./install.js";
import { configureClients } from "./configure.js";
import { checkPtExtension, getBridgeGuide } from "./bridge.js";
import { ALL_CLIENTS } from "./clients/index.js";

async function main() {
  // ASCII art banner
  p.intro(`
    ███╗   ███╗ ██████╗██████╗       ██████╗ ████████╗██████╗
    ████╗ ████║██╔════╝██╔══██╗      ██╔══██╗╚══██╔══╝██╔══██╗
    ██╔████╔██║██║     ██████╔╝█████╗██████╔╝   ██║   ██████╔╝
    ██║╚██╔╝██║██║     ██╔═══╝ ╚════╝██╔═══╝    ██║   ██╔══██╗
    ██║ ╚═╝ ██║╚██████╗██║           ██║        ██║   ██████╔╝
    ╚═╝     ╚═╝ ╚═════╝╚═╝           ╚═╝        ╚═╝   ╚═════╝
                    v0.1.0 — por loonbac21
  `);

  // 0. Check if dist/index.js exists, auto-build if not
  const mainScriptPath = join(process.cwd(), "dist", "index.js");
  if (!existsSync(mainScriptPath)) {
    p.log.warn("dist/index.js no encontrado. Ejecutando build...");
    const { execSync } = await import("node:child_process");
    try {
      execSync("npm run build", { stdio: "inherit", cwd: process.cwd() });
    } catch {
      p.cancel("Build fallido. Ejecuta 'npm run build' manualmente.");
      process.exit(1);
    }
    if (!existsSync(mainScriptPath)) {
      p.cancel("Build no generó dist/index.js");
      process.exit(1);
    }
    p.log.success("Build completado");
  }

  // 1. Detect
  const s1 = p.spinner();
  s1.start("Detectando sistema...");
  const detection = detectSystem();
  s1.stop("Detección completa");

  if (!detection.nodeOk) {
    p.cancel("Se requiere Node.js >= 18. Instala desde https://nodejs.org");
    process.exit(1);
  }

  p.log.success(`Node.js ${detection.nodeVersion}`);

  // 2. Select clients — show ALL 12 with detection status
  const detectedIds = ALL_CLIENTS.filter(c => c.detect()).map(c => c.id);

  const options = ALL_CLIENTS.map(c => ({
    value: c.id,
    label: c.name,
    hint: c.detect() ? "✅ detectado" : "❌ no detectado",
  }));

  const selected = await p.multiselect({
    message: "¿Qué clientes quieres configurar?",
    options,
    required: false,
    initialValues: detectedIds,
  });

  if (p.isCancel(selected)) { p.cancel("Cancelado"); process.exit(0); }

  // 3. Install deps + build
  const s2 = p.spinner();
  s2.start("Instalando dependencias...");
  const installResult = await runInstall();
  if (!installResult.success) {
    s2.stop("Instalación fallida");
    p.cancel(installResult.error || "Error desconocido");
    process.exit(1);
  }
  s2.stop("Dependencias instaladas");

  // 4. Configure clients
  if ((selected as string[]).length > 0) {
    const clientsToConfigure = ALL_CLIENTS.filter(c => (selected as string[]).includes(c.id));
    const s3 = p.spinner();
    s3.start("Configurando clientes...");
    let configResult;
    try {
      configResult = await configureClients(clientsToConfigure, process.cwd());
      s3.stop(`Se configuraron ${configResult.configured}/${clientsToConfigure.length} clientes`);
    } catch (err) {
      s3.stop("Configuración fallida");
      p.log.error(`Error: ${err}`);
      configResult = { configured: 0, results: [] };
    }

    for (const r of configResult.results) {
      if (r.success) {
        p.log.success(`${r.clientName}: configurado`);
      } else {
        p.log.error(`${r.clientName}: ${r.error}`);
      }
    }

    // Show summary
    if (configResult.configured > 0) {
      p.log.info("");
      p.log.info("=== Resumen de Configuración ===");
      for (const r of configResult.results) {
        if (r.success) {
          const client = clientsToConfigure.find(c => c.name === r.clientName);
          const path = client?.configPath() ?? "ruta desconocido";
          p.log.info(`  • ${r.clientName}: ${path}`);
        }
      }
      p.log.info("===============================");
    }
  }

  // 5. Bridge guide
  const hasExtension = checkPtExtension(process.cwd());
  if (hasExtension) {
    p.log.success("BridgeBuilder.pts encontrado");
  }

  const guide = getBridgeGuide(process.cwd());
  for (const line of guide) {
    p.log.info(line);
  }

  p.outro("¡Listo! Reinicia tus clientes MCP para cargar MCP-PTB.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});