import { describe, expect, it } from 'bun:test'

import { tryo } from '../src/core/tryo'
import { errorRule } from '../src/error/error-rules'

describe('Executor.withConfig', () => {
	it('preserves existing error normalization by default', async () => {
		const ex = tryo({
			rules: [
				errorRule
					.when((e): e is 'custom' => e === 'custom')
					.toError((e) => ({
						code: 'CUSTOM_ERROR' as const,
						message: 'Custom error',
						raw: e,
					})),
			],
		})

		const derived = ex.withConfig({ timeout: 1 })
		const r = await derived.run(async () => {
			throw 'custom'
		})

		expect(r.ok).toBe(false)
		if (!r.ok) {
			expect(r.error.code).toBe('CUSTOM_ERROR')
		}
	})
})
