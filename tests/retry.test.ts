import { describe, expect, it } from 'bun:test'

import { tryo } from '../src/core/tryo'
import { RetryStrategies } from '../src/retry/retry-strategies'

describe('Retry behavior and metrics', () => {
	it('counts retries correctly when it succeeds after retries', async () => {
		let calls = 0
		const ex = tryo({
			retry: {
				maxRetries: 2,
				strategy: RetryStrategies.fixed(0),
			},
		})

		const r = await ex.run(async () => {
			calls++
			if (calls < 3) throw new Error('nope')
			return 42
		})

		expect(r.ok).toBe(true)
		if (r.ok) {
			expect(r.data).toBe(42)
			expect(Number(r.metrics?.totalAttempts)).toBe(3)
			expect(Number(r.metrics?.totalRetries)).toBe(2)
			expect(r.metrics?.retryHistory).toHaveLength(2)
			expect(Number(r.metrics?.retryHistory[0]?.attempt)).toBe(1)
			expect(Number(r.metrics?.retryHistory[1]?.attempt)).toBe(2)
		}
	})

	it('counts retries correctly when it fails after maxRetries', async () => {
		const ex = tryo({
			retry: {
				maxRetries: 1,
				strategy: RetryStrategies.fixed(0),
			},
		})

		const r = await ex.run(async () => {
			throw new Error('fail')
		})

		expect(r.ok).toBe(false)
		if (!r.ok) {
			expect(Number(r.metrics?.totalAttempts)).toBe(2)
			expect(Number(r.metrics?.totalRetries)).toBe(1)
			expect(r.metrics?.retryHistory).toHaveLength(1)
		}
	})

	it('honors maxDelay when set to zero', async () => {
		const ex = tryo({
			retry: {
				maxRetries: 1,
				strategy: RetryStrategies.exponential(100, 2, 0.0001),
			},
		})

		const r = await ex.run(async () => {
			throw new Error('fail')
		})

		expect(r.ok).toBe(false)
		if (!r.ok) {
			expect(r.metrics.retryHistory).toHaveLength(1)
			expect(Number(r.metrics.retryHistory[0]?.delay)).toBeLessThanOrEqual(1)
		}
	})
})
