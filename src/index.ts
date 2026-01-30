/**
 * Public API: legacy runner-first.
 *
 * Default export is a factory (trybox) that creates an internal Executor.
 */

export type { Runner } from './core/execution';
export {
	execute,
	executeAll,
	executeAllOrThrow,
	executeOrThrow,
	executeOrThrowAll,
	partitionAll,
	run,
	runAll,
	runOrThrow,
	runOrThrowAll,
	trybox,
	trybox as default,
} from './core/execution';
export type { ExecutorOptions, RulesMode } from './core/executor';
export { errorRule } from './error/error-rules';
export { RetryStrategies } from './retry/retry-strategies';
export type {
	ConcurrencyLimit,
	Milliseconds,
	Percentage,
	RetryCount,
	StatusCode,
} from './types/branded-types';
export {
	asConcurrencyLimit,
	asMilliseconds,
	asPercentage,
	asRetryCount,
	asStatusCode,
} from './types/branded-types';
export type { ExecutionConfig } from './types/config-types';
export type {
	AbortedResult,
	ExecutionMetrics,
	ExecutionResult,
	FailureResult,
	SuccessResult,
	TimeoutResult,
} from './types/result-types';
