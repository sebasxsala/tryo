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
import {
	asConcurrencyLimit,
	asMilliseconds,
	asRetryCount,
	type Milliseconds,
	type RetryCount,
} from '../types/branded-types';
import type { JitterConfig, TryoConfig } from '../types/config-types';
import type {
	AbortedResult,
	FailureResult,
	SuccessResult,
	TimeoutResult,
	TryoMetrics,
	TryoResult,
} from '../types/result-types';
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

export type TryoOptions<E extends TypedError = TypedError> = Omit<
	Partial<TryoConfig<E>>,
	'errorHandling' | 'signal'
> & {
	rules?: Array<ErrorRule<E>>;
	rulesMode?: RulesMode;
	fallback?: (err: unknown) => E;
	toError?: (err: unknown) => E;
	mapError?: (error: E) => E;
};

const buildNormalizer = <E extends TypedError>(
	opts: TryoOptions<E>,
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

export class TryoEngine<E extends TypedError = TypedError> {
	private readonly circuitBreaker?: CircuitBreaker<E>;
	private readonly config: TryoConfig<E>;
	private lastCircuitState?: 'closed' | 'open' | 'half-open';

	constructor(options: TryoOptions<E> = {}) {
		const {
			rules: _rules,
			rulesMode: _rulesMode,
			fallback: _fallback,
			toError: _toError,
			mapError,
			...executionConfig
		} = options;
		const normalizer = buildNormalizer(options);
		const baseConfig: TryoConfig<E> = {
			...executionConfig,
			errorHandling: {
				normalizer,
				mapError,
			},
		};

		this.config = baseConfig;

		if (baseConfig.circuitBreaker) {
			this.circuitBreaker = new CircuitBreaker(baseConfig.circuitBreaker);
			this.lastCircuitState = this.circuitBreaker.getState().state;
		}
	}

	// Execute a single task
	async run<T>(
		task: (ctx: { signal: AbortSignal }) => Promise<T>,
		options: Partial<TryoConfig<E>> = {},
	): Promise<TryoResult<T, E>> {
		const mergedConfig = { ...this.config, ...options };

		// Circuit breaker check
		if (this.circuitBreaker) {
			const before =
				this.lastCircuitState ?? this.circuitBreaker.getState().state;
			const canExecute = await this.circuitBreaker.canExecute();
			const after = this.circuitBreaker.getState().state;
			if (before !== after) {
				try {
					mergedConfig.hooks?.onCircuitStateChange?.(before, after);
				} catch {
					// Hooks must never affect control flow.
				}
			}
			this.lastCircuitState = after;
			if (!canExecute) {
				const error = this.circuitBreaker.createOpenError() as E;

				const result: TryoResult<T, E> = {
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
			const before =
				this.lastCircuitState ?? this.circuitBreaker.getState().state;
			if (result.ok) {
				await this.circuitBreaker.recordSuccess();
			} else {
				await this.circuitBreaker.recordFailure(result.error);
			}
			const after = this.circuitBreaker.getState().state;
			if (before !== after) {
				try {
					mergedConfig.hooks?.onCircuitStateChange?.(before, after);
				} catch {
					// Hooks must never affect control flow.
				}
			}
			this.lastCircuitState = after;
		}

		return result;
	}

	async runOrThrow<T>(
		task: (ctx: { signal: AbortSignal }) => Promise<T>,
		options: Partial<TryoConfig<E>> = {},
	): Promise<T> {
		const r = await this.run(task, options);
		if (r.ok) return r.data;
		throw r.error;
	}

	async orThrow<T>(
		task: (ctx: { signal: AbortSignal }) => Promise<T>,
		options: Partial<TryoConfig<E>> = {},
	): Promise<T> {
		const r = await this.run(task, options);
		if (r.ok) return r.data;
		throw r.error;
	}

	// Execute multiple tasks with concurrency control
	async all<T>(
		tasks: Array<(ctx: { signal: AbortSignal }) => Promise<T>>,
		options: Partial<TryoConfig<E> & { concurrency?: number }> = {},
	): Promise<TryoResult<T, E>[]> {
		const mergedConfig = { ...this.config, ...options };
		const rawConcurrency = mergedConfig.concurrency ?? Number.POSITIVE_INFINITY;
		const concurrency = Number.isFinite(rawConcurrency)
			? Number(asConcurrencyLimit(rawConcurrency))
			: Number.POSITIVE_INFINITY;

		const out: TryoResult<T, E>[] = new Array(tasks.length);
		let idx = 0;

		const worker = async () => {
			while (idx < tasks.length) {
				// Optimization: Stop launching new tasks if the signal is already aborted
				if (mergedConfig.signal?.aborted) break;

				const current = idx++;
				if (current >= tasks.length) break;

				const task = tasks[current];
				if (!task) continue;

				out[current] = await this.run(task, mergedConfig);
			}
		};

		const workers = Array.from(
			{ length: Math.min(concurrency, tasks.length) },
			() => worker(),
		);

		await Promise.all(workers);

		// Consistency: Ensure every task has a result (especially if aborted early)
		for (let i = 0; i < tasks.length; i++) {
			if (!(i in out)) {
				const task = tasks[i];
				if (task) {
					// run() will immediately return an aborted result since signal is aborted
					out[i] = await this.run(task, mergedConfig);
				}
			}
		}

		return out;
	}

	async allOrThrow<T>(
		tasks: Array<(ctx: { signal: AbortSignal }) => Promise<T>>,
		options: Partial<TryoConfig<E> & { concurrency?: number }> = {},
	): Promise<T[]> {
		const results = await this.all(tasks, options);
		for (const r of results) {
			if (!r.ok) throw r.error;
		}
		return results.map((r) => {
			if (!r.ok) throw r.error;
			return r.data;
		});
	}

	partitionAll<T>(results: Array<TryoResult<T, E>>): {
		ok: Array<SuccessResult<T, E>>;
		errors: Array<FailureResult<E> | AbortedResult<E> | TimeoutResult<E>>;
		failure: Array<FailureResult<E>>;
		aborted: Array<AbortedResult<E>>;
		timeout: Array<TimeoutResult<E>>;
	} {
		const ok: Array<SuccessResult<T, E>> = [];
		const errors: Array<
			FailureResult<E> | AbortedResult<E> | TimeoutResult<E>
		> = [];
		const failure: Array<FailureResult<E>> = [];
		const aborted: Array<AbortedResult<E>> = [];
		const timeout: Array<TimeoutResult<E>> = [];

		for (const r of results) {
			if (r.type === 'success') {
				ok.push(r);
				continue;
			}

			errors.push(r);
			switch (r.type) {
				case 'failure':
					failure.push(r);
					break;
				case 'aborted':
					aborted.push(r);
					break;
				case 'timeout':
					timeout.push(r);
					break;
			}
		}

		return { ok, errors, failure, aborted, timeout };
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
	getConfig(): TryoConfig<E> {
		return { ...this.config };
	}

	// Create a new executor with merged configuration
	withConfig(
		additionalConfig: Omit<Partial<TryoConfig<E>>, 'signal'>,
	): Tryo<E> {
		const { errorHandling: currentHandling, ...baseConfig } = this.config;
		const { errorHandling: nextHandling, ...extraConfig } = additionalConfig;

		const normalizer = nextHandling?.normalizer ?? currentHandling.normalizer;
		const mapError = nextHandling?.mapError ?? currentHandling.mapError;

		return new TryoEngine<E>({
			...baseConfig,
			...extraConfig,
			toError: normalizer,
			mapError,
		});
	}

	// Create a new executor with different error type
	withErrorType<T extends TypedError>(
		config: Partial<TryoConfig<T>> = {},
	): TryoEngine<T> {
		return new TryoEngine<T>(config as TryoConfig<T>);
	}
}

export function tryo<const TRules extends readonly ErrorRule<TypedError>[]>(
	options: Omit<TryoOptions<InferErrorFromRules<TRules>>, 'rules'> & {
		rules: TRules;
	},
): Tryo<InferErrorFromRules<TRules>>;
export function tryo<E extends TypedError = DefaultError>(
	options?: TryoOptions<E>,
): Tryo<E>;
export function tryo<E extends TypedError = DefaultError>(
	options: TryoOptions<E> = {},
): Tryo<E> {
	const engine = new TryoEngine(options);

	return {
		run: (task, opts) => engine.run(task, opts),
		orThrow: (task, opts) => engine.orThrow(task, opts),
		runOrThrow: (task, opts) => engine.runOrThrow(task, opts),
		all: (tasks, opts) => engine.all(tasks, opts),
		allOrThrow: (tasks, opts) => engine.allOrThrow(tasks, opts),
		partitionAll: (results) => engine.partitionAll(results),
		withConfig: (opts) => engine.withConfig(opts),
	};
}

async function executeInternal<T, E extends TypedError>(
	task: (ctx: { signal: AbortSignal }) => Promise<T>,
	config: TryoConfig<E>,
): Promise<TryoResult<T, E>> {
	const {
		signal: outerSignal,
		ignoreAbort = true,
		timeout,
		retry,
		errorHandling,
		hooks,
		logger,
	} = config;

	const safeCall = (
		fn: ((...args: unknown[]) => unknown) | undefined,
		...args: unknown[]
	) => {
		try {
			fn?.(...args);
		} catch {
			// Observability must never affect control flow.
		}
	};

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

	const { signal: compositeSignal, cleanup: cleanupCompositeSignal } =
		createCompositeSignal(outerSignal);

	try {
		if (compositeSignal.aborted) {
			safeCall(
				hooks?.onAbort as unknown as (...a: unknown[]) => unknown,
				compositeSignal,
			);
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
				safeCall(
					hooks?.onSuccess as unknown as (...a: unknown[]) => unknown,
					data,
				);
				safeCall(
					logger?.info as unknown as (...a: unknown[]) => unknown,
					`Task succeeded on attempt ${attempt}`,
				);
				return data;
			} catch (err) {
				const norm = errorHandling.normalizer(err);
				const mapped = errorHandling.mapError
					? errorHandling.mapError(norm)
					: norm;
				lastError = mapped;
				if (mapped.code === 'ABORTED') {
					safeCall(
						hooks?.onAbort as unknown as (...a: unknown[]) => unknown,
						compositeSignal,
					);
				}

				if (!(ignoreAbort && mapped.code === 'ABORTED')) {
					safeCall(
						hooks?.onError as unknown as (...a: unknown[]) => unknown,
						mapped,
					);
					safeCall(
						logger?.error as unknown as (...a: unknown[]) => unknown,
						`Task failed on attempt ${attempt}`,
						mapped,
					);
				}

				const maxRetries = asRetryCount(retry?.maxRetries ?? 0);
				if (attempt <= Number(maxRetries)) {
					const shouldRetry = retry?.shouldRetry;
					const ctx = {
						totalAttempts: Number(totalAttempts) as unknown as number,
						elapsedTime: (Date.now() - startTime) as number,
						startTime: new Date(startTime),
						lastDelay: retryHistory[retryHistory.length - 1]?.delay
							? Number(retryHistory[retryHistory.length - 1]?.delay)
							: undefined,
					};

					if (!shouldRetry || shouldRetry(attempt, mapped, ctx)) {
						const baseDelayMs = retry
							? calculateDelay(retry.strategy, attempt as RetryCount, mapped)
							: 0;
						const delayMs = applyJitter(baseDelayMs, retry?.jitter);
						const delay = asMilliseconds(delayMs);

						retryHistory.push({
							attempt: attempt as RetryCount,
							error: mapped,
							delay,
							timestamp: new Date(),
						});
						safeCall(
							hooks?.onRetry as unknown as (...a: unknown[]) => unknown,
							attempt,
							mapped,
							delayMs,
						);
						safeCall(
							logger?.info as unknown as (...a: unknown[]) => unknown,
							`Retrying in ${delayMs}ms (attempt ${attempt + 1})`,
						);

						await sleep(delay as number, compositeSignal);
						return runAttempt(attempt + 1);
					}
				}

				throw mapped;
			}
		};

		try {
			const data = await runAttempt(1);
			totalRetries =
				totalAttempts > (0 as RetryCount)
					? ((Number(totalAttempts) - 1) as RetryCount)
					: (0 as RetryCount);
			const metrics: TryoMetrics<E> = {
				totalAttempts,
				totalRetries,
				totalDuration: (Date.now() - startTime) as Milliseconds,
				retryHistory,
			};
			safeCall(
				hooks?.onFinally as unknown as (...a: unknown[]) => unknown,
				metrics,
			);
			return { type: 'success', ok: true, data, error: null, metrics };
		} catch (err) {
			const finalError = (lastError ??
				(errorHandling.normalizer(err) as E)) as E;
			const kind: 'failure' | 'timeout' | 'aborted' =
				finalError.code === 'TIMEOUT'
					? 'timeout'
					: finalError.code === 'ABORTED'
						? 'aborted'
						: 'failure';

			totalRetries =
				totalAttempts > (0 as RetryCount)
					? ((Number(totalAttempts) - 1) as RetryCount)
					: (0 as RetryCount);

			const metrics: TryoMetrics<E> = {
				totalAttempts,
				totalRetries,
				totalDuration: (Date.now() - startTime) as Milliseconds,
				lastError: finalError,
				retryHistory,
			};

			safeCall(
				hooks?.onFinally as unknown as (...a: unknown[]) => unknown,
				metrics,
			);
			return {
				type: kind,
				ok: false,
				data: null,
				error: finalError,
				metrics,
			};
		}
	} finally {
		cleanupCompositeSignal();
	}
}

function createCompositeSignal(signal?: AbortSignal): {
	signal: AbortSignal;
	cleanup: () => void;
} {
	const controller = new AbortController();
	if (!signal) {
		return { signal: controller.signal, cleanup: () => {} };
	}

	const abort = () => controller.abort();
	if (signal.aborted) {
		abort();
		return { signal: controller.signal, cleanup: () => {} };
	}

	signal.addEventListener('abort', abort, { once: true });
	return {
		signal: controller.signal,
		cleanup: () => signal.removeEventListener('abort', abort),
	};
}

async function withTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
	signal?: AbortSignal,
): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		if (signal?.aborted) {
			reject(new DOMException('Aborted', 'AbortError'));
			return;
		}

		let settled = false;
		const timeoutId = setTimeout(() => {
			settled = true;
			cleanup();
			reject(new TimeoutError(asMilliseconds(timeoutMs)));
		}, timeoutMs);

		const onAbort = () => {
			if (settled) return;
			settled = true;
			cleanup();
			reject(new DOMException('Aborted', 'AbortError'));
		};

		const cleanup = () => {
			clearTimeout(timeoutId);
			signal?.removeEventListener('abort', onAbort);
		};

		signal?.addEventListener('abort', onAbort, { once: true });

		promise.then(
			(value) => {
				if (settled) return;
				settled = true;
				cleanup();
				resolve(value);
			},
			(error) => {
				if (settled) return;
				settled = true;
				cleanup();
				reject(error);
			},
		);
	});
}

