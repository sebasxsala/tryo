/**
 * Configuration types for modern execution engine
 * Provides comprehensive configuration with type safety
 */

import type {
	CircuitBreakerConfig,
	CircuitState,
} from '../circuit-breaker/breaker'
import type { ErrorNormalizer } from '../error/error-normalizer'
import type { TypedError } from '../error/typed-error'
import type { RetryStrategy } from '../retry/retry-strategies'

// Main execution configuration
export interface TryoConfig<E extends TypedError = TypedError> {
	/** Abort signal passed to tasks */
	readonly signal?: AbortSignal

	/** If true, aborts are treated as non-throwing failures */
	readonly ignoreAbort?: boolean

	/** Timeout configuration */
	readonly timeout?: number

	/** Retry configuration */
	readonly retry?: RetryConfig<E>

	/** Circuit breaker configuration */
	readonly circuitBreaker?: CircuitBreakerConfig<E>

	/** Error handling configuration */
	readonly errorHandling: ErrorHandlingConfig<E>

	/** Concurrency configuration for batch operations */
	readonly concurrency?: number

	/** Logging configuration */
	readonly logger?: LoggerConfig<E>

	/** Callback hooks */
	readonly hooks?: HookConfig<E>
}

// Retry configuration
export interface RetryConfig<E extends TypedError> {
	/** Maximum number of retry attempts */
	readonly maxRetries: number

	/** Base delay strategy */
	readonly strategy: RetryStrategy

	/** Jitter configuration to prevent thundering herd */
	readonly jitter?: JitterConfig

	/** Function to determine if retry should be attempted */
	readonly shouldRetry?: ShouldRetryPredicate<E>
}

// Jitter configuration
export type JitterConfig =
	| { type: 'none' }
	| { type: 'full'; ratio: number }
	| { type: 'equal'; ratio: number }
	| { type: 'custom'; calculate: (delay: number) => number }

// Type for retry predicate function
export type ShouldRetryPredicate<E extends TypedError> = (
	attempt: number,
	error: E,
	context: RetryContext,
) => boolean

// Retry context information
export interface RetryContext {
	/** Total attempts made so far */
	readonly totalAttempts: number

	/** Elapsed time since start */
	readonly elapsedTime: number

	/** Start timestamp */
	readonly startTime: Date

	/** Last delay applied */
	readonly lastDelay?: number
}

// Error handling configuration
export interface ErrorHandlingConfig<E extends TypedError> {
	/** Error normalizer function */
	readonly normalizer: ErrorNormalizer<E>

	/** Optional error mapping/transformation */
	readonly mapError?: (error: E) => E
}

// Logger configuration
export interface LoggerConfig<E extends TypedError> {
	/** Debug logging function */
	readonly debug?: (message: string, meta?: unknown) => void

	/** Error logging function */
	readonly error?: (message: string, error: E) => void

	/** Info logging function */
	readonly info?: (message: string, meta?: unknown) => void

	/** Warning logging function */
	readonly warn?: (message: string, meta?: unknown) => void
}

// Hook configuration for lifecycle events
export interface HookConfig<E extends TypedError> {
	/** Called on successful execution */
	readonly onSuccess?: <T>(data: T, metrics?: TryoMetrics<E>) => void

	/** Called on failed execution */
	readonly onError?: (error: E, metrics?: TryoMetrics<E>) => void

	/** Called always, success or failure */
	readonly onFinally?: (metrics?: TryoMetrics<E>) => void

	/** Called on abort */
	readonly onAbort?: (signal: AbortSignal) => void

	/** Called before retry attempt */
	readonly onRetry?: (attempt: number, error: E, delay: number) => void

	/** Called when circuit breaker state changes */
	readonly onCircuitStateChange?: (from: CircuitState, to: CircuitState) => void
}

// Execution metrics (re-export from result-types for convenience)
export type TryoMetrics<E extends TypedError> =
	import('./result-types').TryoMetrics<E>

// Default configuration builder
export const createTryoConfig = <E extends TypedError>(
	config: Partial<TryoConfig<E>> = {},
): TryoConfig<E> => ({
	errorHandling: {
		normalizer: ((err: unknown) => {
			throw err
		}) as ErrorNormalizer<E>,
	},
	...config,
})

// Jitter configuration builders
export const JitterConfig = {
	none: (): JitterConfig => ({ type: 'none' }),

	full: (ratio: number = 50): JitterConfig => ({
		type: 'full',
		ratio,
	}),

	equal: (ratio: number = 50): JitterConfig => ({
		type: 'equal',
		ratio,
	}),

	custom: (calculate: (delay: number) => number): JitterConfig => ({
		type: 'custom',
		calculate,
	}),
} as const
