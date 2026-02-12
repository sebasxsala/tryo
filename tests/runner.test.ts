import { describe, expect, it } from 'bun:test';
import type { TryoOptions } from '../src/core/tryo';
import { tryo } from '../src/core/tryo';
import { sleep } from '../src/utils/timing';

const make = (opts: TryoOptions = {}) => tryo(opts);

describe('run: success', () => {
	it('returns ok:true with data', async () => {
		const ex = make();
		const r = await ex.run(async () => 42);
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.data).toBe(42);
	});
});

describe('run: abort', () => {
	it('aborts immediately when signal is aborted', async () => {
		const ex = make();
		const controller = new AbortController();
		controller.abort();
		const r = await ex.run(
			async () => {
				await sleep(10);
				return 1;
			},
			{ signal: controller.signal, ignoreAbort: true },
		);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.code).toBe('ABORTED');
	});
});

describe('run: timeout', () => {
	it('times out with TimeoutError mapping', async () => {
		const ex = make();
		const r = await ex.run(
			async () => {
				await sleep(50);
				return 'done';
			},
			{ timeout: 10 },
		);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.code).toBe('TIMEOUT');
	});
});

describe('run: signal passing', () => {
	it('passes signal to fn', async () => {
		let receivedSignal: AbortSignal | undefined;
		const ex = make();
		const controller = new AbortController();

		await ex.run(
			async (ctx) => {
				receivedSignal = ctx.signal;
				return 1;
			},
			{ signal: controller.signal },
		);

		expect(receivedSignal).toBeDefined();
		expect(receivedSignal?.aborted).toBe(false);

		// Test aborted signal during execution
		const controller2 = new AbortController();
		await ex.run(
			async (ctx) => {
				receivedSignal = ctx.signal;
				controller2.abort();
				await sleep(0);
			},
			{ signal: controller2.signal, ignoreAbort: true },
		);

		expect(receivedSignal).toBeDefined();
		expect(receivedSignal?.aborted).toBe(true);
	});
});

describe('run: abort metrics', () => {
	it('counts attempt when aborted during run', async () => {
		const ex = make();
		const controller = new AbortController();

		let startedResolve: (() => void) | undefined;
		const started = new Promise<void>((res) => {
			startedResolve = res;
		});

		const p = ex.run(
			async ({ signal }) => {
				startedResolve?.();
				await sleep(50, signal);
				return 1;
			},
			{ signal: controller.signal, ignoreAbort: true },
		);

		await started;
		controller.abort();
		const r = await p;
		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.error.code).toBe('ABORTED');
			expect(Number(r.metrics?.totalAttempts)).toBe(1);
		}
	});

	it('reports correct attempts on timeout', async () => {
		const ex = make();
		const r = await ex.run(
			async () => {
				await sleep(20);
				return 1;
			},
			{ timeout: 5 },
		);
		expect(r.ok).toBe(false);
		expect(Number(r.metrics?.totalAttempts)).toBe(1);
	});
});

describe('runner: circuit breaker', () => {
	it('opens after threshold and short-circuits with CIRCUIT_OPEN', async () => {
		const ex = make({
			circuitBreaker: {
				failureThreshold: 2,
				resetTimeout: 50,
				halfOpenRequests: 1,
			},
		});
		const fail = async () => {
			throw new Error('boom');
		};
		const r1 = await ex.run(fail);
		const r2 = await ex.run(fail);
		const r3 = await ex.run(async () => 1);

		expect(r1.ok).toBe(false);
		expect(r2.ok).toBe(false);
		expect(r3.ok).toBe(false);
		if (!r3.ok) {
			expect(r3.error.code).toBe('CIRCUIT_OPEN');
		}

		// Wait for reset
		await sleep(60);

		// Half-open -> Success -> Closed
		const r4 = await ex.run(async () => 42);
		expect(r4.ok).toBe(true);

		// Should be closed now, allowing failures to count from 0
		const r5 = await ex.run(fail);
		expect(r5.ok).toBe(false);
		// Should not be open yet (threshold 2)
		const r6 = await ex.run(async () => 42);
		expect(r6.ok).toBe(true);
	});
});

describe('observability safety', () => {
	it('does not fail when onSuccess throws', async () => {
		const ex = make({
			hooks: {
				onSuccess: () => {
					throw new Error('hook broke');
				},
			},
		});

		const r = await ex.run(async () => 1);
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.data).toBe(1);
	});

	it('does not throw or mask the task error when onError throws', async () => {
		const ex = make({
			hooks: {
				onError: () => {
					throw new Error('hook broke');
				},
			},
		});

		const r = await ex.run(async () => {
			throw new Error('boom');
		});

		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.error.code).toBe('UNKNOWN');
			expect(r.error.message).toBe('boom');
		}
	});

	it('does not throw when onFinally throws', async () => {
		const ex = make({
			hooks: {
				onFinally: () => {
					throw new Error('hook broke');
				},
			},
		});

		const r = await ex.run(async () => 1);
		expect(r.ok).toBe(true);
	});

	it('does not throw when logger callbacks throw', async () => {
		const ex = make({
			logger: {
				info: () => {
					throw new Error('logger broke');
				},
				error: () => {
					throw new Error('logger broke');
				},
			},
		});

		const r1 = await ex.run(async () => 1);
		expect(r1.ok).toBe(true);

		const r2 = await ex.run(async () => {
			throw new Error('boom');
		});
		expect(r2.ok).toBe(false);
	});
});
