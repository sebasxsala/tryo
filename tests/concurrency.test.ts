import { describe, test, expect } from "bun:test";
import { runAll } from "../src";
import { sleep } from "../src/utils";

describe("Concurrency", () => {
  test("runAll respects concurrency limit", async () => {
    const start = Date.now();
    let active = 0;
    let maxActive = 0;

    const tasks = Array.from({ length: 5 }, (_, i) => async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await sleep(50);
      active--;
      return i;
    });

    const results = await runAll(tasks, { concurrency: 2 });

    const duration = Date.now() - start;

    // With 5 tasks and concurrency 2:
    // Batch 1: 2 tasks (50ms)
    // Batch 2: 2 tasks (50ms)
    // Batch 3: 1 task (50ms)
    // Total min time ~150ms.
    // If unbounded, it would be ~50ms.

    expect(maxActive).toBeLessThanOrEqual(2);
    expect(duration).toBeGreaterThanOrEqual(140); // Allow some jitter
    expect(results).toHaveLength(5);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  test("runAll defaults to unbounded concurrency (Promise.all behavior)", async () => {
    const start = Date.now();
    const tasks = Array.from({ length: 10 }, (_, i) => async () => {
      await sleep(50);
      return i;
    });

    await runAll(tasks); // No concurrency option
    const duration = Date.now() - start;

    // Should take roughly 50ms (plus overhead)
    expect(duration).toBeLessThan(100);
  });
});
