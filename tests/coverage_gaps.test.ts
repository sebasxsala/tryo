import { describe, expect, it } from 'bun:test'
import { all, allOrThrow, orThrow, run, runOrThrow } from '../src/core/default'
import { tryo } from '../src/core/tryo'
import { TypedError } from '../src/error/typed-error'
import { RetryStrategies } from '../src/retry/retry-strategies'
import { sleep } from '../src/utils/timing'

describe('mapError', () => {
	it('transforms errors post-normalization', async () => {
		const ex = tryo({
			mapError: (error) => {
				return error.withMeta({ enriched: true })
			},
		})

		const r = await ex.run(async () => {
			throw new Error('original')
		})

		expect(r.ok).toBe(false)
		if (!r.ok) {
			expect(r.error.code).toBe('UNKNOWN')
			expect(r.error.meta).toEqual({ enriched: true })
		}
	})
})

describe('shouldRetry predicate', () => {
	it('skips retry when shouldRetry returns false', async () => {
		let calls = 0
		const ex = tryo({
			retry: {
				maxRetries: 3,
				strategy: RetryStrategies.fixed(0),
				shouldRetry: (_attempt, error) => {
					// Only retry network errors, not unknown
					return error.code === 'NETWORK'
				},
			},
		})

		const r = await ex.run(async () => {
			calls++
			throw new Error('not retryable')
		})

		expect(r.ok).toBe(false)
		expect(calls).toBe(1) // Should not retry
		if (!r.ok) {
			expect(r.error.code).toBe('UNKNOWN')
		}
	})

	it('retries when shouldRetry returns true', async () => {
		let calls = 0
		const ex = tryo({
			retry: {
				maxRetries: 2,
				strategy: RetryStrategies.fixed(0),
				shouldRetry: () => true,
			},
		})

		const r = await ex.run(async () => {
			calls++
			if (calls < 3) throw new Error('fail')
			return 'ok'
		})

		expect(r.ok).toBe(true)
		expect(calls).toBe(3)
	})
})

describe('toError (custom normalizer bypass)', () => {
	it('uses custom normalizer instead of rules', async () => {
		class CustomError extends TypedError<'CUSTOM'> {
			readonly code = 'CUSTOM' as const
			constructor(message: string) {
				super(message, { retryable: false, raw: null })
			}
		}

		const ex = tryo({
			toError: (err) => {
				if (err instanceof Error) {
					return new CustomError(err.message)
				}
				return new CustomError('unknown')
			},
		})

		const r = await ex.run(async () => {
			throw new Error('custom catch')
		})

		expect(r.ok).toBe(false)
		if (!r.ok) {
			expect(r.error.code).toBe('CUSTOM')
			expect(r.error.message).toBe('custom catch')
		}
	})
})

describe('partitionAll', () => {
	it('partitions mixed results correctly', async () => {
		const ex = tryo()
		const results = await ex.all([
			async () => 1,
			async () => {
				throw new Error('fail')
			},
			async () => 2,
		])

		const partitioned = ex.partitionAll(results)

		expect(partitioned.ok).toHaveLength(2)
		expect(partitioned.failure).toHaveLength(1)
		expect(partitioned.errors).toHaveLength(1)
		expect(partitioned.aborted).toHaveLength(0)
		expect(partitioned.timeout).toHaveLength(0)

		expect(partitioned.ok[0]?.data).toBe(1)
		expect(partitioned.ok[1]?.data).toBe(2)
		expect(partitioned.failure[0]?.error.code).toBe('UNKNOWN')
	})

	it('handles all-success case', async () => {
		const ex = tryo()
		const results = await ex.all([async () => 'a', async () => 'b'])

		const partitioned = ex.partitionAll(results)
		expect(partitioned.ok).toHaveLength(2)
		expect(partitioned.errors).toHaveLength(0)
	})
})

describe('retry + timeout combined', () => {
	it('retries after timeout and eventually succeeds', async () => {
		let calls = 0
		const ex = tryo({
			timeout: 10,
			retry: {
				maxRetries: 2,
				strategy: RetryStrategies.fixed(0),
			},
		})

		const r = await ex.run(async () => {
			calls++
			if (calls < 3) {
				await sleep(50) // will timeout
			}
			return 'done'
		})

		expect(r.ok).toBe(true)
		if (r.ok) {
			expect(r.data).toBe('done')
			expect(Number(r.metrics.totalAttempts)).toBe(3)
		}
	})
})

describe('all() with signal abort mid-batch', () => {
	it('aborts remaining tasks when signal fires', async () => {
		const controller = new AbortController()
		const ex = tryo()

		const results = await ex.all(
			[
				async () => {
					controller.abort()
					return 1
				},
				async () => {
					await sleep(50)
					return 2
				},
			],
			{ signal: controller.signal, concurrency: 1 },
		)

		expect(results).toHaveLength(2)
		// First task succeeds
		expect(results[0]?.ok).toBe(true)
		// Second task should be aborted
		expect(results[1]?.ok).toBe(false)
		if (!results[1]?.ok) {
			expect(results[1]?.error.code).toBe('ABORTED')
		}
	})
})

describe('default instance exports', () => {
	it('run works as standalone export', async () => {
		const r = await run(async () => 42)
		expect(r.ok).toBe(true)
		if (r.ok) expect(r.data).toBe(42)
	})

	it('runOrThrow works', async () => {
		const data = await runOrThrow(async () => 'hello')
		expect(data).toBe('hello')
	})

	it('orThrow works', async () => {
		const data = await orThrow(async () => 99)
		expect(data).toBe(99)
	})

	it('all works', async () => {
		const results = await all([async () => 1, async () => 2])
		expect(results).toHaveLength(2)
		expect(results.every((r) => r.ok)).toBe(true)
	})

	it('allOrThrow works', async () => {
		const data = await allOrThrow([async () => 'a', async () => 'b'])
		expect(data).toEqual(['a', 'b'])
	})

	it('runOrThrow throws on failure', async () => {
		let error: unknown
		try {
			await runOrThrow(async () => {
				throw new Error('fail')
			})
		} catch (e) {
			error = e
		}
		expect(error).toBeInstanceOf(TypedError)
	})
})