function applyJitter(delayMs: number, jitter?: JitterConfig): number {
	if (!jitter || jitter.type === 'none') return delayMs;
	if (delayMs <= 0) return delayMs;

	switch (jitter.type) {
		case 'full': {
			const ratio = Number(jitter.ratio) / 100;
			const min = Math.max(0, Number(delayMs) * (1 - ratio));
			const max = Number(delayMs);
			return (min + Math.random() * (max - min)) as number;
		}
		case 'equal': {
			const ratio = Number(jitter.ratio) / 100;
			const halfWindow = (Number(delayMs) * ratio) / 2;
			const base = Number(delayMs) - halfWindow;
			return (base + Math.random() * halfWindow) as number;
		}
		case 'custom': {
			return jitter.calculate(delayMs);
		}
		default: {
			const _exhaustive: never = jitter;
			return _exhaustive;
		}
	}
}

export type Tryo<E extends TypedError = TypedError> = {
	run: <T>(
		task: (ctx: { signal: AbortSignal }) => Promise<T>,
		options?: Partial<TryoConfig<E>>,
	) => Promise<TryoResult<T, E>>;

	runOrThrow: <T>(
		task: (ctx: { signal: AbortSignal }) => Promise<T>,
		options?: Partial<TryoConfig<E>>,
	) => Promise<T>;

	orThrow: <T>(
		task: (ctx: { signal: AbortSignal }) => Promise<T>,
		options?: Partial<TryoConfig<E>>,
	) => Promise<T>;
	all: <T>(
		tasks: Array<(ctx: { signal: AbortSignal }) => Promise<T>>,
		options?: Partial<TryoConfig<E> & { concurrency?: number }>,
	) => Promise<Array<TryoResult<T, E>>>;
	allOrThrow: <T>(
		tasks: Array<(ctx: { signal: AbortSignal }) => Promise<T>>,
		options?: Partial<TryoConfig<E> & { concurrency?: number }>,
	) => Promise<T[]>;
	partitionAll: <T>(results: Array<TryoResult<T, E>>) => {
		ok: Array<SuccessResult<T, E>>;
		errors: Array<FailureResult<E> | AbortedResult<E> | TimeoutResult<E>>;
		failure: Array<FailureResult<E>>;
		aborted: Array<AbortedResult<E>>;
		timeout: Array<TimeoutResult<E>>;
	};
	withConfig: (
		additionalConfig: Omit<Partial<TryoConfig<E>>, 'signal'>,
	) => Tryo<E>;
};

// (tryo function was here, now moved and overloaded above)
