/**
 * Modern executor with enhanced capabilities
 * Provides comprehensive task execution with circuit breaker and retry logic
 */

import { CircuitBreaker } from '../circuit-breaker/breaker';
import type { ErrorNormalizer, ErrorRule } from '../error/error-normalizer';
import {
	createErrorNormalizer,
	createFallbackNormalizer,
} from '../error/error-normalizer';
import { defaultRules } from '../error/error-rules';
import {
	type AbortedError,
	type CircuitOpenError,
	type HttpError,
	type NetworkError,
	TimeoutError,
	type TypedError,
	UnknownError,
	type ValidationError,
} from '../error/typed-error';
import { calculateDelay } from '../retry/retry-strategies';
import type { Milliseconds, RetryCount } from '../types/branded-types';
import type { ExecutionConfig } from '../types/config-types';
import type { ExecutionMetrics, ExecutionResult } from '../types/result-types';
import { sleep } from '../utils/timing';

// Modern executor with enhanced capabilities
export type RulesMode = 'extend' | 'replace';

export type DefaultError =
	| AbortedError
	| TimeoutError
	| NetworkError
	| HttpError
	| CircuitOpenError
	| ValidationError
	| UnknownError;

type NonNull<T> = T extends null ? never : T;
type RuleReturn<R> = R extends (err: unknown) => infer Out
	? NonNull<Out>
	: never;

export type InferErrorFromRules<
	TRules extends readonly ErrorRule<TypedError>[],
> = TRules extends readonly []
	? TypedError
	: RuleReturn<TRules[number]> | UnknownError;

export type ExecutorOptions<E extends TypedError = TypedError> = Omit<
	Partial<ExecutionConfig<E>>,
	'errorHandling'
> & {
	rules?: Array<ErrorRule<E>>;
	rulesMode?: RulesMode;
	fallback?: (err: unknown) => E;
	toError?: (err: unknown) => E;
	mapError?: (error: E) => E;
};

const buildNormalizer = <E extends TypedError>(
	opts: ExecutorOptions<E>,
): ErrorNormalizer<E> => {
	if (opts.toError) return opts.toError;

	const rulesMode: RulesMode = opts.rulesMode ?? 'extend';
	const userRules = (opts.rules ?? []) as Array<ErrorRule<E>>;
	const builtins = defaultRules as unknown as Array<ErrorRule<E>>;

	const fallback =
		opts.fallback ??
		((err: unknown) =>
			createFallbackNormalizer(
				UnknownError as unknown as new (
					message: string,
					cause?: unknown,
				) => E,
			)(err));

	const rules =
		rulesMode === 'replace' ? userRules : [...userRules, ...builtins];
	return createErrorNormalizer(rules, fallback);
};

export class Executor<E extends TypedError = TypedError> {
	private readonly circuitBreaker?: CircuitBreaker<E>;
	private readonly config: ExecutionConfig<E>;

	constructor(options: ExecutorOptions<E> = {}) {
		const {
			rules: _rules,
			rulesMode: _rulesMode,
			fallback: _fallback,
			toError: _toError,
			mapError,
			...executionConfig
		} = options;
		const normalizer = buildNormalizer(options);
		const baseConfig: ExecutionConfig<E> = {
			...executionConfig,
			errorHandling: {
				normalizer,
				mapError,
			},
		};

		this.config = baseConfig;

		if (baseConfig.circuitBreaker) {
			this.circuitBreaker = new CircuitBreaker(baseConfig.circuitBreaker);
		}
	}

	// Execute a single task
	async execute<T>(
		task: (ctx: { signal: AbortSignal }) => Promise<T>,
		options: Partial<ExecutionConfig<E>> = {},
	): Promise<ExecutionResult<T, E>> {
		const mergedConfig = { ...this.config, ...options };

		// Circuit breaker check
		if (this.circuitBreaker) {
			const canExecute = await this.circuitBreaker.canExecute();
			if (!canExecute) {
				const error = this.circuitBreaker.createOpenError() as E;

				const result: ExecutionResult<T, E> = {
					type: 'failure',
					ok: false,
					data: null,
					error,
					metrics: {
						totalAttempts: 0 as RetryCount,
						totalRetries: 0 as RetryCount,
						totalDuration: 0 as Milliseconds,
						retryHistory: [],
					},
				};

				return result;
			}
		}

		const result = await executeInternal(task, mergedConfig);

		// Update circuit breaker state
		if (this.circuitBreaker) {
			if (result.ok) {
				await this.circuitBreaker.recordSuccess();
			} else {
				await this.circuitBreaker.recordFailure(result.error);
			}
		}

		return result;
	}

