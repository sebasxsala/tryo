import { describe, it } from 'bun:test'
import { createErrorRule } from '../src/error/error-builder'

describe('Strict Error Mapping', () => {
	it('should NOT allow extra properties in toError', () => {
		createErrorRule
			.when((e): e is string => typeof e === 'string')
			.toError((e) => ({
				code: 'TEST_CODE',
				message: e,
				// @ts-expect-error - extra property should not be allowed
				extra: 'should not be here',
			}))
	})

	it('should NOT allow extra properties in with', () => {
		createErrorRule
			.when((e): e is string => typeof e === 'string')
			.toCode('TEST_CODE')
			.with((e) => ({
				message: e,
				// @ts-expect-error - extra property should not be allowed
				extra: 'should not be here',
			}))
	})

	it('should ALLOW meta property in toError', () => {
		createErrorRule
			.when((e): e is string => typeof e === 'string')
			.toError((e) => ({
				code: 'TEST_CODE',
				message: e,
				meta: { foo: 'bar' },
			}))
	})

	it('should ALLOW meta property in with', () => {
		createErrorRule
			.when((e): e is string => typeof e === 'string')
			.toCode('TEST_CODE')
			.with((e) => ({
				message: e,
				meta: { foo: 'bar' },
			}))
	})

	it('should ALLOW all standard properties in toError', () => {
		createErrorRule
			.when((e): e is string => typeof e === 'string')
			.toError((e) => ({
				code: 'TEST_CODE',
				message: e,
				status: 500,
				cause: new Error('original'),
				retryable: true,
				raw: { some: 'raw' },
				path: '/api/test',
			}))
	})
})
