import { describe, expect, it } from 'bun:test'

import { type DefaultError, tryo } from '../src/core/tryo'
import { errorRule } from '../src/error/error-rules'
import { HttpError, TypedError } from '../src/error/typed-error'

describe('Error normalization', () => {
	it('preserves thrown TypedError instances', async () => {
		class MyTypedError extends TypedError<'MY_CODE', { foo: string }> {
			readonly code = 'MY_CODE' as const
			constructor() {
				super('boom', { meta: { foo: 'bar' }, raw: null })
			}
		}

		const ex = tryo<MyTypedError | DefaultError>()
		const r = await ex.run(async () => {
			throw new MyTypedError()
		})

		expect(r.ok).toBe(false)
		if (!r.ok) {
			expect(r.error.code).toBe('MY_CODE')
			expect(r.error.message).toBe('boom')
			expect(r.error.meta).toEqual({ foo: 'bar' })
		}
	})

	it('keeps HttpError code and status', async () => {
		const ex = tryo()
		const r = await ex.run(async () => {
			throw new HttpError('bad', 500)
		})

		expect(r.ok).toBe(false)
		if (!r.ok) {
			expect(r.error.code).toBe('HTTP')
			expect(r.error.status).toBe(500)
		}
	})

	it('maps plain { status } objects to HTTP when status >= 400', async () => {
		const ex = tryo()
		const r = await ex.run(async () => {
			throw { status: 500, message: 'server' }
		})

		expect(r.ok).toBe(false)
		if (!r.ok) {
			expect(r.error.code).toBe('HTTP')
			expect(r.error.status).toBe(500)
		}
	})

	it('does not classify programming TypeError as NETWORK by default', async () => {
		const ex = tryo()
		const r = await ex.run(async () => {
			throw new TypeError('Cannot read properties of undefined')
		})

		expect(r.ok).toBe(false)
		if (!r.ok) {
			expect(r.error.code).toBe('UNKNOWN')
		}
	})

	it('uses original input as raw when toCode.with omits raw', async () => {
		const ex = tryo({
			rules: [
				errorRule
					.when((e): e is string => typeof e === 'string')
					.toCode('STRING_ERROR')
					.with((e) => ({ message: `bad: ${e}` })),
			],
			rulesMode: 'replace',
		})

		const r = await ex.run(async () => {
			throw 'boom'
		})

		expect(r.ok).toBe(false)
		if (!r.ok) {
			expect(r.error.code).toBe('STRING_ERROR')
			expect(r.error.raw).toBe('boom')
		}
	})
})
