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

/** Standard error response properties allowed in rules */
export interface ErrorResponse {
	code: string
	message: string
	title?: string
	meta?: Record<string, unknown>
	status?: number
	cause?: unknown
	retryable?: boolean
	raw?: unknown
	path?: string
}

/** Standard mapper properties allowed in .with() */
export interface MapperResponse {
	message: string
	title?: string
	cause?: unknown
	meta?: Record<string, unknown>
	status?: number
	retryable?: boolean
	raw?: unknown
	path?: string
}

type Strict<T, Shape> = T & Record<Exclude<keyof T, keyof Shape>, never>

type InstanceRuleHandle<T> = ErrorRule<AnyTypedError> & {
	toCode: ErrorRuleBuilder<T>['toCode']
	toError: ErrorRuleBuilder<T>['toError']
}

type InferableInstanceShape = Error & {
	readonly code: string
	readonly title?: string
	readonly meta?: Record<string, unknown>
	readonly status?: number
	readonly retryable?: boolean
	readonly raw?: unknown
	readonly path?: string
	readonly cause?: unknown
}

type MappedTypedError<Out extends ErrorResponse, Input> = TypedError<
	Out['code'],
	Out['meta'] extends Record<string, unknown>
		? Out['meta']
		: Record<string, unknown>,
	Out['raw'] extends undefined ? Input : Out['raw']
>

