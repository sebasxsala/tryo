/**
 * Public API: legacy runner-first.
 *
 * Default export is a factory that creates an internal Executor instance.
 * The Executor class and the old functional facade are intentionally not
 * exported from the package surface.
 */

import type { ErrorRule } from './error/error-normalizer';
import type { TypedError } from './error/typed-error';
import type { ExecutionConfig } from './types/config-types';
import type { ExecutionResult } from './types/result-types';
import {
	createExecutor,
	type DefaultError,
	type ExecutorOptions,
	type InferErrorFromRules,
	type RulesMode,
} from './core/executor';

export { errorRule } from './error/error-rules';
export { RetryStrategies } from './retry/retry-strategies';

export {
	asConcurrencyLimit,
	asMilliseconds,
	asPercentage,
	asRetryCount,
	asStatusCode,
} from './types/branded-types';
export type {
	ConcurrencyLimit,
	Milliseconds,
	Percentage,
	RetryCount,
	StatusCode,
} from './types/branded-types';

export type { RulesMode, ExecutorOptions };
export type { ExecutionConfig } from './types/config-types';
export type {
	AbortedResult,
	ExecutionMetrics,
	ExecutionResult,
	FailureResult,
	SuccessResult,
	TimeoutResult,
} from './types/result-types';

export type Runner<E extends TypedError = TypedError> = {
	run: <T>(
		task: (ctx: { signal: AbortSignal }) => Promise<T>,
		options?: Partial<ExecutionConfig<E>>,
	) => Promise<ExecutionResult<T, E>>;
	execute: <T>(
		task: (ctx: { signal: AbortSignal }) => Promise<T>,
		options?: Partial<ExecutionConfig<E>>,
	) => Promise<ExecutionResult<T, E>>;
	runOrThrow: <T>(
		task: (ctx: { signal: AbortSignal }) => Promise<T>,
		options?: Partial<ExecutionConfig<E>>,
	) => Promise<T>;
	executeOrThrow: <T>(
		task: (ctx: { signal: AbortSignal }) => Promise<T>,
		options?: Partial<ExecutionConfig<E>>,
	) => Promise<T>;
	runAll: <T>(
		tasks: Array<(ctx: { signal: AbortSignal }) => Promise<T>>,
		options?: Partial<ExecutionConfig<E> & { concurrency?: number }>,
	) => Promise<Array<ExecutionResult<T, E>>>;
	executeAll: <T>(
		tasks: Array<(ctx: { signal: AbortSignal }) => Promise<T>>,
		options?: Partial<ExecutionConfig<E> & { concurrency?: number }>,
	) => Promise<Array<ExecutionResult<T, E>>>;
	runOrThrowAll: <T>(
		tasks: Array<(ctx: { signal: AbortSignal }) => Promise<T>>,
		options?: Partial<ExecutionConfig<E> & { concurrency?: number }>,
	) => Promise<T[]>;
	executeOrThrowAll: <T>(
		tasks: Array<(ctx: { signal: AbortSignal }) => Promise<T>>,
		options?: Partial<ExecutionConfig<E> & { concurrency?: number }>,
	) => Promise<T[]>;
};

export function trybox<const TRules extends readonly ErrorRule<TypedError>[]>(
	options: Omit<ExecutorOptions<InferErrorFromRules<TRules>>, 'rules'> & {
		rules: TRules;
	},
): Runner<InferErrorFromRules<TRules>>;
export function trybox<E extends TypedError = DefaultError>(
	options?: ExecutorOptions<E>,
): Runner<E>;
export function trybox<E extends TypedError = DefaultError>(
	options?: ExecutorOptions<E>,
): Runner<E> {
	const ex = createExecutor<E>(options);

	return {
		run: (task, runOptions) => ex.execute(task, runOptions),
		execute: (task, runOptions) => ex.execute(task, runOptions),
		runOrThrow: (task, runOptions) => ex.executeOrThrow(task, runOptions),
		executeOrThrow: (task, runOptions) => ex.executeOrThrow(task, runOptions),
		runAll: (tasks, runOptions) => ex.executeAll(tasks, runOptions),
		executeAll: (tasks, runOptions) => ex.executeAll(tasks, runOptions),
		runOrThrowAll: (tasks, runOptions) =>
			ex.executeAllOrThrow(tasks, runOptions),
		executeOrThrowAll: (tasks, runOptions) =>
			ex.executeAllOrThrow(tasks, runOptions),
	};
}

export default trybox;

let singleton: Runner | undefined;
const getSingleton = (): Runner => {
	if (!singleton) singleton = trybox();
	return singleton;
};

export const execute = <T, E extends TypedError = DefaultError>(
	task: (ctx: { signal: AbortSignal }) => Promise<T>,
	options?: Partial<ExecutionConfig<E>>,
) => getSingleton().execute(task, options as Partial<ExecutionConfig>);

export const executeOrThrow = <T, E extends TypedError = DefaultError>(
	task: (ctx: { signal: AbortSignal }) => Promise<T>,
	options?: Partial<ExecutionConfig<E>>,
) => getSingleton().executeOrThrow(task, options as Partial<ExecutionConfig>);

export const executeAll = <T, E extends TypedError = DefaultError>(
	tasks: Array<(ctx: { signal: AbortSignal }) => Promise<T>>,
	options?: Partial<ExecutionConfig<E> & { concurrency?: number }>,
) =>
	getSingleton().executeAll(
		tasks,
		options as Partial<ExecutionConfig & { concurrency?: number }>,
	);

export const executeAllOrThrow = <T, E extends TypedError = DefaultError>(
	tasks: Array<(ctx: { signal: AbortSignal }) => Promise<T>>,
	options?: Partial<ExecutionConfig<E> & { concurrency?: number }>,
) =>
	getSingleton().executeOrThrowAll(
		tasks,
		options as Partial<ExecutionConfig & { concurrency?: number }>,
	);

export const executeOrThrowAll = executeAllOrThrow;

export const run = execute;
export const runOrThrow = executeOrThrow;
export const runAll = executeAll;
export const runOrThrowAll = executeAllOrThrow;
