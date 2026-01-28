/**
 * Built-in error rules for common error patterns
 * Provides ready-to-use error normalization rules
 */

import { BuiltinRules, createErrorRule } from './error-builder';
import type { ErrorRule } from './error-normalizer';
import { CircuitOpenError, ValidationError } from './typed-error';

// Built-in error rules export
export { BuiltinRules };

// Combined built-in rules array
export const builtInRules: ErrorRule[] = [
	BuiltinRules.abort,
	BuiltinRules.timeout,
	BuiltinRules.network,
	BuiltinRules.http,
	BuiltinRules.unknown,
];

// Export createErrorRule for convenience
export { createErrorRule };

// Error rule factory for creating custom rules
export const errorRule = {
	when: <T>(predicate: (err: unknown) => err is T) =>
		createErrorRule.when(predicate),

	instance: <T extends new (...args: unknown[]) => unknown>(ErrorClass: T) =>
		createErrorRule.instance(ErrorClass),
} as const;

// Default error rule set
export const defaultRules = builtInRules;

// Timeout error rule
export const timeoutErrorRule: ErrorRule = BuiltinRules.timeout;

// Aborted error rule
export const abortedErrorRule: ErrorRule = BuiltinRules.abort;

// Network error rule
export const networkErrorRule: ErrorRule = BuiltinRules.network;

// HTTP error rule
export const httpErrorRule: ErrorRule = BuiltinRules.http;

// Circuit breaker error rule
export const circuitOpenErrorRule: ErrorRule = createErrorRule
	.when((err): err is CircuitOpenError => err instanceof CircuitOpenError)
	.toCode('CIRCUIT_OPEN')
	.with((err) => ({
		message: err.message,
		cause: err,
	}));

// Validation error rule
export const validationErrorRule: ErrorRule = createErrorRule
	.when((err): err is ValidationError => err instanceof ValidationError)
	.toCode('VALIDATION')
	.with((err) => ({
		message: err.message,
		cause: err,
	}));
