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
