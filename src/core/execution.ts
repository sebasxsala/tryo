/**
 * Internal execution facade used by the public API.
 */

import type { ErrorRule } from '../error/error-normalizer';
import type { TypedError } from '../error/typed-error';
import type { ExecutionConfig } from '../types/config-types';
import type { ExecutionResult } from '../types/result-types';
import {
	createExecutor,
	type DefaultError,
	type ExecutorOptions,
	type InferErrorFromRules,
} from './executor';

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

let singleton: ReturnType<typeof createExecutor> | undefined;
const getSingletonExecutor = () => {
	if (!singleton) singleton = createExecutor();
	return singleton;
};

export function execute<T, E extends TypedError = DefaultError>(
	task: (ctx: { signal: AbortSignal }) => Promise<T>,
	options?: Partial<ExecutionConfig<E>>,
) {
	return getSingletonExecutor().execute(
		task,
		options as Partial<ExecutionConfig>,
	);
}

export function executeOrThrow<T, E extends TypedError = DefaultError>(
	task: (ctx: { signal: AbortSignal }) => Promise<T>,
	options?: Partial<ExecutionConfig<E>>,
) {
	return getSingletonExecutor().executeOrThrow(
		task,
		options as Partial<ExecutionConfig>,
	);
}

export function executeAll<T, E extends TypedError = DefaultError>(
	tasks: Array<(ctx: { signal: AbortSignal }) => Promise<T>>,
	options?: Partial<ExecutionConfig<E> & { concurrency?: number }>,
) {
	return getSingletonExecutor().executeAll(
		tasks,
		options as Partial<ExecutionConfig & { concurrency?: number }>,
	);
}

export function executeAllOrThrow<T, E extends TypedError = DefaultError>(
	tasks: Array<(ctx: { signal: AbortSignal }) => Promise<T>>,
	options?: Partial<ExecutionConfig<E> & { concurrency?: number }>,
) {
	return getSingletonExecutor().executeAllOrThrow(
		tasks,
		options as Partial<ExecutionConfig & { concurrency?: number }>,
	);
}

export const executeOrThrowAll = executeAllOrThrow;

export const run = execute;
export const runOrThrow = executeOrThrow;
export const runAll = executeAll;
export const runOrThrowAll = executeAllOrThrow;

export function partitionAll<T, E extends TypedError = DefaultError>(
	results: ExecutionResult<T, E>[],
) {
	return getSingletonExecutor().partitionAll(
		results as ExecutionResult<T, E>[],
	);
}
