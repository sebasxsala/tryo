/**
 * Thin functional facade over a singleton Executor.
 * No business logic lives here; it forwards to `src/core/executor.ts`.
 */

import type { TypedError } from '../error/typed-error';
import type { ExecutionConfig } from '../types/config-types';
import { Executor, type ExecutorOptions } from './executor';

let singleton: Executor<TypedError> | undefined;

export const getExecutor = <E extends TypedError = TypedError>(
	options?: ExecutorOptions<E>,
): Executor<E> => {
	if (!options) {
		if (!singleton) singleton = new Executor();
		return singleton as unknown as Executor<E>;
	}
	return new Executor<E>(options);
};

export async function execute<T, E extends TypedError = TypedError>(
	task: (ctx: { signal: AbortSignal }) => Promise<T>,
	options?: Partial<ExecutionConfig<E>>,
) {
	return getExecutor<E>().execute(task, options);
}

export async function executeOrThrow<T, E extends TypedError = TypedError>(
	task: (ctx: { signal: AbortSignal }) => Promise<T>,
	options?: Partial<ExecutionConfig<E>>,
) {
	return getExecutor<E>().executeOrThrow(task, options);
}

export async function executeAll<T, E extends TypedError = TypedError>(
	tasks: Array<(ctx: { signal: AbortSignal }) => Promise<T>>,
	options?: Partial<ExecutionConfig<E> & { concurrency?: number }>,
) {
	return getExecutor<E>().executeAll(tasks, options);
}

export async function executeAllOrThrow<T, E extends TypedError = TypedError>(
	tasks: Array<(ctx: { signal: AbortSignal }) => Promise<T>>,
	options?: Partial<ExecutionConfig<E> & { concurrency?: number }>,
) {
	return getExecutor<E>().executeAllOrThrow(tasks, options);
}
