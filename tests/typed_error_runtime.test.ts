import { describe, expect, it } from 'bun:test'
import { HttpError, TypedError } from '../src/error/typed-error'

describe('TypedError runtime behavior', () => {
	it('serializes meta and status in toJSON', () => {
		const err = new HttpError('bad request', 400, { body: 'nope' })
		const json = err.toJSON()

		expect(json.code).toBe('HTTP')
		expect(json.status).toBe(400)
		expect(json.meta).toEqual({ response: { body: 'nope' } })
	})

	it('mutates fluent fields predictably', () => {
		class LocalError extends TypedError<'LOCAL'> {
			readonly code = 'LOCAL' as const
		}

		const err = new LocalError('local error', {
			retryable: false,
		})

		err
			.withStatus(422)
			.withCause(new Error('root'))
			.withPath('/api/local')
			.withRetryable(true)
			.withMeta({ field: 'email' })
			.withRaw({ input: 'email' })

		expect(err.status).toBe(422)
		expect(err.cause).toBeInstanceOf(Error)
		expect(err.path).toBe('/api/local')
		expect(err.retryable).toBe(true)
		expect(err.meta).toEqual({ field: 'email' })
		expect(err.raw).toEqual({ input: 'email' })
	})
})
