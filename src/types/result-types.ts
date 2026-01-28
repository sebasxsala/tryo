/**
 * Modern result types with enhanced discriminated unions
 * Provides better type safety and more granular result categorization
 */

import type { TypedError } from '../error/typed-error';
import type {
	ConcurrencyLimit,
	Milliseconds,
	RetryCount,
} from './branded-types';

// Core execution result union with precise discrimination
export type ExecutionResult<T, E extends TypedError = TypedError> =
	| SuccessResult<T, E>
	| FailureResult<E>
	| AbortedResult<E>
	| TimeoutResult<E>;

// Success result with metadata
export interface SuccessResult<T, E extends TypedError> {
	readonly type: 'success';
	readonly ok: true;
	readonly data: T;
	readonly error: null;
	readonly metrics?: ExecutionMetrics<E>;
}

// General failure result for errors
export interface FailureResult<E extends TypedError> {
	readonly type: 'failure';
	readonly ok: false;
	readonly data: null;
	readonly error: E;
	readonly metrics?: ExecutionMetrics<E>;
}

// Specific aborted result
export interface AbortedResult<E extends TypedError> {
	readonly type: 'aborted';
	readonly ok: false;
	readonly data: null;
	readonly error: E;
	readonly metrics?: ExecutionMetrics<E>;
}

// Specific timeout result
export interface TimeoutResult<E extends TypedError> {
	readonly type: 'timeout';
	readonly ok: false;
	readonly data: null;
	readonly error: E;
	readonly metrics?: ExecutionMetrics<E>;
}

// Enhanced execution metrics with detailed retry history
export interface ExecutionMetrics<E extends TypedError> {
	readonly totalAttempts: RetryCount;
	readonly totalRetries: RetryCount;
	readonly totalDuration: Milliseconds;
	readonly lastError?: E;
	readonly retryHistory: Array<{
		readonly attempt: RetryCount;
		readonly error: E;
		readonly delay: Milliseconds;
		readonly timestamp: Date;
	}>;
}

// Batch execution results for multiple tasks
export type BatchExecutionResult<T, E extends TypedError = TypedError> =
	| BatchSuccessResult<T, E>
	| BatchPartialResult<T, E>
	| BatchFailureResult<E>;

export interface BatchSuccessResult<T, E extends TypedError> {
	readonly type: 'success';
	readonly ok: true;
	readonly results: SuccessResult<T, E>[];
	readonly errors: never[];
	readonly metrics: BatchMetrics;
}

export interface BatchPartialResult<T, E extends TypedError> {
	readonly type: 'partial';
	readonly ok: false;
	readonly results: Array<
		SuccessResult<T, E> | FailureResult<E> | AbortedResult<E> | TimeoutResult<E>
	>;
	readonly errors: Array<
		FailureResult<E> | AbortedResult<E> | TimeoutResult<E>
	>;
	readonly metrics: BatchMetrics;
}

export interface BatchFailureResult<E extends TypedError> {
	readonly type: 'failure';
	readonly ok: false;
	readonly results: never[];
	readonly errors: Array<
		FailureResult<E> | AbortedResult<E> | TimeoutResult<E>
	>;
	readonly metrics: BatchMetrics;
}

// Batch execution metrics
export interface BatchMetrics {
	readonly totalTasks: number;
	readonly successfulTasks: number;
	readonly failedTasks: number;
	readonly abortedTasks: number;
	readonly timedOutTasks: number;
	readonly totalDuration: Milliseconds;
	readonly concurrencyLimit?: ConcurrencyLimit;
	readonly aggregateRetries: RetryCount;
}

// Type guards for runtime discrimination
export const isSuccess = <T, E extends TypedError>(
	result: ExecutionResult<T, E>,
): result is SuccessResult<T, E> => result.type === 'success';

export const isFailure = <T, E extends TypedError>(
	result: ExecutionResult<T, E>,
): result is FailureResult<E> => result.type === 'failure';

export const isAborted = <T, E extends TypedError>(
	result: ExecutionResult<T, E>,
): result is AbortedResult<E> => result.type === 'aborted';

export const isTimeout = <T, E extends TypedError>(
	result: ExecutionResult<T, E>,
): result is TimeoutResult<E> => result.type === 'timeout';

export const isBatchSuccess = <T, E extends TypedError>(
	result: BatchExecutionResult<T, E>,
): result is BatchSuccessResult<T, E> => result.type === 'success';

export const isBatchPartial = <T, E extends TypedError>(
	result: BatchExecutionResult<T, E>,
): result is BatchPartialResult<T, E> => result.type === 'partial';

export const isBatchFailure = <T, E extends TypedError>(
	result: BatchExecutionResult<T, E>,
): result is BatchFailureResult<E> => result.type === 'failure';

// Utility functions for result transformation
export const mapSuccess = <T, U, E extends TypedError>(
	result: ExecutionResult<T, E>,
	mapper: (data: T) => U,
): ExecutionResult<U, E> => {
	if (result.type === 'success') {
		return {
			...result,
			data: mapper(result.data),
		};
	}
	return result;
};

export const mapError = <T, E extends TypedError>(
	result: ExecutionResult<T, E>,
	mapper: (error: E) => E,
): ExecutionResult<T, E> => {
	if (result.type !== 'success') {
		return {
			...result,
			error: mapper(result.error),
			metrics: result.metrics
				? {
						...result.metrics,
						lastError: mapper(result.error),
					}
				: undefined,
		};
	}
	return result;
};
