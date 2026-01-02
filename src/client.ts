import type { AppError } from "./error/types";
import type { Matcher } from "./error/normalize";
import {
  createNormalizer,
  defaultFallback,
  toAppError,
} from "./error/normalize";
import { run as baseRun } from "./run";
import type { RunOptions, RunResult } from "./types";

export type CreateClientOptions<E extends AppError = AppError> = {
  matchers?: Matcher<E>[];
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

export function createClient<E extends AppError = AppError>(
  opts: CreateClientOptions<E> = {}
) {
  const {
    matchers = [],
    fallback = (e: unknown) => defaultFallback(e) as unknown as E,
    toError: customToError,
    ignoreAbort = true,
    mapError: defaultMapError,
  } = opts;

  const toError =
    customToError ??
    (matchers.length > 0
      ? createNormalizer<E>(matchers, fallback)
      : (toAppError as unknown as (e: unknown) => E));

  return {
    run<T>(
      fn: () => Promise<T>,
      options: RunOptions<T, E> = {}
    ): Promise<RunResult<T, E>> {
      return baseRun(fn, {
        toError,
        ignoreAbort,
        mapError: (err) =>
          options.mapError
            ? options.mapError(defaultMapError ? defaultMapError(err) : err)
            : defaultMapError
            ? defaultMapError(err)
            : err,
        onError: options.onError,
        onSuccess: options.onSuccess,
        onFinally: options.onFinally,
      });
    },
  };
}
