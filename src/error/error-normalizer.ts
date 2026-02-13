/**
 * Modern error normalization system
 * Provides type-safe error transformation and normalization
 */

import { TypedError } from './typed-error';

// Error normalizer function type
export type ErrorNormalizer<E extends TypedError = TypedError> = (
	error: unknown,
) => E;

// Built-in error normalizer rules
export type ErrorRule<E extends TypedError = TypedError> = (
	error: unknown,
) => E | null;

// Create error normalizer from rules
export const createErrorNormalizer = <E extends TypedError>(
	rules: ErrorRule<E>[],
	fallback: ErrorNormalizer<E>,
): ErrorNormalizer<E> => {
	return (error: unknown): E => {
		for (const rule of rules) {
			const result = rule(error);
			if (result !== null) {
				return result;
			}
		}
		return fallback(error);
	};
};

// Create default fallback normalizer
export const createFallbackNormalizer = <E extends TypedError>(
	ErrorClass: new (message: string, cause?: unknown) => E,
): ErrorNormalizer<E> => {
	return (error: unknown): E => {
		if (error instanceof TypedError) {
			return error as unknown as E;
		}

		if (error instanceof Error) {
			return new ErrorClass(error.message, error);
		}
		if (typeof error === 'string') {
			return new ErrorClass(error);
		}
		return new ErrorClass('Unknown error occurred', error);
	};
};
