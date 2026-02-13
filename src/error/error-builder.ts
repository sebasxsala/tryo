/**
 * Modern fluent error rule builder
 * Provides type-safe error rule creation with enhanced ergonomics
 */

import type { ErrorRule } from './error-normalizer';
import { TypedError } from './typed-error';

type StatusCarrier = {
	status?: number;
	statusCode?: number;
	message?: string;
};

type CodeCarrier = {
	code?: string;
	message?: string;
	name?: string;
};

const hasNumericStatus = (err: unknown): err is StatusCarrier => {
	if (typeof err !== 'object' || err === null) return false;
	const candidate = err as StatusCarrier;
	return (
		typeof candidate.status === 'number' ||
		typeof candidate.statusCode === 'number'
	);
};

const hasStringCode = (err: unknown): err is CodeCarrier => {
	if (typeof err !== 'object' || err === null) return false;
	const candidate = err as CodeCarrier;
	return typeof candidate.code === 'string' && candidate.code.length > 0;
};

const isNetworkish = (err: unknown): err is Error | CodeCarrier => {
	if (err instanceof Error) {
		// Common fetch/network errors in browsers/Bun/Node.
		if (err.name === 'TypeError') return true;
		const msg = err.message.toLowerCase();
		if (msg.includes('fetch') && msg.includes('failed')) return true;
		if (msg.includes('network')) return true;
	}

	if (hasStringCode(err)) {
		const code = (err.code ?? '').toUpperCase();
		return (
			code === 'ECONNRESET' ||
			code === 'ECONNREFUSED' ||
			code === 'ETIMEDOUT' ||
			code === 'ENOTFOUND' ||
			code === 'EAI_AGAIN'
		);
	}

	return false;
};

// Modern error rule builder with enhanced ergonomics
export class ErrorRuleBuilder<T> {
	constructor(private readonly predicate: (err: unknown) => err is T) {}

	toCode<const C extends string>(code: C) {
		return new ErrorMapper<T, C>(this.predicate, code);
	}

	// Map to a typed error instance (compatible with existing tests)
	// The returned rule is usable in createErrorNormalizer/tryo({ rules }).
	toError<
		const Out extends {
			code: string;
			message: string;
			meta?: unknown;
			status?: number;
			cause?: unknown;
			retryable?: boolean;
		},
	>(mapper: (err: T) => Out): ErrorRule<TypedError<Out['code'], Out['meta']>> {
		return (err: unknown) => {
			if (!this.predicate(err)) return null;
			const out = mapper(err as T);
			const code = out.code as Out['code'];

			class CustomError extends TypedError<Out['code'], Out['meta']> {
				readonly code = code;
				constructor() {
					super(out.message, {
						cause: out.cause ?? err,
						meta: out.meta,
						status: out.status,
						retryable: out.retryable,
					});
				}
			}

			return new CustomError();
		};
	}
}

// Error mapper for code-based mapping
export class ErrorMapper<T, C extends string> {
	constructor(
		private readonly predicate: (err: unknown) => err is T,
		private readonly errorCode: C,
	) {}

	with<const M = unknown>(
		mapper: (err: T) => {
			message: string;
			cause?: unknown;
			meta?: M;
			status?: number;
			retryable?: boolean;
		},
	) {
		return (err: unknown): TypedError<C, M> | null => {
			if (!this.predicate(err)) return null;
			const mapped = mapper(err);

			const errorCode = this.errorCode;
			class CustomTypedError extends TypedError<C, M> {
				readonly code = errorCode;
				constructor() {
					super(mapped.message, {
						cause: mapped.cause,
						meta: mapped.meta,
						status: mapped.status,
						retryable: mapped.retryable,
					});
				}
			}

			return new CustomTypedError();
		};
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
} as const;

// Built-in error rule presets
export const BuiltinRules = {
	// Preserve TypedError instances as-is
	typed: ((err: unknown): TypedError | null =>
		err instanceof TypedError ? err : null) as ErrorRule<TypedError>,

	// Abort errors
	abort: createErrorRule
		.when(
			(err): err is DOMException =>
				err instanceof DOMException && err.name === 'AbortError',
		)
		.toCode('ABORTED')
		.with((err) => ({
			message: err.message || 'Operation was aborted',
			cause: err,
			retryable: false,
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
		})),

	// Network errors
	network: createErrorRule
		.when((err): err is Error | CodeCarrier => isNetworkish(err))
		.toCode('NETWORK')
		.with((err) => {
			const message =
				err instanceof Error
					? err.message || 'Network error'
					: err.message || 'Network error';
			return {
				message,
				cause: err,
			};
		}),

	// HTTP errors (4xx, 5xx)
	http: createErrorRule
		.when((err): err is StatusCarrier => {
			if (!hasNumericStatus(err)) {
				return false;
			}
			const candidate = err as StatusCarrier;
			const status = candidate.status ?? candidate.statusCode;
			return typeof status === 'number' && status >= 400;
		})
		.toCode('HTTP')
		.with((err) => {
			const status = err.status ?? err.statusCode;
			const isRetryable =
				typeof status === 'number' && (status >= 500 || status === 429);
			return {
				message: err.message || `HTTP ${status ?? 'error'} error`,
				cause: err,
				status: typeof status === 'number' ? status : undefined,
				retryable: isRetryable,
			};
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
		})),
} as const;
