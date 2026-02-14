import { describe, expect, it } from 'bun:test'
import { tryo } from '../src/core/tryo'
import { errorRule } from '../src/error/error-rules'

describe('Type inference', () => {
	it('infers custom error codes from rules and narrows meta type', async () => {
		const ex = tryo({
			rules: [
				errorRule
					.when((e): e is 'foo' => e === 'foo')
					.toError((e) => ({
						code: 'CUSTOM_FOO' as const,
						message: 'Foo error',
						meta: { fooId: 123 },
						raw: e,
					})),
				errorRule
					.when((e): e is 'bar' => e === 'bar')
					.toError((e) => ({
						code: 'CUSTOM_BAR' as const,
						message: 'Bar error',
						meta: { barData: 'test' },
						raw: e,
					})),
			] as const,
		})

		const result = await ex.run(async () => {
			throw 'foo'
		})

		if (!result.ok) {
			if (result.error.code === 'CUSTOM_FOO') {
				// Should compile without error and infer meta
				// meta is optional, so we need to check it
				if (result.error.meta) {
					const val: number = result.error.meta.fooId
					expect(val).toBe(123)
				}
				// @ts-expect-error - barData should not exist on CUSTOM_FOO
				result.error.meta?.barData
			} else if (result.error.code === 'CUSTOM_BAR') {
				if (result.error.meta) {
					const val: string = result.error.meta.barData
					expect(val).toBe('test')
				}
			}
		}
	})

	it('requires narrowing before accessing custom meta fields', async () => {
		const ex = tryo({
			rules: [
				errorRule
					.when((e): e is 'foo' => e === 'foo')
					.toError((e) => ({
						code: 'CUSTOM_FOO' as const,
						message: 'Foo error',
						meta: { fooId: 123 },
						raw: e,
					})),
			],
		})

		const unknownResult = await ex.run(async () => {
			throw new Error('boom')
		})

		if (!unknownResult.ok) {
			const takesNumber = (_value: number) => {}
			// @ts-expect-error custom meta is not narrowed yet
			takesNumber(unknownResult.error.meta.fooId)
		}

		const fooResult = await ex.run(async () => {
			throw 'foo'
		})

		if (!fooResult.ok && fooResult.error.code === 'CUSTOM_FOO') {
			const val: number = fooResult.error.meta.fooId
			expect(val).toBe(123)
		}
	})

	it('preserves standard error codes', async () => {
		const ex = tryo()
		const result = await ex.run(async () => {
			throw new Error('fail')
		})
		if (!result.ok) {
			// Should allow checking standard codes
			if (result.error.code === 'UNKNOWN') {
				expect(result.error.message).toBe('fail')
			}
		}
	})

	it('infers types in runAll', async () => {
		const ex = tryo({
			rules: [
				errorRule
					.when((e): e is 'foo' => e === 'foo')
					.toError((e) => ({
						code: 'CUSTOM_FOO' as const,
						message: 'Foo error',
						meta: { fooId: 123 },
						raw: e,
					})),
			] as const,
		})

		const results = await ex.all([
			async () => {
				throw 'foo'
			},
		])
		const first = results[0]

		if (first && !first.ok && first.error.code === 'CUSTOM_FOO') {
			if (first.error.meta) {
				expect(first.error.meta.fooId).toBe(123)
			}
		}
	})

	it("supports rulesMode='replace' to exclude default rules", async () => {
		const ex = tryo({
			rules: [
				errorRule
					.when((e): e is 'foo' => e === 'foo')
					.toError((e) => ({
						code: 'CUSTOM_FOO',
						message: 'Foo',
						raw: e,
					})),
			] as const,
			rulesMode: 'replace',
		})

		// Should handle custom error
		const resultFoo = await ex.run(async () => {
			throw 'foo'
		})
		if (!resultFoo.ok) {
			expect(resultFoo.error.code).toBe('CUSTOM_FOO')
		}

		// Should NOT handle timeout (default rule) -> falls back to UNKNOWN
		const resultTimeout = await ex.run(async () => {
			const err = new Error('timeout')
			err.name = 'TimeoutError'
			throw err
		})

		if (!resultTimeout.ok) {
			expect(resultTimeout.error.code).toBe('UNKNOWN')
			// If it was extended, it would be "TIMEOUT"
		}

		const r = await ex.run(async () => {
			throw 'foo'
		})
		if (!r.ok && r.error.code === 'CUSTOM_FOO') {
			expect(r.error.message).toBe('Foo')
		}
		// @ts-expect-error replace mode should not include default TIMEOUT code
		r.error.code === 'TIMEOUT'
	})

	it("supports rulesMode='extend' (default) to include default rules", async () => {
		const ex = tryo({
			rules: [
				errorRule
					.when((e): e is 'foo' => e === 'foo')
					.toError((e) => ({
						code: 'CUSTOM_FOO',
						message: 'Foo',
						raw: e,
					})),
			] as const,
			// rulesMode: "extend" is default
		})

		// Should handle custom error
		const resultFoo = await ex.run(async () => {
			throw 'foo'
		})
		if (!resultFoo.ok) {
			expect(resultFoo.error.code).toBe('CUSTOM_FOO')
		}

		// Should handle timeout (default rule)
		const resultTimeout = await ex.run(async () => {
			const err = new Error('timeout')
			err.name = 'TimeoutError'
			throw err
		})

		if (!resultTimeout.ok) {
			expect(resultTimeout.error.code as string).toBe('TIMEOUT')
		}

		const r = await ex.run(async () => {
			throw 'foo'
		})
		if (!r.ok) {
			const code = r.error.code
			expect(typeof code).toBe('string')
			if (code === 'CUSTOM_FOO' || code === 'TIMEOUT') {
				expect(code === 'CUSTOM_FOO' || code === 'TIMEOUT').toBe(true)
			}
		}
	})

	it('supports sync task typings', async () => {
		const ex = tryo()
		const result = await ex.run(() => 123)
		if (result.ok) {
			const value: number = result.data
			expect(value).toBe(123)
		}
	})

	it('narrows success result types', async () => {
		const ex = tryo()

		const r = await ex.run(async () => ({
			id: 123 as const,
			name: 'alice' as const,
		}))

		expect(r.ok).toBe(true)
		if (r.ok) {
			const id: 123 = r.data.id
			const name: 'alice' = r.data.name
			expect(id).toBe(123)
			expect(name).toBe('alice')
		}
	})

	it('infers onSuccess data type from run task result', async () => {
		const ex = tryo()

		await ex.run(async () => ({ id: 123 as const, name: 'alice' as const }), {
			onSuccess: (data) => {
				const id: 123 = data.id
				const name: 'alice' = data.name
				const takeNumber = (_n: number) => {}
				expect(id).toBe(123)
				expect(name).toBe('alice')

				// @ts-expect-error onSuccess data should not be assignable to number
				takeNumber(data)
			},
		})
	})
})
