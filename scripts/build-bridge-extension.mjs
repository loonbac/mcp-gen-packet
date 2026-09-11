import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputDir = path.resolve(root, "config", "bridge");
const bridgeUrl = "http://127.0.0.1:54321";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function write(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf-8");
}

if (fs.existsSync(outputDir)) {
  fs.rmSync(outputDir, { recursive: true, force: true });
}

const bootstrap = `/* Bridge */ window.webview.evaluateJavaScriptAsync("(function(){var w=window;if(w.__PT_MCP_BRIDGE_TIMER){clearInterval(w.__PT_MCP_BRIDGE_TIMER);}w.__PT_MCP_BRIDGE_ERRORS=0;w.__PT_MCP_BRIDGE_TIMER=setInterval(function(){var x=new XMLHttpRequest();x.open('GET','${bridgeUrl}/next',true);x.timeout=1500;x.onload=function(){if(x.status===200){w.__PT_MCP_BRIDGE_ERRORS=0;if(x.responseText){$se('runCode',x.responseText)}return;}w.__PT_MCP_BRIDGE_ERRORS=(w.__PT_MCP_BRIDGE_ERRORS||0)+1;if(w.__PT_MCP_BRIDGE_ERRORS>=6&&w.__PT_MCP_BRIDGE_TIMER){clearInterval(w.__PT_MCP_BRIDGE_TIMER);w.__PT_MCP_BRIDGE_TIMER=null;}};x.onerror=function(){w.__PT_MCP_BRIDGE_ERRORS=(w.__PT_MCP_BRIDGE_ERRORS||0)+1;if(w.__PT_MCP_BRIDGE_ERRORS>=6&&w.__PT_MCP_BRIDGE_TIMER){clearInterval(w.__PT_MCP_BRIDGE_TIMER);w.__PT_MCP_BRIDGE_TIMER=null;}};x.ontimeout=x.onerror;x.send()},350);})();");`;

const install = [
  "Bridge :: Instalación segura",
  "",
  "1) NO reemplaces devices.js, links.js, main.js, modules.js, runcode.js, userfunctions.js, window.js.",
  "2) Inicia MCP server (cmd del proyecto o node dist/index.js).",
  "3) Abre BridgeBuilder desde Extensions > Scripting > Edit File Script Module.",
  "4) Inyecta el bridge con alguna opcion:",
  "   - Opcion A: en Gemini usa pt_bridge_autoconnect {\"dryRun\": false}",
  "   - Opcion B: pega bridge-bootstrap.js y pulsa Run una sola vez",
  "5) Verifica con pt_bridge_status => connected=true.",
  "",
  "Si editaste main.js y desaparecio BridgeBuilder:",
  "- Configure PT Script Modules > selecciona BridgeBuilder > Remove > Add BridgeBuilder.pts"
].join("\n");

const readme = [
  "Bridge Kit",
  "",
  "Contenido:",
  "- bridge-bootstrap.js",
  "- install-steps.txt",
  "",
  "Uso con MCP:",
  "- Ejecuta pt_bridge_status",
  "- Ejecuta pt_bridge_autoconnect (opcional)",
  "- Ejecuta pt_full_build / pt_execute_js"
].join("\n");

write(path.join(outputDir, "bridge-bootstrap.js"), `${bootstrap}\n`);
write(path.join(outputDir, "install-steps.txt"), `${install}\n`);
write(path.join(outputDir, "README.txt"), `${readme}\n`);

console.log(`Bridge extension kit generado en: ${outputDir}`);
