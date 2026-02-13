/**
 * Modern result types with enhanced discriminated unions
 * Provides better type safety and more granular result categorization
 */

import type { TypedError } from '../error/typed-error';
import type { Milliseconds, RetryCount } from './branded-types';

// Core execution result union with precise discrimination
export type TryoResult<T, E extends TypedError = TypedError> =
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
	readonly metrics: TryoMetrics<E>;
}

// General failure result for errors
export interface FailureResult<E extends TypedError> {
	readonly type: 'failure';
	readonly ok: false;
	readonly data: null;
	readonly error: E;
	readonly metrics: TryoMetrics<E>;
}

// Specific aborted result
export interface AbortedResult<E extends TypedError> {
	readonly type: 'aborted';
	readonly ok: false;
	readonly data: null;
	readonly error: E;
	readonly metrics: TryoMetrics<E>;
}

// Specific timeout result
export interface TimeoutResult<E extends TypedError> {
	readonly type: 'timeout';
	readonly ok: false;
	readonly data: null;
	readonly error: E;
	readonly metrics: TryoMetrics<E>;
}

// Enhanced execution metrics with detailed retry history
export interface TryoMetrics<E extends TypedError> {
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

// Type guards for runtime discrimination
export const isSuccess = <T, E extends TypedError>(
	result: TryoResult<T, E>,
): result is SuccessResult<T, E> => result.type === 'success';

export const isFailure = <T, E extends TypedError>(
	result: TryoResult<T, E>,
): result is FailureResult<E> => result.type === 'failure';

export const isAborted = <T, E extends TypedError>(
	result: TryoResult<T, E>,
): result is AbortedResult<E> => result.type === 'aborted';

export const isTimeout = <T, E extends TypedError>(
	result: TryoResult<T, E>,
): result is TimeoutResult<E> => result.type === 'timeout';

// Utility functions for result transformation
export const mapSuccess = <T, U, E extends TypedError>(
	result: TryoResult<T, E>,
	mapper: (data: T) => U,
): TryoResult<U, E> => {
	if (result.type === 'success') {
		return {
			...result,
			data: mapper(result.data),
		};
	}
	return result;
};

export const mapError = <T, E extends TypedError>(
	result: TryoResult<T, E>,
	mapper: (error: E) => E,
): TryoResult<T, E> => {
	if (result.type !== 'success') {
		return {
			...result,
			error: mapper(result.error),
			metrics: {
				...result.metrics,
				lastError: mapper(result.error),
			},
		};
	}
	return result;
};
