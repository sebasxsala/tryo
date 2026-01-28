/**
 * Runtime validation utilities with type safety
 * Provides validation functions for common patterns
 */

import type {
	ConcurrencyLimit,
	Milliseconds,
	Percentage,
	RetryCount,
	StatusCode,
} from '../types/branded-types';

// Validation result type
export type ValidationResult<T = void> =
	| { valid: true; value: T }
	| { valid: false; error: string };

// Generic validation function
export const validate = <T>(
	value: unknown,
	validator: (value: unknown) => value is T,
	errorMessage: string,
): ValidationResult<T> => {
	if (validator(value)) {
		return { valid: true, value };
	}
	return { valid: false, error: errorMessage };
};

// Validate branded types
export const validateMilliseconds = (
	value: unknown,
): ValidationResult<Milliseconds> => {
	return validate(
		value,
		(v): v is Milliseconds =>
			typeof v === 'number' && v >= 0 && Number.isFinite(v),
		`Invalid milliseconds: must be a non-negative finite number, got ${value}`,
	);
};

export const validateRetryCount = (
	value: unknown,
): ValidationResult<RetryCount> => {
	return validate(
		value,
		(v): v is RetryCount =>
			typeof v === 'number' && v >= 0 && Number.isInteger(v),
		`Invalid retry count: must be a non-negative integer, got ${value}`,
	);
};

export const validateConcurrencyLimit = (
	value: unknown,
): ValidationResult<ConcurrencyLimit> => {
	return validate(
		value,
		(v): v is ConcurrencyLimit =>
			typeof v === 'number' && v >= 1 && Number.isInteger(v),
		`Invalid concurrency limit: must be a positive integer, got ${value}`,
	);
};

export const validatePercentage = (
	value: unknown,
): ValidationResult<Percentage> => {
	return validate(
		value,
		(v): v is Percentage =>
			typeof v === 'number' && v >= 0 && v <= 100 && Number.isFinite(v),
		`Invalid percentage: must be between 0 and 100, got ${value}`,
	);
};

export const validateStatusCode = (
	value: unknown,
): ValidationResult<StatusCode> => {
	return validate(
		value,
		(v): v is StatusCode =>
			typeof v === 'number' && Number.isInteger(v) && v >= 100 && v <= 599,
		`Invalid status code: must be an integer between 100-599, got ${value}`,
	);
};

// Validate objects with required properties
export const validateObject = <T extends Record<string, unknown>>(
	value: unknown,
	required: Array<keyof T>,
	optional: Array<keyof T> = [],
): ValidationResult<T> => {
	if (!value || typeof value !== 'object') {
		return { valid: false, error: `Expected object, got ${typeof value}` };
	}

	const obj = value as T;
	const errors: string[] = [];

	// Check required properties
	for (const key of required) {
		if (!(key in obj)) {
			errors.push(`Missing required property: ${String(key)}`);
		}
	}

	// Check for unknown properties
	const allowedKeys = new Set([...required, ...optional]);
	const unknownKeys = Object.keys(obj).filter(
		(key) => !allowedKeys.has(key as keyof T),
	);

	if (unknownKeys.length > 0) {
		errors.push(`Unknown properties: ${unknownKeys.join(', ')}`);
	}

	if (errors.length > 0) {
		return { valid: false, error: errors.join('; ') };
	}

	return { valid: true, value: obj };
};

// Validate arrays
export const validateArray = <T>(
	value: unknown,
	itemValidator: (item: unknown) => item is T,
	minLength = 0,
	maxLength?: number,
): ValidationResult<T[]> => {
	if (!Array.isArray(value)) {
		return { valid: false, error: `Expected array, got ${typeof value}` };
	}

	if (value.length < minLength) {
		return {
			valid: false,
			error: `Array must have at least ${minLength} items, got ${value.length}`,
		};
	}

	if (maxLength !== undefined && value.length > maxLength) {
		return {
			valid: false,
			error: `Array must have at most ${maxLength} items, got ${value.length}`,
		};
	}

	// Validate each item
	for (let i = 0; i < value.length; i++) {
		if (!itemValidator(value[i])) {
			return {
				valid: false,
				error: `Invalid item at index ${i}: ${JSON.stringify(value[i])}`,
			};
		}
	}

	return { valid: true, value };
};

// Validate functions
export const validateFunction = <T extends (...args: unknown[]) => unknown>(
	value: unknown,
	arity?: number,
): ValidationResult<T> => {
	if (typeof value !== 'function') {
		return { valid: false, error: `Expected function, got ${typeof value}` };
	}

	if (arity !== undefined && value.length !== arity) {
		return {
			valid: false,
			error: `Expected function with ${arity} parameters, got ${value.length}`,
		};
	}

	return { valid: true, value: value as T };
};

// Validate strings
export const validateString = (
	value: unknown,
	options: { minLength?: number; maxLength?: number; pattern?: RegExp } = {},
): ValidationResult<string> => {
	if (typeof value !== 'string') {
		return { valid: false, error: `Expected string, got ${typeof value}` };
	}

	const { minLength = 0, maxLength, pattern } = options;

	if (value.length < minLength) {
		return {
			valid: false,
			error: `String must have at least ${minLength} characters, got ${value.length}`,
		};
	}

	if (maxLength !== undefined && value.length > maxLength) {
		return {
			valid: false,
			error: `String must have at most ${maxLength} characters, got ${value.length}`,
		};
	}

	if (pattern && !pattern.test(value)) {
		return { valid: false, error: `String does not match required pattern` };
	}

	return { valid: true, value };
};

// Validate email addresses
export const validateEmail = (value: unknown): ValidationResult<string> => {
	return validateString(value, {
		pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
	});
};

// Validate URLs
export const validateUrl = (value: unknown): ValidationResult<string> => {
	try {
		if (typeof value !== 'string') {
			return { valid: false, error: `Expected string, got ${typeof value}` };
		}

		new URL(value);
		return { valid: true, value };
	} catch {
		return { valid: false, error: `Invalid URL: ${value}` };
	}
};

// Combine multiple validators
export const validateAll = <T = unknown>(
	value: unknown,
	validators: Array<(value: unknown) => ValidationResult>,
): ValidationResult<T> => {
	for (const validator of validators) {
		const result = validator(value);
		if (!result.valid) {
			return result;
		}
	}

	return { valid: true, value: value as T };
};
