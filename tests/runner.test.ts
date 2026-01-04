import { describe, it, expect } from "bun:test";
import { run, createRunner } from "../src/index";
import { computeBackoffDelay } from "../src/utils";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("run: success", () => {
  it("returns ok:true with data", async () => {
    const r = await run(async () => 42);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toBe(42);
  });
});

describe("run: abort", () => {
  it("aborts immediately when signal is aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const r = await run(
      async () => {
        await sleep(10);
        return 1;
      },
      { signal: controller.signal, ignoreAbort: true }
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("ABORTED");
  });
});

describe("run: timeout", () => {
  it("times out with TimeoutError mapping", async () => {
    const r = await run(
      async () => {
        await sleep(50);
        return "done";
      },
      { timeout: 10 }
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("TIMEOUT");
  });
});

describe("utils: backoff", () => {
  it("computes linear/exponential/fibonacci", () => {
    expect(computeBackoffDelay("linear", 100, 3)).toBe(100);
    expect(computeBackoffDelay("exponential", 100, 3)).toBe(400);
    expect(computeBackoffDelay("fibonacci", 100, 5)).toBe(500);
  });
});

describe("runner: circuit breaker", () => {
  it("opens after threshold and short-circuits", async () => {
    const runner = createRunner({
      circuitBreaker: {
        failureThreshold: 2,
        resetTimeout: 1000,
        halfOpenRequests: 1,
      },
    });
    const fail = async () => {
      throw new Error("boom");
    };
    const r1 = await runner.run(fail);
    const r2 = await runner.run(fail);
    const r3 = await runner.run(async () => 1);
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
    expect(r3.ok).toBe(false); // short-circuited
  });
});
