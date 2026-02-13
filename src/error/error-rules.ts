/**
 * Built-in error rules for common error patterns
 * Provides ready-to-use error normalization rules
 */

import { BuiltinRules, createErrorRule } from './error-builder';
import type { ErrorRule } from './error-normalizer';

// Built-in error rules export
export { BuiltinRules };

// Combined built-in rules array
export const builtInRules: ErrorRule[] = [
	BuiltinRules.typed,
	BuiltinRules.abort,
	BuiltinRules.timeout,
	BuiltinRules.http,
	BuiltinRules.network,
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
