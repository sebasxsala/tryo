import { describe, expect, it } from 'bun:test'
import defaultTryo, {
	all,
	allOrThrow,
	errorRule,
	RetryStrategies,
	run,
	runOrThrow,
	TypedError,
	tryo,
} from '../src'

describe('Public API exports', () => {
	it('exposes default and named factory', () => {
		expect(typeof defaultTryo).toBe('function')
		expect(defaultTryo).toBe(tryo)
	})

	it('exposes runner shortcuts', async () => {
		expect(typeof run).toBe('function')
		expect(typeof runOrThrow).toBe('function')
		expect(typeof all).toBe('function')
		expect(typeof allOrThrow).toBe('function')

		const r = await run(async () => 1)
		expect(r.ok).toBe(true)
	})

	it('exposes error and rules utilities', () => {
		expect(typeof TypedError).toBe('function')
		expect(typeof errorRule.when).toBe('function')
		expect(typeof errorRule.instance).toBe('function')
		expect(typeof RetryStrategies.fixed).toBe('function')
	})

	it('allows creating instance from root export', async () => {
		const ex = defaultTryo({
			retry: {
				maxRetries: 1,
				strategy: RetryStrategies.fixed(0),
			},
		})

		const r = await ex.run(async () => 'ok')
		expect(r.ok).toBe(true)
	})
})
