import { describe, it, expect, expectTypeOf } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// Canonical type imports
import type {
  BridgeRequest as CanonicalBridgeRequest,
  BridgeResponse as CanonicalBridgeResponse,
  ExecutionMode as CanonicalExecutionMode,
} from "../../../src/core/types/bridge.js";
import type { ToolResult as CanonicalToolResult } from "../../../src/core/types/tools.js";
import type {
  DeviceEntry as CanonicalDeviceEntry,
  ModuleEntry as CanonicalModuleEntry,
  LinkTypeEntry as CanonicalLinkTypeEntry,
  DeviceCategory as CanonicalDeviceCategory,
} from "../../../src/core/types/catalog.js";
import type {
  TopologyDevice as CanonicalTopologyDevice,
  TopologyLink as CanonicalTopologyLink,
  VlanSpec as CanonicalVlanSpec,
  LanSegmentConfig as CanonicalLanSegmentConfig,
} from "../../../src/core/types/topology.js";
import type { BridgeAdapter as CanonicalBridgeAdapter } from "../../../src/bridge/adapter.js";

// Historical protocol façade imports
import type {
  BridgeRequest as FacadeBridgeRequest,
  BridgeResponse as FacadeBridgeResponse,
  ExecutionMode as FacadeExecutionMode,
  ToolResult as FacadeToolResult,
  DeviceEntry as FacadeDeviceEntry,
  ModuleEntry as FacadeModuleEntry,
  LinkTypeEntry as FacadeLinkTypeEntry,
  DeviceCategory as FacadeDeviceCategory,
  TopologyDevice as FacadeTopologyDevice,
  TopologyLink as FacadeTopologyLink,
  VlanSpec as FacadeVlanSpec,
  LanSegmentConfig as FacadeLanSegmentConfig,
  BridgeAdapter as FacadeBridgeAdapter,
} from "../../../src/types/protocol.js";

