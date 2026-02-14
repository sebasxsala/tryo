import { describe, it } from 'bun:test'
import tryo from '../src'
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
				title: 'CustomTitle',
				status: 500,
				cause: new Error('original'),
				retryable: true,
				raw: { some: 'raw' },
				path: '/api/test',
			}))
	})

	it('should ALLOW direct mapper in instance without toError', () => {
		class DomainError extends Error {
			constructor(readonly field: string) {
				super(`invalid ${field}`)
			}
		}

		createErrorRule.instance(DomainError, (e) => ({
			code: 'DOMAIN_INVALID',
			message: e.message,
			title: 'DomainValidationError',
			meta: { field: e.field },
		}))
	})

	it('should NOT ALLOW direct instance without necessary properties', () => {
		class DomainError extends Error {
			constructor(readonly field: string) {
				super(`invalid ${field}`)
			}
		}

		tryo({
			rules: [
				// @ts-expect-error - rules expects callable rules, instance() returns builder here
				createErrorRule.instance(DomainError),
			],
		})
	})
})
