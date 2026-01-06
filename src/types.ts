import type { ResultError } from "./error/types";

export type RetryDelayFn<E> = (attempt: number, err: E) => number;

export type MaybePromise<T> = T | Promise<T>;

export type Jitter =
  | boolean
  | number // ratio 0..1
  | { ratio?: number; mode?: "full" | "equal"; rng?: () => number };

/**
 * Backoff strategy to calculate the delay between retries.
 * - "linear": uses the base delay as is in each attempt.
 * - "exponential": multiplies the delay by 2^(attempt-1).
 * - "fibonacci": multiplies by F(attempt) (classic Fibonacci sequence).
 * - function: custom function based on the attempt number.
 */
export type BackoffStrategy =
  | "linear"
  | "exponential"
  | "fibonacci"
  | ((attempt: number) => number);

/**
 * Retry options for `run`, `runAll` and `runAllOrThrow`.
 */
export type RetryOptions<E extends ResultError = ResultError> = {
  /**
   * Number of retries to perform (does not include the initial attempt).
   * @default 0
   */
  retries?: number;
  /**
   * Delay between attempts:
   * - number: fixed delay (ms)
   * - () => number: lazy delay (evaluated per attempt)
   * - (attempt, err) => number: delay based on attempt and last error
   * @default 0 or a default baseDelay if retries are present
   */
  retryDelay?: number | (() => number) | RetryDelayFn<E>;
  /**
   * Decides whether to retry given a specific error.
   * Can be synchronous or asynchronous.
   * Receives the next attempt number and a context with accumulated metrics.
   * @default () => true
   */
  shouldRetry?: (
    attempt: number,
    error: E,
    context: RetryContext
  ) => boolean | Promise<boolean>;
  /**
   * Random jitter to avoid thundering herd:
   * - true: default ratio 0.5
   * - false: no jitter
   * - number: ratio 0..1
   * - object: full control (ratio, mode, rng)
   * @default 0.5
   */
  jitter?: Jitter;
  /**
   * Backoff strategy to apply on the calculated delay.
   * @default "linear"
   */
  backoffStrategy?: BackoffStrategy;
  /**
   * Upper limit of the delay after backoff and before jitter.
   * @default undefined (no limit)
   */
  maxDelay?: number;
};

/**
 * Context for `shouldRetry` with accumulated metrics of the current attempt.
 */
export type RetryContext = {
  /** Total attempts (including the next retry). */
  totalAttempts: number;
  /** Elapsed time in ms since the start of `run`. */
  elapsedTime: number;
  /** Timestamp (ms) when the execution started. */
  startTime: number;
  /** The delay (ms) applied before the last attempt, if any. */
  lastDelay?: number;
};

/**
 * Main options for `run` and extended to `runAll`/`runAllOrThrow`.
 */
export type RunOptions<
  T,
  E extends ResultError = ResultError
> = RetryOptions<E> & {
  /**
   * Normalizes an unknown error value to your type `E`.
   * If not provided, a default normalizer is used.
   */
  toError?: (err: unknown) => E;
  /**
   * Optional transformation applied after `toError`.
   * Useful for adjusting messages, codes, or adding metadata.
   */
  mapError?: (error: E) => E;
  /**
   * Callback on failure (not called if `ignoreAbort` and error is ABORTED).
   */
  onError?: (error: E) => void;
  /**
   * Callback on success.
   */
  onSuccess?: (data: T) => void;
  /**
   * Callback that always executes at the end (success or error).
   */
  onFinally?: () => void;
  /**
   * If true, aborts (ABORTED) are not considered fatal errors:
   * `onError` is not called and `{ ok: false, error }` is returned.
   * @default true
   */
  ignoreAbort?: boolean;
  /**
   * Signal for native work cancellation.
   * If aborted, it cuts with `AbortError`.
   */
  signal?: AbortSignal;
  /**
   * Maximum timeout in ms for the work; expires with `TimeoutError`.
   */
  timeout?: number;
  /**
   * Retry observability: receives attempt, error, and next delay.
   */
  onRetry?: (attempt: number, error: E, nextDelay: number) => void;
  /**
   * Optional structured logger for debug and errors.
   */
  logger?: {
    debug?: (msg: string, meta?: unknown) => void;
    error?: (msg: string, error: E) => void;
  };
  /**
   * Callback on abort, useful for reacting to `AbortSignal`.
   */
  onAbort?: (signal: AbortSignal) => void;
};

/**
 * Circuit breaker configuration options:
 * - failureThreshold: number of consecutive failures to open the circuit
 * - resetTimeout: time in ms it remains open before attempting half-open
 * - halfOpenRequests: allowed quantity in half-open state
 */
export type CircuitBreakerOptions = {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenRequests?: number;
};

/**
 * Execution metrics optionally returned in `RunResult`.
 */
export type Metrics<E extends ResultError = ResultError> = {
  totalAttempts: number;
  totalRetries: number;
  totalDuration: number;
  lastError?: E;
};

export type RunResult<T, E extends ResultError = ResultError> =
  | { ok: true; data: T; error: null; metrics?: Metrics<E> }
  | { ok: false; data: null; error: E; metrics?: Metrics<E> };

/**
 * Validates common execution/retry options.
 */
export function validateOptions<T, E extends ResultError = ResultError>(
  options: RunOptions<T, E>
): void {
  if (options.retries != null && options.retries < 0) {
    throw new Error("retries must be >= 0");
  }
  if (options.timeout != null && options.timeout <= 0) {
    throw new Error("timeout must be > 0");
  }
  if (options.maxDelay != null && options.maxDelay < 0) {
    throw new Error("maxDelay must be >= 0");
  }
  // const cb = options.circuitBreaker;
  // if (cb) {
  //   if (cb.failureThreshold < 1) {
  //     throw new Error("failureThreshold must be >= 1");
  //   }
  //   if (cb.resetTimeout <= 0) {
  //     throw new Error("resetTimeout must be > 0");
  //   }
  //   if (cb.halfOpenRequests != null && cb.halfOpenRequests < 1) {
  //     throw new Error("halfOpenRequests must be >= 1");
  //   }
  // }
}
