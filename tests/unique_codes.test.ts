import { describe, expect, it } from 'bun:test'
import { tryo } from '../src/core/tryo'
import { errorRule } from '../src/error/error-rules'

describe('Unique code check', () => {
	it('throws when duplicate rule codes are configured', () => {
		expect(() =>
			tryo({
				rulesMode: 'replace',
				rules: [
					errorRule
						.when((e): e is 'a' => e === 'a')
						.toCode('DUPLICATE')
						.with(() => ({
							message: 'Error A',
						})),
					errorRule
						.when((e): e is 'b' => e === 'b')
						.toCode('DUPLICATE')
						.with(() => ({
							message: 'Error B',
						})),
				] as const,
			}),
		).toThrow(/Duplicate rule code detected: DUPLICATE/)
	})

	it('throws when duplicate toError codes are configured', () => {
		expect(() =>
			tryo({
				rulesMode: 'replace',
				rules: [
					errorRule
						.when((e): e is 'a' => e === 'a')
						.toError(() => ({
							code: 'DUPLICATE' as const,
							message: 'Error A',
						})),
					errorRule
						.when((e): e is 'b' => e === 'b')
						.toError(() => ({
							code: 'DUPLICATE' as const,
							message: 'Error B',
						})),
				] as const,
			}),
		).toThrow(/Duplicate rule code detected: DUPLICATE/)
	})
})
