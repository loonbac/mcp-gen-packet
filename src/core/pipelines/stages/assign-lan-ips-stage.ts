import type { Stage } from "../pipeline.js";
import type { LanSegmentContext, PlannedOperation } from "../types.js";
import { parseSubnet } from "../../utils/network/parse-subnet.js";
import { calcIp } from "../../utils/network/calc-ip.js";

/**
 * Calculates gateway IP and host IP addresses and appends
 * configure_pc_ip operations for all LAN devices.
 */
export class AssignLanIpsStage implements Stage<LanSegmentContext> {
  execute(context: Readonly<LanSegmentContext>): LanSegmentContext {
    const { baseIp } = parseSubnet(context.input.subnet);
    const gatewayIp = context.input.gateway ?? calcIp(baseIp, 1);
    const gatewayName = context.gatewayName ?? `${context.input.name}-GW`;

    const ipOps: PlannedOperation[] = [
      {
        method: "configure_pc_ip",
        params: {
          device: gatewayName,
          ip: gatewayIp,
          subnetMask: "255.255.255.0",
        },
      },
      ...context.hostNames.map((hostName, i) => ({
        method: "configure_pc_ip",
        params: {
          device: hostName,
          ip: calcIp(baseIp, i + 2),
          subnetMask: "255.255.255.0",
          gateway: gatewayIp,
        },
      })),
    ];

    return {
      ...context,
      baseIp,
      gatewayIp,
      operations: [...context.operations, ...ipOps],
    };
  }
}
