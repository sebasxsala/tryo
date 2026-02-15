/**
 * Modern typed error hierarchy with enhanced capabilities
 * Provides type-safe error handling with fluent API and metadata support
 */

import type { Milliseconds } from '../types/branded-types'

type DefaultErrorMeta = Record<string, unknown>

// Base typed error class with enhanced capabilities
export abstract class TypedError<
	Code extends string = string,
	Meta extends object = DefaultErrorMeta,
	Raw = unknown,
> extends Error {
	abstract readonly code: Code
	cause?: unknown
	readonly title?: string
	meta: Meta
	status?: number
	raw?: Raw
	path?: string
	readonly timestamp: number
	retryable: boolean

	constructor(
		message: string,
		opts: {
			title?: string
			cause?: unknown
			meta?: Meta
			status?: number
			retryable?: boolean
			raw?: Raw
			path?: string
		},
	) {
		super(message)
		this.timestamp = Date.now()
		this.retryable = opts.retryable ?? true
		this.name = this.constructor.name
		this.cause = opts.cause
		this.title = opts.title
		this.meta = (opts.meta ?? ({} as unknown as Meta)) as Meta
		this.status = opts.status
		this.raw = opts.raw
		this.path = opts.path

		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor)
		}
	}

	// Type-safe error code checking
	is<C extends string>(
		code: C,
	): this is TypedError<C, Meta, Raw> & { code: C } {
		return (this.code as string) === code
	}
	// Chainable metadata attachment
	withMeta<const M extends object>(meta: M): this & { meta: M } {
		this.meta = meta as unknown as Meta
		return this as this & { meta: M }
	}

	// Chainable status code attachment
	withStatus(status: number): this & { status: number } {
		this.status = status
		return this as this & { status: number }
	}

	// Chainable cause attachment
	withCause(cause: unknown): this & { cause: unknown } {
		this.cause = cause
		return this as this & { cause: unknown }
	}

	// Chainable path attachment
	withPath(path: string): this {
		this.path = path
		return this
	}

	// Chainable raw attachment
	withRaw<const R>(raw: R): this & { raw: R } {
		this.raw = raw as unknown as Raw
		return this as this & { raw: R }
	}

	// Chainable retryable flag
	withRetryable(retryable: boolean): this {
		this.retryable = retryable
		return this
	}

	// Convert to JSON representation
	toJSON(): Record<string, unknown> {
		return {
			name: this.name,
			code: this.code,
			title: this.title,
			message: this.message,
			meta: this.meta,
			status: this.status,
			timestamp: this.timestamp,
			retryable: this.retryable,
			cause: this.cause,
			raw: this.raw,
			path: this.path,
			stack: this.stack,
		}
	}
}

export type AnyTypedError = TypedError

// Built-in error types with enhanced capabilities
export class TimeoutError extends TypedError<'TIMEOUT'> {
	readonly code = 'TIMEOUT' as const

	constructor(timeout: Milliseconds, cause?: unknown) {
		super(`Operation timed out after ${timeout}ms`, {
			cause,
			retryable: true,
		})
	}
}

export class AbortedError extends TypedError<'ABORTED'> {
	readonly code = 'ABORTED' as const

	constructor(reason?: string, cause?: unknown) {
		super(reason || 'Operation was aborted', {
			cause,
			retryable: false,
		})
	}
}

export class CircuitOpenError extends TypedError<'CIRCUIT_OPEN'> {
	readonly code = 'CIRCUIT_OPEN' as const

	constructor(resetAfter: Milliseconds, cause?: unknown) {
		super(`Circuit breaker is open, reset after ${resetAfter}ms`, {
			cause,
			retryable: false,
		})
	}
}

type ValidationMeta = { validationErrors: unknown[] }

export class ValidationError extends TypedError<'VALIDATION', ValidationMeta> {
	readonly code = 'VALIDATION' as const

	constructor(
		message: string,
		public readonly validationErrors: unknown[],
		cause?: unknown,
	) {
		super(message, {
			cause,
			meta: { validationErrors },
			retryable: false,
		})
	}
}

export class NetworkError extends TypedError<'NETWORK'> {
	readonly code = 'NETWORK' as const

	constructor(
		message: string,
		public readonly statusCode?: number,
		cause?: unknown,
	) {
		super(message, {
			cause,
			status: statusCode,
			retryable: true,
		})
	}
}

type HttpMeta = { response?: unknown }

export class HttpError extends TypedError<'HTTP', HttpMeta> {
	readonly code = 'HTTP' as const

	constructor(
		message: string,
		public readonly status: number,
		public readonly response?: unknown,
		cause?: unknown,
	) {
		const isRetryable = status >= 500 || status === 429
		super(message, {
			cause,
			status,
			meta: { response },
			retryable: isRetryable,
			raw: response,
		})
	}
}

export class UnknownError extends TypedError<'UNKNOWN'> {
	readonly code = 'UNKNOWN' as const

	constructor(message: string, cause?: unknown) {
		super(message, { cause })
	}
}

// Error code union for built-in errors
export type BuiltInErrorCode =
	| 'TIMEOUT'
	| 'ABORTED'
	| 'CIRCUIT_OPEN'
	| 'VALIDATION'
	| 'NETWORK'
	| 'HTTP'
	| 'UNKNOWN'