describe("Protocol Façade and Atomic Domain Types Compatibility", () => {
  describe("Canonical Domain Type Files Presence", () => {
    it("verifies canonical domain type files exist on disk", () => {
      const bridgePath = path.resolve(process.cwd(), "src/core/types/bridge.ts");
      const toolsPath = path.resolve(process.cwd(), "src/core/types/tools.ts");
      const catalogPath = path.resolve(process.cwd(), "src/core/types/catalog.ts");
      const topologyPath = path.resolve(process.cwd(), "src/core/types/topology.ts");

      expect(fs.existsSync(bridgePath)).toBe(true);
      expect(fs.existsSync(toolsPath)).toBe(true);
      expect(fs.existsSync(catalogPath)).toBe(true);
      expect(fs.existsSync(topologyPath)).toBe(true);
    });
  });

  describe("Bridge Domain Types", () => {
    it("asserts type identity between canonical bridge types and façade", () => {
      expectTypeOf<FacadeBridgeRequest>().toEqualTypeOf<CanonicalBridgeRequest>();
      expectTypeOf<FacadeBridgeResponse>().toEqualTypeOf<CanonicalBridgeResponse>();
      expectTypeOf<FacadeExecutionMode>().toEqualTypeOf<CanonicalExecutionMode>();
    });

    it("verifies ExecutionMode union values", () => {
      expectTypeOf<"live">().toMatchTypeOf<CanonicalExecutionMode>();
      expectTypeOf<"script">().toMatchTypeOf<CanonicalExecutionMode>();
      expectTypeOf<"other">().not.toMatchTypeOf<CanonicalExecutionMode>();
    });
  });

  describe("Tool Domain Types", () => {
    it("asserts type identity between canonical ToolResult and façade", () => {
      expectTypeOf<FacadeToolResult>().toEqualTypeOf<CanonicalToolResult>();
    });

    it("supports generic type parameter default and specialization", () => {
      expectTypeOf<FacadeToolResult>().toEqualTypeOf<CanonicalToolResult<unknown>>();
      expectTypeOf<FacadeToolResult<{ message: string }>>().toEqualTypeOf<
        CanonicalToolResult<{ message: string }>
      >();

      const typedResult: CanonicalToolResult<{ count: number }> = {
        mode: "live",
        data: { count: 42 },
      };
      expectTypeOf(typedResult.data).toEqualTypeOf<{ count: number }>();
      expectTypeOf(typedResult.mode).toEqualTypeOf<CanonicalExecutionMode>();
    });
  });

  describe("Catalog Domain Types", () => {
    it("asserts type identity between canonical catalog types and façade", () => {
      expectTypeOf<FacadeDeviceEntry>().toEqualTypeOf<CanonicalDeviceEntry>();
      expectTypeOf<FacadeModuleEntry>().toEqualTypeOf<CanonicalModuleEntry>();
      expectTypeOf<FacadeLinkTypeEntry>().toEqualTypeOf<CanonicalLinkTypeEntry>();
      expectTypeOf<FacadeDeviceCategory>().toEqualTypeOf<CanonicalDeviceCategory>();
    });

    it("verifies exhaustive DeviceCategory union members", () => {
      const allCategories: readonly CanonicalDeviceCategory[] = [
        "router",
        "switch",
        "cloud",
        "bridge",
        "hub",
        "repeater",
        "coaxialsplitter",
        "accesspoint",
        "pc",
        "server",
        "printer",
        "wirelessrouter",
        "ipphone",
        "dslmodem",
        "cablemodem",
        "multilayerswitch",
        "laptop",
        "tabletpc",
        "smartphone",
        "wirelessenddevice",
        "wiredenddevice",
        "tv",
        "homevoip",
        "analogphone",
        "asa",
        "thing",
        "other",
      ] as const;

      expect(allCategories).toHaveLength(27);
      for (const cat of allCategories) {
        expectTypeOf(cat).toMatchTypeOf<CanonicalDeviceCategory>();
      }
      expectTypeOf<"invalid-category">().not.toMatchTypeOf<CanonicalDeviceCategory>();
    });
  });

  describe("Topology Domain Types", () => {
    it("asserts type identity between canonical topology types and façade", () => {
      expectTypeOf<FacadeTopologyDevice>().toEqualTypeOf<CanonicalTopologyDevice>();
      expectTypeOf<FacadeTopologyLink>().toEqualTypeOf<CanonicalTopologyLink>();
      expectTypeOf<FacadeVlanSpec>().toEqualTypeOf<CanonicalVlanSpec>();
      expectTypeOf<FacadeLanSegmentConfig>().toEqualTypeOf<CanonicalLanSegmentConfig>();
    });
  });

  describe("BridgeAdapter Façade Re-export", () => {
    it("asserts type identity for BridgeAdapter", () => {
      expectTypeOf<FacadeBridgeAdapter>().toEqualTypeOf<CanonicalBridgeAdapter>();
    });

    it("verifies BridgeAdapter method signatures and decoupling", () => {
      expectTypeOf<CanonicalBridgeAdapter["getMode"]>().returns.toEqualTypeOf<CanonicalExecutionMode>();
      expectTypeOf<CanonicalBridgeAdapter["execute"]>().returns.toEqualTypeOf<
        Promise<CanonicalToolResult>
      >();
      expectTypeOf<CanonicalBridgeAdapter["isConnected"]>().returns.toEqualTypeOf<boolean>();
    });
  });

  describe("Pure Re-export Façade Verification (Zero Runtime Code)", () => {
    it("verifies protocol.ts has zero runtime value exports", async () => {
      const protocolModule = await import("../../../src/types/protocol.js");
      const runtimeKeys = Object.keys(protocolModule).filter(
        (key) => key !== "default"
      );
      expect(runtimeKeys).toEqual([]);
    });

    it("verifies protocol.ts source contains only type-only re-exports", () => {
      const protocolSourcePath = path.resolve(
        process.cwd(),
        "src/types/protocol.ts"
      );
      const content = fs.readFileSync(protocolSourcePath, "utf-8");

      // Verify no runtime variable, function, or class declarations
      expect(content).not.toMatch(/export\s+(const|let|var|function|class)\s+/);
      // Verify all exports are type exports
      const exportLines = content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("export "));

      expect(exportLines.length).toBeGreaterThan(0);
      for (const line of exportLines) {
        expect(line.startsWith("export type")).toBe(true);
      }
    });
  });
});
