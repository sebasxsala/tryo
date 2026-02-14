/**
 * Modern fluent error rule builder
 * Provides type-safe error rule creation with enhanced ergonomics
 */

import type { ErrorRule } from './error-normalizer'
import { type AnyTypedError, TypedError } from './typed-error'

type StatusCarrier = {
	status?: number
	statusCode?: number
	message?: string
}

type CodeCarrier = {
	code?: string
	message?: string
	name?: string
}

const hasNumericStatus = (err: unknown): err is StatusCarrier => {
	if (typeof err !== 'object' || err === null) return false
	const candidate = err as StatusCarrier
	return (
		typeof candidate.status === 'number' ||
		typeof candidate.statusCode === 'number'
	)
}

const hasStringCode = (err: unknown): err is CodeCarrier => {
	if (typeof err !== 'object' || err === null) return false
	const candidate = err as CodeCarrier
	return typeof candidate.code === 'string' && candidate.code.length > 0
}

const isNetworkish = (err: unknown): err is Error | CodeCarrier => {
	if (err instanceof Error) {
		// Common fetch/network errors in browsers/Bun/Node.
		const msg = err.message.toLowerCase()
		if (err.name === 'TypeError') {
			if (msg.includes('fetch') && msg.includes('failed')) return true
			if (msg.includes('network')) return true
		}
		if (msg.includes('fetch') && msg.includes('failed')) return true
		if (msg.includes('network')) return true
	}

	if (hasStringCode(err)) {
		const code = (err.code ?? '').toUpperCase()
		return (
			code === 'ECONNRESET' ||
			code === 'ECONNREFUSED' ||
			code === 'ETIMEDOUT' ||
			code === 'ENOTFOUND' ||
			code === 'EAI_AGAIN'
		)
	}

	return false
}

// Modern error rule builder with enhanced ergonomics
export class ErrorRuleBuilder<T> {
	constructor(private readonly predicate: (err: unknown) => err is T) {}

	toCode<const C extends string>(code: C) {
		return new ErrorMapper<T, C>(this.predicate, code)
	}

	// Map to a typed error instance (compatible with existing tests)
	// The returned rule is usable in createErrorNormalizer/tryo({ rules }).
	toError<
		const Out extends {
			code: string
			message: string
			meta?: Record<string, unknown>
			status?: number
			cause?: unknown
			retryable?: boolean
			raw?: any
			path?: string
		},
	>(
		mapper: (err: T) => Out,
	): ErrorRule<
		TypedError<
			Out['code'],
			Out['meta'] extends Record<string, unknown>
				? Out['meta']
				: Record<string, unknown>,
			unknown extends Out['raw'] ? T : Out['raw']
		>
	> {
		return (err: unknown) => {
			if (!this.predicate(err)) return null
			const out = mapper(err as T)
			const code = out.code as Out['code']

			class CustomError extends TypedError<
				Out['code'],
				Out['meta'] extends Record<string, unknown>
					? Out['meta']
					: Record<string, unknown>,
				unknown extends Out['raw'] ? T : Out['raw']
			> {
				readonly code = code
				constructor() {
					super(out.message, {
						cause: out.cause ?? err,
						meta: (out.meta ?? {}) as any,
						status: out.status,
						retryable: out.retryable,
						raw: (out.raw ?? err) as any,
						path: out.path,
					})
				}
			}

			return new CustomError()
		}
	}
}

// Error mapper for code-based mapping
export class ErrorMapper<T, C extends string> {
	constructor(
		private readonly predicate: (err: unknown) => err is T,
		private readonly errorCode: C,
	) {}

	with<
		const M extends Record<string, unknown> = Record<string, unknown>,
		const R = '__NOT_SET__',
	>(
		mapper: (err: T) => {
			message: string
			cause?: unknown
			meta?: M
			status?: number
			retryable?: boolean
			raw?: R
			path?: string
		},
	): ErrorRule<TypedError<C, M, R extends '__NOT_SET__' ? T : R>> {
		return (err: unknown) => {
			if (!this.predicate(err)) return null
			const mapped = mapper(err as T)

			const errorCode = this.errorCode
			class CustomTypedError extends TypedError<
				C,
				M,
				R extends '__NOT_SET__' ? T : R
			> {
				readonly code = errorCode
				constructor() {
					const raw = Object.hasOwn(mapped, 'raw')
						? mapped.raw
						: (err as unknown)
					super(mapped.message, {
						cause: mapped.cause,
						meta: (mapped.meta ?? {}) as M,
						status: mapped.status,
						retryable: mapped.retryable,
						raw: raw as R extends '__NOT_SET__' ? T : R,
						path: mapped.path,
					})
				}
			}

			return new CustomTypedError()
		}
	}
}

// Enhanced error rule factory with modern patterns
export const createErrorRule = {
	when: <T>(predicate: (err: unknown) => err is T) =>
		new ErrorRuleBuilder(predicate),

	instance: <T extends new (...args: unknown[]) => unknown>(ErrorClass: T) =>
		new ErrorRuleBuilder(
			(err): err is InstanceType<T> => err instanceof ErrorClass,
		),
} as const

// Built-in error rule presets
export const BuiltinRules = {
	// Preserve TypedError instances as-is
	typed: ((err: unknown): AnyTypedError | null =>
		err instanceof TypedError
			? (err as AnyTypedError)
			: null) as ErrorRule<AnyTypedError>,

	// Abort errors
	abort: createErrorRule
		.when(
			(err): err is DOMException | Error =>
				err instanceof Error && err.name === 'AbortError',
		)
		.toCode('ABORTED')
		.with((err) => ({
			message: err.message || 'Operation was aborted',
			cause: err,
			retryable: false,
			raw: err,
		})),

	// Timeout errors
	timeout: createErrorRule
		.when(
			(err): err is Error =>
				err instanceof Error && err.name === 'TimeoutError',
		)
		.toCode('TIMEOUT')
		.with((err) => ({
			message: err.message || 'Operation timed out',
			cause: err,
			raw: err,
		})),

	// Network errors
	network: createErrorRule
		.when((err): err is Error | CodeCarrier => isNetworkish(err))
		.toCode('NETWORK')
		.with((err) => {
			const message =
				err instanceof Error
					? err.message || 'Network error'
					: err.message || 'Network error'
			return {
				message,
				cause: err,
				raw: err,
			}
		}),

	// HTTP errors (4xx, 5xx)
	http: createErrorRule
		.when((err): err is StatusCarrier => {
			if (!hasNumericStatus(err)) {
				return false
			}
			const candidate = err as StatusCarrier
			const status = candidate.status ?? candidate.statusCode
			return typeof status === 'number' && status >= 400
		})
		.toCode('HTTP')
		.with((err) => {
			const status = err.status ?? err.statusCode
			const isRetryable =
				typeof status === 'number' && (status >= 500 || status === 429)
			return {
				message: err.message || `HTTP ${status ?? 'error'} error`,
				cause: err,
				status: typeof status === 'number' ? status : undefined,
				retryable: isRetryable,
				raw: err,
			}
		}),

	// Generic error fallback
	unknown: createErrorRule
		.when(
			(err): err is Error =>
				err instanceof Error && !(err instanceof TypedError),
		)
		.toCode('UNKNOWN')
		.with((err) => ({
			message: err.message || 'Unknown error occurred',
			cause: err,
			raw: err,
		})),
} as const
