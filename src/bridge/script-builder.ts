// ── Script builder: maps MCP tool calls to PTBuilder JS code ──

import { getLinkTypeId } from "../catalogs/links.js";

function esc(value: string): string {
  return JSON.stringify(value);
}

export function buildScript(method: string, params: Record<string, unknown>): string {
  switch (method) {
    case "add_device": {
      const name = String(params.name ?? "");
      const model = String(params.model ?? "");
      const x = Number(params.x ?? 100);
      const y = Number(params.y ?? 100);
      return `addDevice(${esc(name)}, ${esc(model)}, ${x}, ${y});`;
    }

    case "add_link": {
      const d1 = String(params.device1 ?? "");
      const i1 = String(params.interface1 ?? "");
      const d2 = String(params.device2 ?? "");
      const i2 = String(params.interface2 ?? "");
      const lt = String(params.type ?? "straight");
      return `addLink(${esc(d1)}, ${esc(i1)}, ${esc(d2)}, ${esc(i2)}, ${esc(lt)});`;
    }

    case "add_module": {
      const device = String(params.device ?? "");
      const slot = Number(params.slot ?? 0);
      const model = String(params.model ?? "");
      return `addModule(${esc(device)}, ${slot}, ${esc(model)});`;
    }

    case "configure_pc_ip": {
      const device = String(params.device ?? "");
      const dhcp = Boolean(params.dhcp);
      const ip = params.ip ? esc(String(params.ip)) : "undefined";
      const mask = params.subnetMask ? esc(String(params.subnetMask)) : "undefined";
      const gw = params.gateway ? esc(String(params.gateway)) : "undefined";
      const dns = params.dnsServer ? esc(String(params.dnsServer)) : "undefined";
      return `configurePcIp(${esc(device)}, ${dhcp}, ${ip}, ${mask}, ${gw}, ${dns});`;
    }

    case "configure_ios_device": {
      const device = String(params.device ?? "");
      const commands = String(params.commands ?? "");
      return `configureIosDevice(${esc(device)}, ${esc(commands)});`;
    }

    case "get_devices": {
      const filter = params.filter ? esc(String(params.filter)) : "undefined";
      const prefix = params.startsWith ? esc(String(params.startsWith)) : "";
      return `getDevices(${filter}${prefix ? ", " + prefix : ""});`;
    }

    default:
      return `// Unknown method: ${method}`;
  }
}
