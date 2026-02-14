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

	it('supports errorRule.instance with toCode.with and title', async () => {
		class CustomInstanceError extends Error {
			code = 'INSTANCE_ERROR' as const
		}

		const ex = tryo({
			rules: [
				errorRule
					.instance(CustomInstanceError)
					.toCode('INSTANCE_ERROR')
					.with((e) => ({
						message: e.message,
						title: 'InstanceMappedError',
					})),
			],
			rulesMode: 'replace',
		})

		const r = await ex.run(async () => {
			throw new CustomInstanceError('instance boom')
		})

		expect(r.ok).toBe(false)
		if (!r.ok) {
			expect(r.error.code).toBe('INSTANCE_ERROR')
			expect(r.error.title).toBe('InstanceMappedError')
		}
	})

	it('supports errorRule.instance with toError mapping', async () => {
		class ValidationLikeError extends Error {
			constructor(readonly field: string) {
				super(`invalid ${field}`)
			}
		}

		const ex = tryo({
			rules: [
				errorRule.instance(ValidationLikeError).toError((e) => ({
					code: 'INSTANCE_VALIDATION',
					message: e.message,
					title: 'ValidationInstanceError',
					meta: { field: e.field },
				})),
			],
			rulesMode: 'replace',
		})

		const r = await ex.run(async () => {
			throw new ValidationLikeError('email')
		})

		expect(r.ok).toBe(false)
		if (!r.ok) {
			expect(r.error.code).toBe('INSTANCE_VALIDATION')
			expect(r.error.title).toBe('ValidationInstanceError')
			expect(r.error.meta).toEqual({ field: 'email' })
		}
	})

	it('supports errorRule.instance with no mapping', async () => {
		class ValidationLikeError extends TypedError<'INSTANCE_VALIDATION'> {
			readonly code = 'INSTANCE_VALIDATION' as const
			constructor(readonly field: string) {
				super('INSTANCE_VALIDATION', {
					title: 'ValidationInstanceError',
					meta: { field },
				})
			}
		}

		const ex = tryo({
			rules: [errorRule.instance(ValidationLikeError)],
			rulesMode: 'replace',
		})

		const r = await ex.run(async () => {
			throw new ValidationLikeError('email')
		})

		expect(r.ok).toBe(false)
		if (!r.ok) {
			expect(r.error.code).toBe('INSTANCE_VALIDATION')
			expect(r.error.title).toBe('ValidationInstanceError')
			expect(r.error.meta).toEqual({ field: 'email' })
		}
	})

	it('supports direct mapper in errorRule.instance without toCode/toError', async () => {
		class DirectInstanceError extends Error {
			code = 'DIRECT_INSTANCE' as const
			message = 'DirectInstanceMappedError'

			constructor(readonly reason: string) {
				super(`direct: ${reason}`)
			}
		}

		const ex = tryo({
			rules: [
				errorRule.instance(DirectInstanceError, (e) => ({
					code: 'DIRECT_INSTANCE',
					message: e.message,
					title: 'DirectInstanceMappedError',
					meta: { reason: e.reason },
				})),
			],
			rulesMode: 'replace',
		})

		const r = await ex.run(async () => {
			throw new DirectInstanceError('bad-input')
		})

		expect(r.ok).toBe(false)
		if (!r.ok) {
			expect(r.error.code).toBe('DIRECT_INSTANCE')
			expect(r.error.title).toBe('DirectInstanceMappedError')
			expect(r.error.meta).toEqual({ reason: 'bad-input' })
		}
	})

	it('defaults cause and raw to original input when mapper omits both', async () => {
		const ex = tryo({
			rules: [
				errorRule
					.when((e): e is string => typeof e === 'string')
					.toError((e) => ({
						code: 'OMITTED_BOTH',
						message: `bad: ${e}`,
					})),
			],
			rulesMode: 'replace',
		})

		const r = await ex.run(async () => {
			throw 'boom'
		})

		expect(r.ok).toBe(false)
		if (!r.ok) {
			expect(r.error.cause).toBe('boom')
			expect(r.error.raw).toBe('boom')
		}
	})

	it('keeps explicit cause and explicit raw distinct', async () => {
		const rootCause = new Error('root-cause')

		const ex = tryo({
			rules: [
				errorRule
					.when((e): e is string => typeof e === 'string')
					.toError((e) => ({
						code: 'EXPLICIT_FIELDS',
						message: `bad: ${e}`,
						cause: rootCause,
						raw: { input: e },
					})),
			],
			rulesMode: 'replace',
		})

		const r = await ex.run(async () => {
			throw 'boom'
		})

		expect(r.ok).toBe(false)
		if (!r.ok) {
			expect(r.error.cause).toBe(rootCause)
			expect(r.error.raw).toEqual({ input: 'boom' })
		}
	})

	it('respects explicit undefined cause and defaults raw independently', async () => {
		const ex = tryo({
			rules: [
				errorRule
					.when((e): e is string => typeof e === 'string')
					.toError((e) => ({
						code: 'UNDEFINED_CAUSE',
						message: `bad: ${e}`,
						cause: undefined,
					})),
			],
			rulesMode: 'replace',
		})

		const r = await ex.run(async () => {
			throw 'boom'
		})

		expect(r.ok).toBe(false)
		if (!r.ok) {
			expect(r.error.cause).toBeUndefined()
			expect(r.error.raw).toBe('boom')
		}
	})

	it('keeps cause and raw undefined when original input is undefined', async () => {
		const ex = tryo({
			rules: [
				errorRule
					.when((e): e is undefined => e === undefined)
					.toError(() => ({
						code: 'UNDEFINED_INPUT',
						message: 'undefined input',
					})),
			],
			rulesMode: 'replace',
		})

		const r = await ex.run(async () => {
			throw undefined
		})

		expect(r.ok).toBe(false)
		if (!r.ok) {
			expect(r.error.cause).toBeUndefined()
			expect(r.error.raw).toBeUndefined()
		}
	})
})
