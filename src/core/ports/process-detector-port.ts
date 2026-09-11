/**
 * Minimal consumer-driven port for external process status inspection (ISP).
 */
export interface ProcessDetectorPort {
  /** Check if Packet Tracer is currently running */
  isPacketTracerRunning(): boolean;
}
