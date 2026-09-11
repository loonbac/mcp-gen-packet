import { describe, it, expect } from "vitest";
import { ptBridgeConnectTool } from "../../../../src/tools/primitive/bridge-connect.js";
import { LiveBridge } from "../../../../src/bridge/live.js";
import { getBootstrapScript } from "../../../../src/core/utils/pt/bootstrap-script.js";
import type { BridgeAdapter } from "../../../../src/bridge/adapter.js";

describe("Bootstrap script delegations", () => {
  it("ptBridgeConnectTool delegates code generation directly to getBootstrapScript()", async () => {
    const mockBridge = {} as BridgeAdapter;
    const result = await ptBridgeConnectTool.execute(mockBridge, {});

    expect(result.mode).toBe("script");
    expect(result.code).toBe(getBootstrapScript());
  });

  it("LiveBridge delegates bootstrapScript() with custom host and port to getBootstrapScript({ host, port })", () => {
    const host = "192.168.1.100";
    const port = 8080;
    const bridge = new LiveBridge(host, port);

    expect(bridge.bootstrapScript()).toBe(getBootstrapScript({ host, port }));
  });

  it("LiveBridge delegates bootstrapScript() with default parameters to getBootstrapScript({ host: '127.0.0.1', port: 54321 })", () => {
    const defaultBridge = new LiveBridge();

    expect(defaultBridge.bootstrapScript()).toBe(
      getBootstrapScript({ host: "127.0.0.1", port: 54321 }),
    );
  });
});
