import type { AppError } from "./error/types";

export type RetryDelayFn<E> = (attempt: number, err: E) => number;

export type Jitter =
  | boolean
  | number // ratio 0..1
  | { ratio?: number; mode?: "full" | "equal"; rng?: () => number };

export type RetryOptions<E extends AppError = AppError> = {
  /**
   * Number of retries to attempt.
   * @default 0
   */
  retries?: number;

  /**
   * Delay in milliseconds between retries.
   *
   * - `number` for a fixed delay
   * - `function` for custom delay based on attempt and error
   *
   * @default 0
   */
  retryDelay?: number | RetryDelayFn<E>;

  /**
   * Function to determine if a retry should be attempted.
   * Returns true to retry, false to stop.
   * @default () => true
   */
  shouldRetry?: (attempt: number, error: E) => boolean;

  /**
   * Adds random jitter to the delay to prevent thundering herd.
   *
   * - `true` for default 0.5 ratio
   * - `false` to disable jitter
   * - `number` for custom ratio 0..1
   * - `{ ratio, mode, rng }` for full control
   *
   * @default 0.5
   */
  jitter?: Jitter;
};

export type RunOptions<T, E extends AppError = AppError> = RetryOptions<E> & {
  /**
   * Converts an unknown thrown value into your normalized error type `E`.
   *
   * Use this to integrate custom errors (e.g. HttpError, AxiosError, ZodError),
   * map status codes, or attach metadata for UI/debugging.
   *
   * If omitted, a default normalizer is used (best-effort).
   */
  toError?: (err: unknown) => E;

  /**
   * Optional error transformer applied AFTER `toError`.
   *
   * Useful for translating messages, mapping status to user-friendly text,
   * or enforcing a consistent error format across the app.
   */
  mapError?: (error: E) => E;

  /**
   * Called when the operation fails (except when `ignoreAbort` is true and the error code is "ABORTED").
   *
   * Great place for toasts, logging, analytics, etc.
   */
  onError?: (error: E) => void;

  /**
   * Called when the operation succeeds.
   */
  onSuccess?: (data: T) => void;

  /**
   * Called after success or failure, similar to `finally`, but with no return value.
   *
   * Common use: stop loading spinners, cleanup state, etc.
   */
  onFinally?: () => void;

  /**
   * When true, errors with `code === "ABORTED"` are treated as non-fatal:
   * - `onError` is NOT called
   * - the result is returned as `{ ok: false, error }`
   *
   * This is useful for cancellable side-effects (React effects, debounced searches, etc.).
   *
   * @default true
   */
  ignoreAbort?: boolean;
};

export type RunResult<T, E extends AppError = AppError> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: E };
