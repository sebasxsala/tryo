import type { AppError } from "./error/types";

export type RunOptions<T, E extends AppError = AppError> = {
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