	async executeOrThrow<T>(
		task: (ctx: { signal: AbortSignal }) => Promise<T>,
		options: Partial<ExecutionConfig<E>> = {},
	): Promise<T> {
		const r = await this.execute(task, options);
		if (r.ok) return r.data;
		throw r.error;
	}

	// Execute multiple tasks with concurrency control
	async executeAll<T>(
		tasks: Array<(ctx: { signal: AbortSignal }) => Promise<T>>,
		options: Partial<ExecutionConfig<E> & { concurrency?: number }> = {},
	): Promise<ExecutionResult<T, E>[]> {
		const mergedConfig = { ...this.config, ...options };
		const concurrency = mergedConfig.concurrency ?? Number.POSITIVE_INFINITY;

		const out: ExecutionResult<T, E>[] = new Array(tasks.length);
		let idx = 0;

		const worker = async () => {
			while (true) {
				const current = idx;
				idx++;
				if (current >= tasks.length) return;
				const task = tasks[current];
				if (!task) return;
				out[current] = await this.execute(task, mergedConfig);
			}
		};

		const workers = Array.from(
			{ length: Math.min(concurrency, tasks.length) },
			() => worker(),
		);
		await Promise.all(workers);

		return out;
	}

	async executeAllOrThrow<T>(
		tasks: Array<(ctx: { signal: AbortSignal }) => Promise<T>>,
		options: Partial<ExecutionConfig<E> & { concurrency?: number }> = {},
	): Promise<T[]> {
		const results = await this.executeAll(tasks, options);
		for (const r of results) {
			if (!r.ok) throw r.error;
		}
		return results.map((r) => {
			if (!r.ok) throw r.error;
			return r.data;
		});
	}

	// (additional helpers removed; prefer compose outside)

	// Get current circuit breaker state
	getCircuitBreakerState() {
		return this.circuitBreaker?.getState();
	}

	// Reset circuit breaker
	resetCircuitBreaker(): void {
		this.circuitBreaker?.reset();
	}

	// Get executor configuration
	getConfig(): ExecutionConfig<E> {
		return { ...this.config };
	}

	// Create a new executor with merged configuration
	withConfig(additionalConfig: Partial<ExecutionConfig<E>>): Executor<E> {
		const { errorHandling: _currentHandling, ...baseConfig } = this.config;
		const { errorHandling: _newHandling, ...extraConfig } = additionalConfig;
		return new Executor<E>({
			...baseConfig,
			...extraConfig,
		});
	}

	// Create a new executor with different error type
	withErrorType<T extends TypedError>(
		config: Partial<ExecutionConfig<T>> = {},
	): Executor<T> {
		return new Executor<T>(config as ExecutionConfig<T>);
	}
}

export function createExecutor<E extends TypedError = DefaultError>(
	options?: ExecutorOptions<E>,
): Executor<E> {
	return new Executor<E>(options);
}

