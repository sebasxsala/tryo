import { describe, expect, it } from 'bun:test';
import { tryo } from '../src/core/tryo';
import { HttpError } from '../src/error/typed-error';

describe('Error retryability', () => {
	const ex = tryo();

	it('identifies timeout as retryable', async () => {
		const r = await ex.run(async () => {
			const err = new Error('timeout');
			err.name = 'TimeoutError';
			throw err;
		});
		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.error.code).toBe('TIMEOUT');
			expect(r.error.retryable).toBe(true);
		}
	});

	it('identifies aborted as NOT retryable', async () => {
		const r = await ex.run(async () => {
			const err = new DOMException('aborted', 'AbortError');
			throw err;
		});
		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.error.code).toBe('ABORTED');
			expect(r.error.retryable).toBe(false);
		}
	});

	it('identifies 5xx as retryable', async () => {
		const r = await ex.run(async () => {
			throw new HttpError('Server error', 500);
		});
		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.error.code).toBe('HTTP');
			expect(r.error.retryable).toBe(true);
		}
	});

	it('identifies 4xx as NOT retryable (except 429)', async () => {
		const r1 = await ex.run(async () => {
			throw new HttpError('Not found', 404);
		});
		expect(r1.ok).toBe(false);
		if (!r1.ok) {
			expect(r1.error.retryable).toBe(false);
		}

		const r2 = await ex.run(async () => {
			throw new HttpError('Too many requests', 429);
		});
		expect(r2.ok).toBe(false);
		if (!r2.ok) {
			expect(r2.error.retryable).toBe(true);
		}
	});

	it('allows overriding retryable at instance level via withRetryable', async () => {
		const err = new HttpError('bad', 400).withRetryable(true);
		expect(err.retryable).toBe(true);
	});
});
