import { describe, expect, it } from 'bun:test'

import { tryo } from '../src/core/tryo'
import { HttpError } from '../src/error/typed-error'
import { RetryStrategies } from '../src/retry/retry-strategies'

describe('Core guardrails', () => {
	it('does not retry aborted errors', async () => {
		let calls = 0
		const ex = tryo({
			retry: {
				maxRetries: 3,
				strategy: RetryStrategies.fixed(0),
			},
		})

		const r = await ex.run(
			async () => {
				calls++
				throw new DOMException('Aborted', 'AbortError')
			},
			{ ignoreAbort: false },
		)

		expect(r.ok).toBe(false)
		expect(calls).toBe(1)
		if (!r.ok) {
			expect(r.error.code).toBe('ABORTED')
			expect(Number(r.metrics?.totalAttempts)).toBe(1)
			expect(Number(r.metrics?.totalRetries)).toBe(0)
		}
	})

	it('throws on invalid jitter ratio', async () => {
		let error: unknown
		try {
			tryo({
				retry: {
					maxRetries: 1,
					strategy: RetryStrategies.fixed(1),
					jitter: { type: 'full', ratio: 120 },
				},
			})
		} catch (err) {
			error = err
		}

		expect(error).toBeInstanceOf(Error)
		if (error instanceof Error) {
			expect(error.message).toContain('Invalid percentage')
		}
	})

	it('does not retry when error is explicitly non-retryable', async () => {
		let calls = 0
		const ex = tryo({
			retry: {
				maxRetries: 3,
				strategy: RetryStrategies.fixed(0),
			},
		})

		const r = await ex.run(async () => {
			calls++
			throw new HttpError('Not found', 404)
		})

		expect(r.ok).toBe(false)
		expect(calls).toBe(1)
		if (!r.ok) {
			expect(r.error.code).toBe('HTTP')
			expect(r.error.retryable).toBe(false)
			expect(Number(r.metrics.totalAttempts)).toBe(1)
			expect(Number(r.metrics.totalRetries)).toBe(0)
		}
	})

	it('normalizes Error AbortError shape as ABORTED', async () => {
		const ex = tryo()
		const r = await ex.run(async () => {
			const e = new Error('cancelled')
			e.name = 'AbortError'
			throw e
		})

		expect(r.ok).toBe(false)
		if (!r.ok) {
			expect(r.error.code).toBe('ABORTED')
		}
	})
})
