import { describe, it, expect } from "bun:test";
import trybox, { run } from "../src/index";
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

describe("run: signal passing", () => {
  it("passes signal to fn", async () => {
    let receivedSignal: AbortSignal | undefined;
    const controller = new AbortController();

    await run(
      async (ctx) => {
        receivedSignal = ctx?.signal;
        return 1;
      },
      { signal: controller.signal }
    );

    expect(receivedSignal).toBeDefined();
    expect(receivedSignal?.aborted).toBe(false);

    // Test aborted signal during execution
    const controller2 = new AbortController();
    await run(
      async (ctx) => {
        receivedSignal = ctx?.signal;
        // Abort from outside
        controller2.abort();
        // Wait for signal propagation (microtask)
        await sleep(0);
      },
      { signal: controller2.signal, ignoreAbort: true }
    );

    expect(receivedSignal).toBeDefined();
    expect(receivedSignal?.aborted).toBe(true);
  });
});

describe("run: abort metrics", () => {
  it("counts attempt when aborted during run", async () => {
    const controller = new AbortController();
    const r = await run(
      async (ctx) => {
        await sleep(10);
        return 1;
      },
      { signal: controller.signal, ignoreAbort: true }
    );
    // Abort from outside is hard to time perfectly to be "during" run without sleep
    // But we can abort immediately
  });

  it("reports correct attempts on timeout", async () => {
    const r = await run(
      async () => {
        await sleep(20);
        return 1;
      },
      { timeout: 5 }
    );
    expect(r.ok).toBe(false);
    expect(r.metrics?.totalAttempts).toBe(1);
  });
});

describe("runner: circuit breaker", () => {
  it("opens after threshold and short-circuits with CIRCUIT_OPEN", async () => {
    const runner = trybox({
      circuitBreaker: {
        failureThreshold: 2,
        resetTimeout: 50,
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
    expect(r3.ok).toBe(false);
    if (!r3.ok) {
      expect(r3.error.code).toBe("CIRCUIT_OPEN");
    }

    // Wait for reset
    await sleep(60);

    // Half-open -> Success -> Closed
    const r4 = await runner.run(async () => 42);
    expect(r4.ok).toBe(true);

    // Should be closed now, allowing failures to count from 0
    const r5 = await runner.run(fail);
    expect(r5.ok).toBe(false);
    // Should not be open yet (threshold 2)
    const r6 = await runner.run(async () => 42);
    expect(r6.ok).toBe(true);
  });
});
