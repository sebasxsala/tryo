/**
 * Public API (final phase): Executor-first.
 * Legacy runner/trybox/run/runAll removed.
 */

export {
	execute,
	executeAll,
	executeAllOrThrow,
	executeOrThrow,
	getExecutor,
} from './core/execution';
export type { ExecutorOptions, RulesMode } from './core/executor';
export { Executor } from './core/executor';

export { errorRule } from './error/error-rules';

export type { ExecutionConfig } from './types/config-types';
export type {
	AbortedResult,
	ExecutionMetrics,
	ExecutionResult,
	FailureResult,
	SuccessResult,
	TimeoutResult,
} from './types/result-types';
