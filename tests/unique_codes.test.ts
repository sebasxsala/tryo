import { describe, it } from 'bun:test'
import { tryo } from '../src/core/tryo'
import { errorRule } from '../src/error/error-rules'

type UniqueCodesCheck<
	T extends readonly string[],
	Seen = never,
> = T extends readonly [
	infer Head extends string,
	...infer Tail extends string[],
]
	? [Head] extends [Seen]
		? { error: 'Duplicate code detected'; code: Head }
		: UniqueCodesCheck<Tail, Seen | Head>
	: true

describe('Unique code check', () => {
	it('should flag duplicate codes across toError rules', () => {
		// @ts-expect-error - Duplicate code 'DUPLICATE'
		const _duplicateCodeCheck: UniqueCodesCheck<['DUPLICATE', 'DUPLICATE']> =
			true

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
		})
	})
})
