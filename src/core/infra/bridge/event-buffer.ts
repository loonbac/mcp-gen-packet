import type { BridgeEvent, EventBufferPort } from "../../ports/event-buffer-port.js";

export type EventClock = () => Date;

/**
 * Concrete circular telemetry buffer maintaining a bounded FIFO queue of events.
 */
export class EventBuffer implements EventBufferPort {
  private readonly capacity: number;
  private readonly clock: EventClock;
  private readonly events: BridgeEvent[] = [];
  private lastEvent = "idle";

  constructor(capacity: number = 400, clock: EventClock = () => new Date()) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError(
        `EventBuffer capacity must be a positive integer, got ${capacity}`,
      );
    }
    this.capacity = capacity;
    this.clock = clock;
  }

  /**
   * Push an event with ISO-8601 timestamp and update lastEvent.
   * Evicts the oldest entry if capacity is exceeded (FIFO).
   */
  push(kind: string, detail: string): void {
    this.lastEvent = kind;
    this.events.push({
      ts: this.clock().toISOString(),
      kind,
      detail,
    });

    while (this.events.length > this.capacity) {
      this.events.shift();
    }
  }

  /**
   * Update lastEvent and append event record (delegates to push).
   */
  setEvent(kind: string, detail: string): void {
    this.push(kind, detail);
  }

  /**
   * Identifier of the last recorded event, or "idle" if empty/cleared.
   */
  getLastEvent(): string {
    return this.lastEvent;
  }

  /**
   * Retrieve recent events in chronological order.
   * Returns a copy to preserve immutability of the internal buffer.
   */
  getRecent(limit?: number): BridgeEvent[] {
    if (limit === undefined) {
      return [...this.events];
    }
    const boundedLimit = Math.max(0, Math.floor(limit));
    if (boundedLimit === 0) {
      return [];
    }
    return this.events.slice(-boundedLimit);
  }

  /**
   * Current number of retained events in the buffer.
   */
  get size(): number {
    return this.events.length;
  }

  /**
   * Clear all retained events and reset lastEvent to "idle".
   */
  clear(): void {
    this.events.length = 0;
    this.lastEvent = "idle";
  }
}
