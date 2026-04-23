export interface SystemDetection {
  nodeVersion: string;
  nodeOk: boolean;
  platform: string;
  arch: string;
}

export function detectSystem(): SystemDetection {
  const version = process.version;
  const major = parseInt(version.slice(1).split(".")[0], 10);
  
  return {
    nodeVersion: version,
    nodeOk: major >= 18,
    platform: process.platform,
    arch: process.arch,
  };
}