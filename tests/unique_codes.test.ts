import { describe, it } from 'bun:test'
import { tryo } from '../src/core/tryo'
import { errorRule } from '../src/error/error-rules'

describe('Unique code check', () => {
	it('should flag duplicate codes across toError rules', () => {
		// @ts-expect-error - Duplicate code 'DUPLICATE'
		tryo({
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
		})
	})
})
