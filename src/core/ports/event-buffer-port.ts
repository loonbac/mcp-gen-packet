/**
 * Telemetry log event captured by the bridge.
 */
export interface BridgeEvent {
  ts: string;
  kind: string;
  detail: string;
}

/**
 * Minimal consumer-driven port for telemetry event buffering and retrieval (ISP).
 */
export interface EventBufferPort {
  /** Push an event with ISO-8601 timestamp and update lastEvent */
  push(kind: string, detail: string): void;

  /** Set lastEvent and append event record */
  setEvent(kind: string, detail: string): void;

  /** Get the identifier of the last recorded event */
  getLastEvent(): string;

  /** Get recent events in chronological order, optionally limited to last N entries */
  getRecent(limit?: number): BridgeEvent[];

  /** Current number of events retained in the buffer */
  readonly size: number;

  /** Clear all events and reset lastEvent to "idle" */
  clear(): void;
}
