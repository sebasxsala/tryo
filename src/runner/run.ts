import type { AppError } from "../error/types";
import { toAppError as defaultToAppError } from "../error/normalize";
import type { RunOptions, RunResult } from "../types";
import { applyJitter, resolveRetryDelay, sleep } from "../utils";

/**
 * Executes an async operation and returns a Result instead of throwing.
 *
 * Errors are normalized into an `AppError` (or a custom error type `E`)
 * using the provided `toError` function.
 *
 * This utility is framework-agnostic and works in browsers, Node.js,
 * React effects, and any async context.
 */
export async function run<T, E extends AppError = AppError>(
  fn: () => Promise<T>,
  options: RunOptions<T, E> = {}
): Promise<RunResult<T, E>> {
  const {
    toError = defaultToAppError as unknown as (err: unknown) => E,
    mapError,
    onError,
    onSuccess,
    onFinally,
    ignoreAbort = true,
    retries = 0,
    retryDelay,
    shouldRetry = () => true,
    jitter = { ratio: 0.5, mode: "full" },
  } = options;

  const defaultBaseDelay = retries > 0 ? 300 : 0;

  let attempt = 0;

  while (true) {
    try {
      const data = await fn();
      onSuccess?.(data);
      onFinally?.();
      return { ok: true, data, error: null };
    } catch (e) {
      let err = toError(e);
      if (mapError) err = mapError(err);

      const isAborted = err.code === "ABORTED";

      if (isAborted) {
        if (!ignoreAbort) {
          onError?.(err);
        }

        onFinally?.();
        return { ok: false, data: null, error: err };
        // If not ignoring abort, we fall through to onError and return
      }

      const nextAttempt = attempt + 1;
      const canRetry = attempt < retries && shouldRetry(nextAttempt, err);

      if (canRetry) {
        attempt = nextAttempt;

        let delay = resolveRetryDelay(
          retryDelay,
          attempt,
          err,
          defaultBaseDelay
        );

        if (!Number.isFinite(delay) || delay < 0) delay = 0;

        delay = applyJitter(delay, jitter);

        if (delay > 0) await sleep(delay);
        continue;
      }

      // Final failure or aborted
      onError?.(err);
      onFinally?.();
      return { ok: false, data: null, error: err };
    }
  }
}
