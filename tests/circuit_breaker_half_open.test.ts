import { describe, expect, it } from 'bun:test';

import { Executor } from '../src/core/executor';
import { asMilliseconds, asRetryCount } from '../src/types/branded-types';
import { sleep } from '../src/utils/timing';

describe('Circuit breaker: half-open', () => {
	it('enforces halfOpenRequests limit', async () => {
		const ex = new Executor({
			circuitBreaker: {
				failureThreshold: asRetryCount(1),
				resetTimeout: asMilliseconds(20),
				halfOpenRequests: asRetryCount(1),
			},
		});

		await ex.execute(async () => {
			throw new Error('boom');
		});

		// Wait for reset timeout so breaker moves to half-open on next check
		await sleep(25);

		const slow = ex.execute(async () => {
			await sleep(30);
			return 1;
		});
		const denied = await ex.execute(async () => 2);
		const ok = await slow;

		expect(ok.ok).toBe(true);
		expect(denied.ok).toBe(false);
		if (!denied.ok) {
			expect(denied.error.code).toBe('CIRCUIT_OPEN');
		}

		// After success in half-open, breaker should be closed again
		const r = await ex.execute(async () => 42);
		expect(r.ok).toBe(true);
	});

	it('fires onCircuitStateChange hook on transitions', async () => {
		const transitions: Array<{ from: string; to: string }> = [];
		const ex = new Executor({
			circuitBreaker: {
				failureThreshold: asRetryCount(1),
				resetTimeout: asMilliseconds(10),
				halfOpenRequests: asRetryCount(1),
			},
			hooks: {
				onCircuitStateChange: (from, to) => transitions.push({ from, to }),
			},
		});

		await ex.execute(async () => {
			throw new Error('boom');
		});
		expect(
			transitions.some((t) => t.from === 'closed' && t.to === 'open'),
		).toBe(true);

		await sleep(15);
		await ex.execute(async () => 1);
		expect(
			transitions.some((t) => t.from === 'open' && t.to === 'half-open'),
		).toBe(true);
		expect(
			transitions.some((t) => t.from === 'half-open' && t.to === 'closed'),
		).toBe(true);
	});
});
