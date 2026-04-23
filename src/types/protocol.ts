// ── WebSocket bridge protocol types ──

export interface BridgeRequest {
  id: string;
  method: string;
  params: Record<string, unknown>;
}

export interface BridgeResponse {
  id: string;
  success: boolean;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

// ── Execution modes ──

export type ExecutionMode = "live" | "script";

export interface ToolResult<T = unknown> {
  mode: ExecutionMode;
  data: T;
  code?: string; // Only in script mode
}

// ── Catalog types ──

export interface DeviceEntry {
  model: string;
  typeId: number;
  category: DeviceCategory;
}

export interface ModuleEntry {
  model: string;
  typeId: number;
}

export interface LinkTypeEntry {
  name: string;
  id: number;
  aliases: string[];
}

export type DeviceCategory =
  | "router"
  | "switch"
  | "cloud"
  | "bridge"
  | "hub"
  | "repeater"
  | "coaxialsplitter"
  | "accesspoint"
  | "pc"
  | "server"
  | "printer"
  | "wirelessrouter"
  | "ipphone"
  | "dslmodem"
  | "cablemodem"
  | "multilayerswitch"
  | "laptop"
  | "tabletpc"
  | "smartphone"
  | "wirelessenddevice"
  | "wiredenddevice"
  | "tv"
  | "homevoip"
  | "analogphone"
  | "asa"
  | "thing"
  | "other";

// ── Network topology types ──

export interface TopologyDevice {
  name: string;
  model: string;
  x: number;
  y: number;
  interfaces?: string[];
}

export interface TopologyLink {
  device1: string;
  interface1: string;
  device2: string;
  interface2: string;
  type: string;
}

export interface VlanSpec {
  id: number;
  name: string;
}

export interface LanSegmentConfig {
  name: string;
  subnet: string;
  hosts: number;
  gateway?: string;
}
