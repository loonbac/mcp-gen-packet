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
