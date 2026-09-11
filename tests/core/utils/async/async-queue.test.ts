import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AsyncQueue } from "../../../../src/core/utils/async/async-queue.js";

describe("AsyncQueue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("handles FIFO immediate dequeue of already enqueued items", () => {
    const queue = new AsyncQueue<string>();
    expect(queue.length).toBe(0);
    expect(queue.tryDequeue()).toBeNull();

    queue.enqueue("item-1");
    queue.enqueue("item-2");
    expect(queue.length).toBe(2);

    expect(queue.tryDequeue()).toBe("item-1");
    expect(queue.length).toBe(1);
    expect(queue.tryDequeue()).toBe("item-2");
    expect(queue.length).toBe(0);
    expect(queue.tryDequeue()).toBeNull();
  });

  it("resolves a waiting consumer when an item is enqueued asynchronously", async () => {
    const queue = new AsyncQueue<string>();
    const promise = queue.dequeueWithTimeout(1000);

    expect(queue.length).toBe(0);
    queue.enqueue("async-command");

    const result = await promise;
    expect(result).toBe("async-command");
    expect(queue.length).toBe(0);
  });

  it("resolves to null when dequeue timeout expires with fake timers", async () => {
    const queue = new AsyncQueue<string>();
    const promise = queue.dequeueWithTimeout(500);

    vi.advanceTimersByTime(499);
    expect(queue.length).toBe(0);

    vi.advanceTimersByTime(1);
    const result = await promise;
    expect(result).toBeNull();
  });

  it("clears all buffered items and returns count of removed items", () => {
    const queue = new AsyncQueue<number>();
    queue.enqueue(10);
    queue.enqueue(20);
    queue.enqueue(30);

    expect(queue.length).toBe(3);
    const cleared = queue.clear();
    expect(cleared).toBe(3);
    expect(queue.length).toBe(0);
    expect(queue.tryDequeue()).toBeNull();
  });

  it("maintains FIFO ordering among multiple waiting consumers", async () => {
    const queue = new AsyncQueue<string>();
    const results: string[] = [];

    const promise1 = queue.dequeueWithTimeout(2000).then((val) => {
      if (val !== null) results.push(val);
    });
    const promise2 = queue.dequeueWithTimeout(2000).then((val) => {
      if (val !== null) results.push(val);
    });
    const promise3 = queue.dequeueWithTimeout(2000).then((val) => {
      if (val !== null) results.push(val);
    });

    queue.enqueue("first");
    queue.enqueue("second");
    queue.enqueue("third");

    await Promise.all([promise1, promise2, promise3]);
    expect(results).toEqual(["first", "second", "third"]);
    expect(queue.length).toBe(0);
  });

  it("cleans up timeout timer on successful dequeue avoiding timer leak", async () => {
    const queue = new AsyncQueue<string>();
    const promise = queue.dequeueWithTimeout(5000);

    queue.enqueue("resolved-fast");
    const result = await promise;
    expect(result).toBe("resolved-fast");

    // Advance past timeout; should not throw or cause any dangling action
    vi.advanceTimersByTime(6000);
    expect(queue.length).toBe(0);
  });

  it("cancels timeout timer and prevents timer leak when consumer resolves before timeout expires", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const queue = new AsyncQueue<string>();

    const promise = queue.dequeueWithTimeout(50);
    expect(vi.getTimerCount()).toBe(1);

    queue.enqueue("immediate-item");
    const result = await promise;

    expect(result).toBe("immediate-item");
    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);

    vi.advanceTimersByTime(100);
    expect(vi.getTimerCount()).toBe(0);
    expect(queue.length).toBe(0);
  });

  it("reports length for buffered items only, not pending waiters", async () => {
    const queue = new AsyncQueue<string>();
    expect(queue.length).toBe(0);

    const waitPromise1 = queue.dequeueWithTimeout(1000);
    const waitPromise2 = queue.dequeueWithTimeout(1000);
    expect(queue.length).toBe(0); // Waiters don't increase length

    queue.enqueue("item-a"); // Fulfills waitPromise1
    expect(queue.length).toBe(0);

    queue.enqueue("item-b"); // Fulfills waitPromise2
    expect(queue.length).toBe(0);

    queue.enqueue("item-c"); // No waiters, buffered!
    expect(queue.length).toBe(1);

    expect(await waitPromise1).toBe("item-a");
    expect(await waitPromise2).toBe("item-b");
    expect(queue.tryDequeue()).toBe("item-c");
    expect(queue.length).toBe(0);
  });

  it("clear does not cancel pending waiting consumers", async () => {
    const queue = new AsyncQueue<string>();
    const waitPromise = queue.dequeueWithTimeout(1000);

    const cleared = queue.clear();
    expect(cleared).toBe(0);

    queue.enqueue("after-clear");
    const res = await waitPromise;
    expect(res).toBe("after-clear");
  });
});
