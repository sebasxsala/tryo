import type { AppError, Rule, InferErrorFromRules } from "../error/types";
import {
  createNormalizer,
  defaultFallback,
  toAppError,
} from "../error/normalize";
import { run as baseRun } from "./run";
import type { MaybePromise, RunOptions, RunResult } from "../types";
import type { CircuitBreakerOptions } from "../types";
import { runAll as baseRunAll } from "./runAll";
import {
  runAllSettled as baseRunAllSettled,
  type RunAllItemResult,
  type RunAllOptions,
} from "./runAllSettled";

export type CreateRunnerOptions<E extends AppError = AppError> = {
  /**
   * Custom matchers to use for normalizing errors.
   * If not provided, the default matchers are used.
   */
  rules?: Rule<E>[];

  /**
   * Custom fallback function to use for normalizing errors.
   * If not provided, the default fallback is used.
   */
  fallback?: (err: unknown) => E;

  /**
   * If you want a completely custom normalizer, you can provide it directly.
   * If set, `matchers` and `fallback` are ignored.
   */
  toError?: (err: unknown) => E;

  /** Default for run options */
  ignoreAbort?: boolean;

  /** Optional default mapper for all runs */
  mapError?: (error: E) => E;
  /**
   * Default circuit breaker for all executions of the instance.
   * Can be overridden by `options.circuitBreaker` in each `run`.
   */
  circuitBreaker?: CircuitBreakerOptions;
};

const composeMapError =
  <E>(base?: (e: E) => E, local?: (e: E) => E) =>
  (e: E) =>
    local ? local(base ? base(e) : e) : base ? base(e) : e;

export interface Runner<E extends AppError> {
  run<T>(
    fn: () => Promise<T>,
    options?: RunOptions<T, E>
  ): Promise<RunResult<T, E>>;
  all<T>(
    fns: Array<() => MaybePromise<T>>,
    options?: RunAllOptions<T, E>
  ): Promise<RunAllItemResult<T, E>[]>;
  allOrThrow<T>(
    fns: Array<() => MaybePromise<T>>,
    options?: RunOptions<T, E>
  ): Promise<T[]>;
}

export function createRunner(
  opts?: Omit<CreateRunnerOptions<AppError>, "rules">
): Runner<AppError>;

export function createRunner<const TRules extends readonly Rule<any>[]>(
  opts: { rules: TRules } & Omit<
    CreateRunnerOptions<InferErrorFromRules<TRules>>,
    "rules"
  >
): Runner<InferErrorFromRules<TRules>>;

export function createRunner<const TRules extends readonly Rule<any>[] = []>(
  opts: any = {}
): any {
  type E = InferErrorFromRules<TRules>;

  const {
    rules = [],
    fallback = (e: unknown) => defaultFallback(e) as unknown as E,
    toError: customToError,
    ignoreAbort = true,
    mapError: defaultMapError,
    circuitBreaker: defaultCircuitBreaker,
  } = opts as CreateRunnerOptions<E>;

  const toError =
    customToError ??
    (rules.length > 0
      ? createNormalizer<E>(rules as unknown as Rule<E>[], fallback)
      : (toAppError as unknown as (e: unknown) => E));

  let failureCount = 0;
  let openUntil: number | null = null;
  let halfOpenRemaining: number | null = null;

  return {
    run<T>(
      fn: () => Promise<T>,
      options: RunOptions<T, E> = {}
    ): Promise<RunResult<T, E>> {
      const cb = options.circuitBreaker ?? defaultCircuitBreaker;
      const now = Date.now();

      if (cb) {
        if (openUntil && now < openUntil) {
          const err = toError(new Error("Circuit open"));
          const mapped = composeMapError(
            defaultMapError,
            options.mapError
          )(err);
          options.onError?.(mapped);
          options.onFinally?.();
          return Promise.resolve({
            ok: false,
            data: null,
            error: mapped,
            metrics: {
              totalAttempts: 0,
              totalRetries: 0,
              totalDuration: 0,
              lastError: mapped,
            },
          });
        }
        if (openUntil && now >= openUntil) {
          openUntil = null;
          failureCount = 0;
          halfOpenRemaining = cb.halfOpenRequests ?? 1;
        }
        if (halfOpenRemaining != null) {
          if (halfOpenRemaining <= 0) {
            const err = toError(new Error("Circuit half-open limit"));
            const mapped = composeMapError(
              defaultMapError,
              options.mapError
            )(err);
            options.onError?.(mapped);
            options.onFinally?.();
            return Promise.resolve({
              ok: false,
              data: null,
              error: mapped,
              metrics: {
                totalAttempts: 0,
                totalRetries: 0,
                totalDuration: 0,
                lastError: mapped,
              },
            });
          } else {
            halfOpenRemaining--;
          }
        }
      }

      return baseRun(fn, {
        toError,
        ignoreAbort,
        ...options,
        mapError: composeMapError(defaultMapError, options.mapError),
      }).then((r) => {
        if (!cb) return r;
        if (!r.ok) {
          failureCount++;
          if (failureCount >= cb.failureThreshold) {
            openUntil = Date.now() + cb.resetTimeout;
            halfOpenRemaining = null;
          }
        } else {
          failureCount = 0;
          openUntil = null;
          halfOpenRemaining = null;
        }
        return r;
      });
    },
    allSettled<T>(
      fns: Array<() => Promise<T>>,
      options: RunAllOptions<T, E> = {}
    ): Promise<RunAllItemResult<T, E>[]> {
      return baseRunAllSettled(fns, {
        toError,
        ignoreAbort,
        ...options,
        mapError: composeMapError(defaultMapError, options.mapError),
      });
    },
    all<T>(
      fns: (() => Promise<T>)[],
      options: RunOptions<T, E> = {}
    ): Promise<T[]> {
      return baseRunAll(fns, {
        toError,
        ignoreAbort,
        ...options,
        mapError: composeMapError(defaultMapError, options.mapError),
      });
    },
  };
}