const extractStaticCodeFromMapper = (mapper: (...args: never[]) => unknown) => {
	const source = mapper.toString()
	const match = source.match(/\bcode\s*:\s*['"`]([^'"`]+)['"`]/)
	return match?.[1]
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null

// Modern error rule builder with enhanced ergonomics
export class ErrorRuleBuilder<T> {
	constructor(private readonly predicate: (err: unknown) => err is T) {}

	toCode<const C extends string>(code: C) {
		return new ErrorMapper<T, C>(this.predicate, code)
	}

	// Map to a typed error instance (compatible with existing tests)
	// The returned rule is usable in createErrorNormalizer/tryo({ rules }).
	toError<const Out extends ErrorResponse>(
		mapper: (err: T) => Strict<Out, ErrorResponse>,
	): ErrorRule<MappedTypedError<Out, T>> {
		const rule: ErrorRule<MappedTypedError<Out, T>> = (err: unknown) => {
			if (!this.predicate(err)) return null
			const out = mapper(err as T)
			const code = out.code as Out['code']
			const cause = Object.hasOwn(out, 'cause') ? out.cause : err
			const meta = (out.meta ?? {}) as Out['meta'] extends Record<
				string,
				unknown
			>
				? Out['meta']
				: Record<string, unknown>

			class CustomError extends TypedError<
				Out['code'],
				Out['meta'] extends Record<string, unknown>
					? Out['meta']
					: Record<string, unknown>,
				Out['raw'] extends undefined ? T : Out['raw']
			> {
				readonly code = code
				constructor() {
					const raw = (
						Object.hasOwn(out, 'raw') ? out.raw : err
					) as Out['raw'] extends undefined ? T : Out['raw']

					super(out.message, {
						title: out.title,
						cause,
						meta,
						status: out.status,
						retryable: out.retryable,
						raw,
						path: out.path,
					})
				}
			}

			return new CustomError()
		}

		const staticCode = extractStaticCodeFromMapper(mapper)
		if (staticCode) {
			;(
				rule as ErrorRule<MappedTypedError<Out, T>> & { __tryoCode?: string }
			).__tryoCode = staticCode
		}

		return rule
	}
}

function instanceRule<T extends abstract new (...args: never[]) => unknown>(
	ErrorClass: T,
): InstanceType<T> extends InferableInstanceShape
	? InstanceRuleHandle<InstanceType<T>>
	: ErrorRuleBuilder<InstanceType<T>>
function instanceRule<
	T extends abstract new (
		...args: never[]
	) => unknown,
	const Out extends ErrorResponse,
>(
	ErrorClass: T,
	mapper: (err: InstanceType<T>) => Strict<Out, ErrorResponse>,
): ErrorRule<MappedTypedError<Out, InstanceType<T>>>
function instanceRule(
	ErrorClass: abstract new (...args: never[]) => unknown,
	mapper?: (err: unknown) => Strict<ErrorResponse, ErrorResponse>,
): unknown {
	const builder = new ErrorRuleBuilder(
		(err): err is unknown => err instanceof ErrorClass,
	)

	if (mapper) {
		return builder.toError(mapper)
	}

	const inferredRule: ErrorRule<AnyTypedError> = (err: unknown) => {
		if (!(err instanceof ErrorClass)) {
			return null
		}

		if (err instanceof TypedError) {
			return err as AnyTypedError
		}

		const candidate = err as Error & {
			code?: unknown
			title?: unknown
			meta?: unknown
			status?: unknown
			retryable?: unknown
			raw?: unknown
			path?: unknown
			cause?: unknown
		}

		const code =
			typeof candidate.code === 'string' && candidate.code.length > 0
				? candidate.code
				: 'UNKNOWN'

		const hasCause = Object.hasOwn(candidate, 'cause')
		const hasRaw = Object.hasOwn(candidate, 'raw')

		class InferredInstanceError extends TypedError<
			typeof code,
			Record<string, unknown>,
			unknown
		> {
			readonly code = code
			constructor() {
				super(candidate.message || code, {
					title:
						typeof candidate.title === 'string' ? candidate.title : undefined,
					cause: hasCause ? candidate.cause : err,
					meta: isRecord(candidate.meta) ? candidate.meta : {},
					status:
						typeof candidate.status === 'number' ? candidate.status : undefined,
					retryable:
						typeof candidate.retryable === 'boolean'
							? candidate.retryable
							: undefined,
					raw: hasRaw ? candidate.raw : err,
					path: typeof candidate.path === 'string' ? candidate.path : undefined,
				})
			}
		}

		return new InferredInstanceError()
	}

	const handle = inferredRule as InstanceRuleHandle<unknown>
	handle.toCode = builder.toCode.bind(builder)
	handle.toError = builder.toError.bind(builder)
	return handle
}

// Error mapper for code-based mapping
export class ErrorMapper<T, C extends string> {
	constructor(
		private readonly predicate: (err: unknown) => err is T,
		private readonly errorCode: C,
	) {}

	with<const Out extends MapperResponse>(
		mapper: (err: T) => Strict<Out, ErrorResponse>,
	): ErrorRule<
		TypedError<
			C,
			Out['meta'] extends Record<string, unknown>
				? Out['meta']
				: Record<string, unknown>,
			Out['raw'] extends undefined ? T : Out['raw']
		>
	> {
		const rule: ErrorRule<
			TypedError<
				C,
				Out['meta'] extends Record<string, unknown>
					? Out['meta']
					: Record<string, unknown>,
				Out['raw'] extends undefined ? T : Out['raw']
			>
		> = (err: unknown) => {
			if (!this.predicate(err)) return null
			const mapped = mapper(err as T) as Out
			const cause = Object.hasOwn(mapped, 'cause') ? mapped.cause : err
			const meta = (mapped.meta ?? {}) as Out['meta'] extends Record<
				string,
				unknown
			>
				? Out['meta']
				: Record<string, unknown>

			const errorCode = this.errorCode
			class CustomTypedError extends TypedError<
				C,
				Out['meta'] extends Record<string, unknown>
					? Out['meta']
					: Record<string, unknown>,
				Out['raw'] extends undefined ? T : Out['raw']
			> {
				readonly code = errorCode
				constructor() {
					const raw = Object.hasOwn(mapped, 'raw') ? mapped.raw : err
					const typedRaw = raw as Out['raw'] extends undefined ? T : Out['raw']
					super(mapped.message, {
						title: mapped.title,
						cause,
						meta,
						status: mapped.status,
						retryable: mapped.retryable,
						raw: typedRaw,
						path: mapped.path,
					})
				}
			}

			return new CustomTypedError()
		}

		;(rule as ErrorRule<TypedError<C>> & { __tryoCode?: C }).__tryoCode =
			this.errorCode

		return rule
	}
}

// Enhanced error rule factory with modern patterns
export const createErrorRule = {
	when: <T>(predicate: (err: unknown) => err is T) =>
		new ErrorRuleBuilder(predicate),
	instance: instanceRule,
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
