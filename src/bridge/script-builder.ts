// ── Script builder: maps MCP tool calls to PTBuilder JS code ──
// Single-line `__mcpLastResult=` assignments (design D7). No XHR/fetch/arrows.

function esc(value: string): string {
  return JSON.stringify(value);
}

const READ_METHODS = new Set([
  "get_devices",
  "get_pc_config",
  "get_device_state",
  "get_topology",
  "get_device_config",
]);

export type BuildScriptOptions = {
  requestId: string;
  ts: number;
};

export function buildScript(
  method: string,
  params: Record<string, unknown>,
  options?: BuildScriptOptions
): string {
  if (!options) {
    return buildCall(method, params) + ";";
  }

  const { requestId, ts } = options;
  const id = esc(requestId);
  const m = esc(method);
  const tsLit = String(ts);

  if (READ_METHODS.has(method)) {
    return buildReadDispatch(buildCall(method, params), id, m, tsLit);
  }

  return buildWriteWrapper(buildCall(method, params), id, m, tsLit);
}

function buildCall(method: string, params: Record<string, unknown>): string {
  switch (method) {
    case "add_device": {
      const name = String(params.name ?? "");
      const model = String(params.model ?? "");
      const x = Number(params.x ?? 100);
      const y = Number(params.y ?? 100);
      return `addDevice(${esc(name)}, ${esc(model)}, ${x}, ${y})`;
    }

    case "add_link": {
      const d1 = String(params.device1 ?? "");
      const i1 = String(params.interface1 ?? "");
      const d2 = String(params.device2 ?? "");
      const i2 = String(params.interface2 ?? "");
      const lt = String(params.type ?? "straight");
      return `addLink(${esc(d1)}, ${esc(i1)}, ${esc(d2)}, ${esc(i2)}, ${esc(lt)})`;
    }

    case "add_module": {
      const device = String(params.device ?? "");
      const slot = Number(params.slot ?? 0);
      const model = String(params.model ?? "");
      return `addModule(${esc(device)}, ${slot}, ${esc(model)})`;
    }

    case "configure_pc_ip": {
      const device = String(params.device ?? "");
      const dhcp = Boolean(params.dhcp);
      const ip = params.ip ? esc(String(params.ip)) : "undefined";
      const mask = params.subnetMask ? esc(String(params.subnetMask)) : "undefined";
      const gw = params.gateway ? esc(String(params.gateway)) : "undefined";
      const dns = params.dnsServer ? esc(String(params.dnsServer)) : "undefined";
      return `configurePcIp(${esc(device)}, ${dhcp}, ${ip}, ${mask}, ${gw}, ${dns})`;
    }

    case "configure_ios_device": {
      const device = String(params.device ?? "");
      const commands = String(params.commands ?? "");
      return `configureIosDevice(${esc(device)}, ${esc(commands)})`;
    }

    case "get_devices": {
      const filter = params.filter ? esc(String(params.filter)) : "undefined";
      const prefix = params.startsWith ? esc(String(params.startsWith)) : '""';
      return `getDevices(${filter}, ${prefix})`;
    }

    case "get_pc_config": {
      const device = esc(String(params.device ?? ""));
      return `getPcConfig(${device})`;
    }

    case "get_device_state": {
      const device = esc(String(params.device ?? ""));
      return `getDeviceState(${device})`;
    }

    case "get_topology":
      return `getTopology()`;

    case "get_device_config": {
      const device = esc(String(params.device ?? ""));
      const start = Number(params.start ?? 0);
      const end = Number(params.end ?? 4096);
      return `getDeviceConfig(${device}, ${start}, ${end})`;
    }

    default:
      return `// Unknown method: ${method}`;
  }
}

function buildWriteWrapper(call: string, id: string, m: string, ts: string): string {
  // D7 plan B: the pump stringifies the evalExpr value with String(), so the
  // envelope MUST cross the IPC as a JSON string, not an object literal
  // (object literals arrive as "[object Object]" and get dropped).
  return (
    `__mcpLastResult=(function(){try{var __r=${call};if(__r===false){throw 0;}` +
    `return JSON.stringify({requestId:${id},method:${m},ok:true,data:{},ts:${ts}});` +
    `}catch(__e){return JSON.stringify({requestId:${id},method:${m},ok:false,error:"PT command failed",ts:${ts}});}})();`
  );
}

function buildReadDispatch(call: string, id: string, m: string, ts: string): string {
  const closeIdx = call.lastIndexOf(")");
  const head = call.slice(0, closeIdx);
  const isEmpty = head.endsWith("(");
  const sep = isEmpty ? "" : ",";
  return `__mcpLastResult=${head}${sep}${id},${m},${ts}${call.slice(closeIdx)};`;
}
