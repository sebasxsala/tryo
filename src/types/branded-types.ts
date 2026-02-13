/**
 * Branded types for enhanced type safety and runtime validation
 * These provide compile-time guarantees while maintaining runtime checks
 */

// Branded primitive types with runtime validation
export type Milliseconds = number & { readonly __brand: 'Milliseconds' }
export type RetryCount = number & { readonly __brand: 'RetryCount' }
export type ConcurrencyLimit = number & {
	readonly __brand: 'ConcurrencyLimit'
}
export type Percentage = number & { readonly __brand: 'Percentage' }
export type StatusCode = number & { readonly __brand: 'StatusCode' }

// Runtime validation functions that return branded types
export const asMilliseconds = (n: number): Milliseconds => {
	if (n < 0 || !Number.isFinite(n)) {
		throw new Error(
			`Invalid milliseconds: must be a non-negative finite number, got ${n}`,
		)
	}
	return n as Milliseconds
}

export const asRetryCount = (n: number): RetryCount => {
	if (n < 0 || !Number.isInteger(n)) {
		throw new Error(
			`Invalid retry count: must be a non-negative integer, got ${n}`,
		)
	}
	return n as RetryCount
}

export const asConcurrencyLimit = (n: number): ConcurrencyLimit => {
	if (n < 1 || !Number.isInteger(n)) {
		throw new Error(
			`Invalid concurrency limit: must be a positive integer, got ${n}`,
		)
	}
	return n as ConcurrencyLimit
}

export const asPercentage = (n: number): Percentage => {
	if (n < 0 || n > 100 || !Number.isFinite(n)) {
		throw new Error(`Invalid percentage: must be between 0 and 100, got ${n}`)
	}
	return n as Percentage
}

export const asStatusCode = (n: number): StatusCode => {
	if (!Number.isInteger(n) || n < 100 || n > 599) {
		throw new Error(
			`Invalid status code: must be an integer between 100-599, got ${n}`,
		)
	}
	return n as StatusCode
}

// Type guards for branded types
export const isMilliseconds = (n: number): n is Milliseconds =>
	n >= 0 && Number.isFinite(n)

export const isRetryCount = (n: number): n is RetryCount =>
	n >= 0 && Number.isInteger(n)

export const isConcurrencyLimit = (n: number): n is ConcurrencyLimit =>
	n >= 1 && Number.isInteger(n)

export const isPercentage = (n: number): n is Percentage =>
	n >= 0 && n <= 100 && Number.isFinite(n)

export const isStatusCode = (n: number): n is StatusCode =>
	Number.isInteger(n) && n >= 100 && n <= 599

// Utility functions for branded types
export const max = (
	a: Milliseconds | RetryCount | ConcurrencyLimit,
	b: Milliseconds | RetryCount | ConcurrencyLimit,
): typeof a => ((a as number) > (b as number) ? a : b)

export const min = (
	a: Milliseconds | RetryCount | ConcurrencyLimit,
	b: Milliseconds | RetryCount | ConcurrencyLimit,
): typeof a => ((a as number) < (b as number) ? a : b)