async function executeInternal<T, E extends TypedError>(
	task: (ctx: { signal: AbortSignal }) => Promise<T>,
	config: ExecutionConfig<E>,
): Promise<ExecutionResult<T, E>> {
	const {
		signal: outerSignal,
		ignoreAbort = true,
		timeout,
		retry,
		errorHandling,
		hooks,
		logger,
	} = config;

	let lastError: E | undefined;
	let totalAttempts = 0 as RetryCount;
	let totalRetries = 0 as RetryCount;
	const retryHistory: Array<{
		attempt: RetryCount;
		error: E;
		delay: Milliseconds;
		timestamp: Date;
	}> = [];
	const startTime = Date.now();

	const compositeSignal = createCompositeSignal(outerSignal);
	if (compositeSignal.aborted) {
		// normalize abort immediately
		const e = errorHandling.normalizer(
			new DOMException('Aborted', 'AbortError'),
		);
		const mapped = errorHandling.mapError ? errorHandling.mapError(e) : e;
		return {
			type: 'aborted',
			ok: false,
			data: null,
			error: mapped,
			metrics: {
				totalAttempts,
				totalRetries,
				totalDuration: (Date.now() - startTime) as Milliseconds,
				lastError: mapped,
				retryHistory,
			},
		};
	}

	const runAttempt = async (attempt: number): Promise<T> => {
		totalAttempts = attempt as RetryCount;
		try {
			const p = task({ signal: compositeSignal });
			const data = timeout
				? await withTimeout(p, timeout, compositeSignal)
				: await p;
			hooks?.onSuccess?.(data);
			logger?.info?.(`Task succeeded on attempt ${attempt}`);
			return data;
		} catch (err) {
			const norm = errorHandling.normalizer(err);
			const mapped = errorHandling.mapError
				? errorHandling.mapError(norm)
				: norm;
			lastError = mapped;

			if (!(ignoreAbort && mapped.code === 'ABORTED')) {
				hooks?.onError?.(mapped);
				logger?.error?.(`Task failed on attempt ${attempt}`, mapped);
			}

			if (attempt <= (retry?.maxRetries ?? (0 as RetryCount))) {
				const shouldRetry = retry?.shouldRetry;
				const ctx = {
					totalAttempts: totalAttempts,
					elapsedTime: (Date.now() - startTime) as Milliseconds,
					startTime: new Date(startTime),
					lastDelay: retryHistory[retryHistory.length - 1]?.delay,
				};

				if (!shouldRetry || shouldRetry(attempt as RetryCount, mapped, ctx)) {
					const delay = retry
						? (calculateDelay(
								retry.strategy,
								attempt as RetryCount,
								mapped,
							) as Milliseconds)
						: (0 as Milliseconds);

					retryHistory.push({
						attempt: attempt as RetryCount,
						error: mapped,
						delay,
						timestamp: new Date(),
					});

					totalRetries = (attempt - 1) as RetryCount;
					hooks?.onRetry?.(attempt as RetryCount, mapped, delay);
					logger?.info?.(`Retrying in ${delay}ms (attempt ${attempt + 1})`);

					await sleep(delay as number, compositeSignal);
					return runAttempt(attempt + 1);
				}
			}

			throw mapped;
		}
	};

	try {
		const data = await runAttempt(1);
		const metrics: ExecutionMetrics<E> = {
			totalAttempts,
			totalRetries,
			totalDuration: (Date.now() - startTime) as Milliseconds,
			retryHistory,
		};
		hooks?.onFinally?.(metrics);
		return { type: 'success', ok: true, data, error: null, metrics };
	} catch (err) {
		const finalError = (lastError ?? (errorHandling.normalizer(err) as E)) as E;
		const kind: 'failure' | 'timeout' | 'aborted' =
			finalError.code === 'TIMEOUT'
				? 'timeout'
				: finalError.code === 'ABORTED'
					? 'aborted'
					: 'failure';

		const metrics: ExecutionMetrics<E> = {
			totalAttempts,
			totalRetries,
			totalDuration: (Date.now() - startTime) as Milliseconds,
			lastError: finalError,
			retryHistory,
		};

		hooks?.onFinally?.(metrics);
		return {
			type: kind,
			ok: false,
			data: null,
			error: finalError,
			metrics,
		};
	}
}

function createCompositeSignal(signal?: AbortSignal): AbortSignal {
	const controller = new AbortController();
	if (!signal) return controller.signal;
	const abort = () => controller.abort();
	if (signal.aborted) {
		abort();
		return controller.signal;
	}
	signal.addEventListener('abort', abort, { once: true });
	return controller.signal;
}

async function withTimeout<T>(
	promise: Promise<T>,
	timeout: Milliseconds,
	signal?: AbortSignal,
): Promise<T> {
	const timeoutPromise = sleep(timeout as number, signal).then(() => {
		throw new TimeoutError(timeout);
	});
	return Promise.race([promise, timeoutPromise]);
}
