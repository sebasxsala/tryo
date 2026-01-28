/**
 * Modern typed error hierarchy with enhanced capabilities
 * Provides type-safe error handling with fluent API and metadata support
 */

import type { Milliseconds } from '../types/branded-types';

// Base typed error class with enhanced capabilities
export abstract class TypedError<
	Code extends string = string,
	Meta = unknown,
> extends Error {
	abstract readonly code: Code;
	readonly cause?: unknown;
	readonly meta?: Meta;
	readonly status?: number;
	readonly timestamp: Date;

	constructor(
		message: string,
		opts?: { cause?: unknown; meta?: Meta; status?: number },
	) {
		super(message);
		this.timestamp = new Date();
		this.name = this.constructor.name;
		(this as { cause?: unknown }).cause = opts?.cause;
		(this as { meta?: Meta }).meta = opts?.meta;
		(this as { status?: number }).status = opts?.status;

		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor);
		}
	}

	// Type-safe error code checking
	is<C extends string>(code: C): this is TypedError<C> & { code: C } {
		return (this.code as string) === code;
	}

	// Chainable metadata attachment
	withMeta<const M>(meta: M): this & { meta: M } {
		return Object.assign(this, { meta });
	}

	// Chainable status code attachment
	withStatus(status: number): this & { status: number } {
		return Object.assign(this, { status });
	}

	// Chainable cause attachment
	withCause(cause: unknown): this & { cause: unknown } {
		return Object.assign(this, { cause });
	}

	// Convert to JSON representation
	toJSON(): Record<string, unknown> {
		return {
			name: this.name,
			code: this.code,
			message: this.message,
			timestamp: this.timestamp.toISOString(),
			cause: this.cause,
			stack: this.stack,
		};
	}
}

// Built-in error types with enhanced capabilities
export class TimeoutError extends TypedError<'TIMEOUT'> {
	readonly code = 'TIMEOUT' as const;

	constructor(timeout: Milliseconds, cause?: unknown) {
		super(`Operation timed out after ${timeout}ms`, { cause });
	}
}

export class AbortedError extends TypedError<'ABORTED'> {
	readonly code = 'ABORTED' as const;

	constructor(reason?: string, cause?: unknown) {
		super(reason || 'Operation was aborted', { cause });
	}
}

export class CircuitOpenError extends TypedError<'CIRCUIT_OPEN'> {
	readonly code = 'CIRCUIT_OPEN' as const;

	constructor(resetAfter: Milliseconds, cause?: unknown) {
		super(`Circuit breaker is open, reset after ${resetAfter}ms`, { cause });
	}
}

type ValidationMeta = { validationErrors: unknown[] };

export class ValidationError extends TypedError<'VALIDATION', ValidationMeta> {
	readonly code = 'VALIDATION' as const;

	constructor(
		message: string,
		public readonly validationErrors: unknown[],
		cause?: unknown,
	) {
		super(message, { cause, meta: { validationErrors } });
	}
}

export class NetworkError extends TypedError<'NETWORK'> {
	readonly code = 'NETWORK' as const;

	constructor(
		message: string,
		public readonly statusCode?: number,
		cause?: unknown,
	) {
		super(message, { cause, status: statusCode });
	}
}

type HttpMeta = { response?: unknown };

export class HttpError extends TypedError<'HTTP', HttpMeta> {
	readonly code = 'HTTP' as const;

	constructor(
		message: string,
		public readonly status: number,
		public readonly response?: unknown,
		cause?: unknown,
	) {
		super(message, { cause, status, meta: { response } });
	}
}

export class UnknownError extends TypedError<'UNKNOWN'> {
	readonly code = 'UNKNOWN' as const;

	constructor(message: string, cause?: unknown) {
		super(message, { cause });
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
	| 'UNKNOWN';

// Error factory functions for convenience
export const createTimeoutError = (
	timeout: Milliseconds,
	cause?: unknown,
): TimeoutError => new TimeoutError(timeout, cause);

export const createAbortedError = (
	reason?: string,
	cause?: unknown,
): AbortedError => new AbortedError(reason, cause);

export const createCircuitOpenError = (
	resetAfter: Milliseconds,
	cause?: unknown,
): CircuitOpenError => new CircuitOpenError(resetAfter, cause);

export const createValidationError = (
	message: string,
	errors: unknown[],
	cause?: unknown,
): ValidationError => new ValidationError(message, errors, cause);

export const createNetworkError = (
	message: string,
	statusCode?: number,
	cause?: unknown,
): NetworkError => new NetworkError(message, statusCode, cause);

export const createHttpError = (
	message: string,
	status: number,
	response?: unknown,
	cause?: unknown,
): HttpError => new HttpError(message, status, response, cause);

export const createUnknownError = (cause?: unknown): UnknownError =>
	new UnknownError('Unknown error occurred', cause);
