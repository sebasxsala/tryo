import { describe, expect, test } from 'bun:test'
import { tryo } from '../src/core/tryo'
import { sleep } from '../src/utils/timing'

describe('Concurrency', () => {
	test('runAll respects concurrency limit', async () => {
		const start = Date.now()
		let active = 0
		let maxActive = 0

		const ex = tryo()

		const tasks: Array<(ctx: { signal: AbortSignal }) => Promise<number>> =
			Array.from({ length: 5 }, (_, i) => async (_ctx) => {
				active++
				maxActive = Math.max(maxActive, active)
				await sleep(50)
				active--
				return i
			})

		const concurrency = 2
		const results = await ex.all(tasks, { concurrency })

		const duration = Date.now() - start

		// With 5 tasks and concurrency 2:
		// Batch 1: 2 tasks (50ms)
		// Batch 2: 2 tasks (50ms)
		// Batch 3: 1 task (50ms)
		// Total min time ~150ms.
		// If unbounded, it would be ~50ms.

		expect(maxActive).toBeLessThanOrEqual(2)
		expect(duration).toBeGreaterThanOrEqual(140) // Allow some jitter
		expect(results).toHaveLength(5)
		expect(results.every((r) => r.ok)).toBe(true)
	})

	test('runAll defaults to unbounded concurrency (Promise.all behavior)', async () => {
		const start = Date.now()
		const ex = tryo()
		const tasks: Array<(ctx: { signal: AbortSignal }) => Promise<number>> =
			Array.from({ length: 10 }, (_, i) => async (_ctx) => {
				await sleep(50)
				return i
			})

		await ex.all(tasks) // No concurrency option
		const duration = Date.now() - start

		// Should take roughly 50ms (plus overhead)
		expect(duration).toBeLessThan(100)
	})
})
