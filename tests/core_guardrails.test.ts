import { describe, expect, it } from 'bun:test';

import { tryo } from '../src/core/tryo';
import { RetryStrategies } from '../src/retry/retry-strategies';

describe('Core guardrails', () => {
	it('does not retry aborted errors', async () => {
		let calls = 0;
		const ex = tryo({
			retry: {
				maxRetries: 3,
				strategy: RetryStrategies.fixed(0),
			},
		});

		const r = await ex.run(
			async () => {
				calls++;
				throw new DOMException('Aborted', 'AbortError');
			},
			{ ignoreAbort: false },
		);

		expect(r.ok).toBe(false);
		expect(calls).toBe(1);
		if (!r.ok) {
			expect(r.error.code).toBe('ABORTED');
			expect(Number(r.metrics?.totalAttempts)).toBe(1);
			expect(Number(r.metrics?.totalRetries)).toBe(0);
		}
	});

	it('throws on invalid jitter ratio', async () => {
		let error: unknown;
		try {
			tryo({
				retry: {
					maxRetries: 1,
					strategy: RetryStrategies.fixed(1),
					jitter: { type: 'full', ratio: 120 },
				},
			});
		} catch (err) {
			error = err;
		}

		expect(error).toBeInstanceOf(Error);
		if (error instanceof Error) {
			expect(error.message).toContain('Invalid percentage');
		}
	});
});
