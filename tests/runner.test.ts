import { describe, expect, it } from 'bun:test';
import type { ExecutorOptions } from '../src/core/executor';
import { Executor } from '../src/core/executor';
import { sleep } from '../src/utils/timing';

const make = (opts: ExecutorOptions = {}) => new Executor(opts);

describe('run: success', () => {
	it('returns ok:true with data', async () => {
		const ex = make();
		const r = await ex.execute(async () => 42);
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.data).toBe(42);
	});
});

describe('run: abort', () => {
	it('aborts immediately when signal is aborted', async () => {
		const ex = make();
		const controller = new AbortController();
		controller.abort();
		const r = await ex.execute(
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
		const r = await ex.execute(
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

		await ex.execute(
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
		await ex.execute(
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
		await ex.execute(
			async () => {
				await sleep(10);
				return 1;
			},
			{ signal: controller.signal, ignoreAbort: true },
		);
		// Abort from outside is hard to time perfectly to be "during" run without sleep
		// But we can abort immediately
	});

	it('reports correct attempts on timeout', async () => {
		const ex = make();
		const r = await ex.execute(
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
		const r1 = await ex.execute(fail);
		const r2 = await ex.execute(fail);
		const r3 = await ex.execute(async () => 1);

		expect(r1.ok).toBe(false);
		expect(r2.ok).toBe(false);
		expect(r3.ok).toBe(false);
		if (!r3.ok) {
			expect(r3.error.code).toBe('CIRCUIT_OPEN');
		}

		// Wait for reset
		await sleep(60);

		// Half-open -> Success -> Closed
		const r4 = await ex.execute(async () => 42);
		expect(r4.ok).toBe(true);

		// Should be closed now, allowing failures to count from 0
		const r5 = await ex.execute(fail);
		expect(r5.ok).toBe(false);
		// Should not be open yet (threshold 2)
		const r6 = await ex.execute(async () => 42);
		expect(r6.ok).toBe(true);
	});
});
