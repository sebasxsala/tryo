/**
 * Configuration types for modern execution engine
 * Provides comprehensive configuration with type safety
 */

import type { CircuitBreakerConfig } from '../circuit-breaker/breaker-config';
import type { ErrorNormalizer } from '../error/error-normalizer';
import type { TypedError } from '../error/typed-error';
import type { RetryStrategy } from '../retry/retry-strategies';
import type {
	ConcurrencyLimit,
	Milliseconds,
	Percentage,
	RetryCount,
} from './branded-types';

// Main execution configuration
export interface ExecutionConfig<E extends TypedError = TypedError> {
	/** Abort signal passed to tasks */
	readonly signal?: AbortSignal;

	/** If true, aborts are treated as non-throwing failures */
	readonly ignoreAbort?: boolean;

	/** Timeout configuration */
	readonly timeout?: Milliseconds;

	/** Retry configuration */
	readonly retry?: RetryConfig<E>;

	/** Circuit breaker configuration */
	readonly circuitBreaker?: CircuitBreakerConfig<E>;

	/** Error handling configuration */
	readonly errorHandling: ErrorHandlingConfig<E>;

	/** Concurrency configuration for batch operations */
	readonly concurrency?: ConcurrencyLimit;

	/** Logging configuration */
	readonly logger?: LoggerConfig<E>;

	/** Callback hooks */
	readonly hooks?: HookConfig<E>;
}

// Retry configuration
export interface RetryConfig<E extends TypedError> {
	/** Maximum number of retry attempts */
	readonly maxRetries: RetryCount;

	/** Base delay strategy */
	readonly strategy: RetryStrategy;

	/** Jitter configuration to prevent thundering herd */
	readonly jitter?: JitterConfig;

	/** Function to determine if retry should be attempted */
	readonly shouldRetry?: ShouldRetryPredicate<E>;
}

// Jitter configuration
export type JitterConfig =
	| { type: 'none' }
	| { type: 'full'; ratio: Percentage }
	| { type: 'equal'; ratio: Percentage }
	| { type: 'custom'; calculate: (delay: Milliseconds) => Milliseconds };

// Type for retry predicate function
export type ShouldRetryPredicate<E extends TypedError> = (
	attempt: RetryCount,
	error: E,
	context: RetryContext,
) => boolean;

// Retry context information
export interface RetryContext {
	/** Total attempts made so far */
	readonly totalAttempts: RetryCount;

	/** Elapsed time since start */
	readonly elapsedTime: Milliseconds;

	/** Start timestamp */
	readonly startTime: Date;

	/** Last delay applied */
	readonly lastDelay?: Milliseconds;
}

// Error handling configuration
export interface ErrorHandlingConfig<E extends TypedError> {
	/** Error normalizer function */
	readonly normalizer: ErrorNormalizer<E>;

	/** Optional error mapping/transformation */
	readonly mapError?: (error: E) => E;
}

// Logger configuration
export interface LoggerConfig<E extends TypedError> {
	/** Debug logging function */
	readonly debug?: (message: string, meta?: unknown) => void;

	/** Error logging function */
	readonly error?: (message: string, error: E) => void;

	/** Info logging function */
	readonly info?: (message: string, meta?: unknown) => void;

	/** Warning logging function */
	readonly warn?: (message: string, meta?: unknown) => void;
}

// Hook configuration for lifecycle events
export interface HookConfig<E extends TypedError> {
	/** Called on successful execution */
	readonly onSuccess?: <T>(data: T, metrics?: ExecutionMetrics<E>) => void;

	/** Called on failed execution */
	readonly onError?: (error: E, metrics?: ExecutionMetrics<E>) => void;

	/** Called always, success or failure */
	readonly onFinally?: (metrics?: ExecutionMetrics<E>) => void;

	/** Called on abort */
	readonly onAbort?: (signal: AbortSignal) => void;

	/** Called before retry attempt */
	readonly onRetry?: (
		attempt: RetryCount,
		error: E,
		delay: Milliseconds,
	) => void;

	/** Called when circuit breaker state changes */
	readonly onCircuitStateChange?: (
		from: CircuitState,
		to: CircuitState,
	) => void;
}

// Circuit breaker state enum
export type CircuitState = 'closed' | 'open' | 'half-open';

// Execution metrics (re-export from result-types for convenience)
export type ExecutionMetrics<E extends TypedError> =
	import('./result-types').ExecutionMetrics<E>;

// Default configuration builder
export const createExecutionConfig = <E extends TypedError>(
	config: Partial<ExecutionConfig<E>> = {},
): ExecutionConfig<E> => ({
	errorHandling: {
		normalizer: ((err: unknown) => {
			throw err;
		}) as ErrorNormalizer<E>,
	},
	...config,
});

// Jitter configuration builders
export const JitterConfig = {
	none: (): JitterConfig => ({ type: 'none' }),

	full: (ratio: Percentage = 50 as Percentage): JitterConfig => ({
		type: 'full',
		ratio,
	}),

	equal: (ratio: Percentage = 50 as Percentage): JitterConfig => ({
		type: 'equal',
		ratio,
	}),

	custom: (calculate: (delay: Milliseconds) => Milliseconds): JitterConfig => ({
		type: 'custom',
		calculate,
	}),
} as const;
