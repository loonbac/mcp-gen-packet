/**
 * Thread-safe (Node.js event loop race-safe) generic asynchronous FIFO queue.
 * Satisfies oldest pending consumers before buffering; length reports only buffered items.
 */
export class AsyncQueue<T> {
  private items: T[] = [];
  private resolvers: Array<(value: T) => void> = [];

  enqueue(value: T): void {
    const resolver = this.resolvers.shift();
    if (resolver) {
      resolver(value);
      return;
    }
    this.items.push(value);
  }

  tryDequeue(): T | null {
    if (this.items.length === 0) {
      return null;
    }
    return this.items.shift() ?? null;
  }

  async dequeueWithTimeout(timeoutMs: number): Promise<T | null> {
    const existing = this.tryDequeue();
    if (existing !== null) {
      return existing;
    }

    return new Promise<T | null>((resolve) => {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const resolver = (value: T) => {
        if (timeout !== undefined) {
          clearTimeout(timeout);
        }
        resolve(value);
      };

      timeout = setTimeout(() => {
        this.resolvers = this.resolvers.filter((r) => r !== resolver);
        resolve(null);
      }, timeoutMs);

      this.resolvers.push(resolver);
    });
  }

  get length(): number {
    return this.items.length;
  }

  clear(): number {
    const count = this.items.length;
    this.items = [];
    return count;
  }
}
