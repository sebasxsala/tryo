import type { AppError, Rule, InferErrorFromRules } from "../error/types";
import {
  createNormalizer,
  defaultFallback,
  toAppError,
} from "../error/normalize";
import { run as baseRun } from "./run";
import type { RunOptions, RunResult } from "../types";
import { runAllOrThrow as baseRunAllOrThrow } from "./runAllOrThrow";
import {
  runAll as baseRunAll,
  type RunAllItemResult,
  type RunAllOptions,
} from "./runAll";

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
};

const composeMapError =
  <E>(base?: (e: E) => E, local?: (e: E) => E) =>
  (e: E) =>
    local ? local(base ? base(e) : e) : base ? base(e) : e;

export function createRunner<
  TRules extends readonly Rule<any>[] = [],
  E extends AppError = [TRules] extends [[]]
    ? AppError
    : InferErrorFromRules<TRules>
>(opts: { rules?: TRules } & Omit<CreateRunnerOptions<E>, "rules"> = {}) {
  const {
    rules = [],
    fallback = (e: unknown) => defaultFallback(e) as unknown as E,
    toError: customToError,
    ignoreAbort = true,
    mapError: defaultMapError,
  } = opts;

  const toError =
    customToError ??
    (rules.length > 0
      ? createNormalizer<E>(rules as unknown as Rule<E>[], fallback)
      : (toAppError as unknown as (e: unknown) => E));

  return {
    run<T>(
      fn: () => Promise<T>,
      options: RunOptions<T, E> = {}
    ): Promise<RunResult<T, E>> {
      return baseRun(fn, {
        ...options,
        mapError: composeMapError(defaultMapError, options.mapError),
      });
    },
    all<T>(
      fns: Array<() => Promise<T>>,
      options: RunAllOptions<T, E> = {}
    ): Promise<RunAllItemResult<T, E>[]> {
      return baseRunAll(fns, {
        ...options,
        mapError: composeMapError(defaultMapError, options.mapError),
      });
    },
    allOrThrow<T>(
      fns: (() => Promise<T>)[],
      options: RunOptions<T, E> = {}
    ): Promise<T[]> {
      return baseRunAllOrThrow(fns, {
        ...options,
        mapError: composeMapError(defaultMapError, options.mapError),
      });
    },
  };
}
