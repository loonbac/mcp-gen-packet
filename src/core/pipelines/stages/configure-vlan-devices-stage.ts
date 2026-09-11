import type { Stage } from "../pipeline.js";
import type { NetworkContext, PlannedOperation } from "../types.js";

/**
 * Generates switch IOS VLAN configuration commands and switch gateway IP operations.
 */
export class ConfigureVlanDevicesStage implements Stage<NetworkContext> {
  execute(context: Readonly<NetworkContext>): NetworkContext {
    const vlanPlans = context.vlanPlans.map((plan) => {
      const vlanCommands = [
        `vlan ${plan.allocation.vlan.id}`,
        `name ${plan.allocation.vlan.name}`,
        "exit",
      ];

      const switchOperations: PlannedOperation[] = [
        {
          method: "configure_ios_device",
          params: {
            device: plan.switchName,
            commands: vlanCommands.join("\n"),
          },
        },
        {
          method: "configure_pc_ip",
          params: {
            device: plan.switchName,
            ip: plan.allocation.gatewayIp,
            subnetMask: "255.255.255.0",
          },
        },
      ];

      return { ...plan, switchOperations };
    });

    return {
      ...context,
      vlanPlans,
    };
  }
}
