import type { AppError } from "./error/types";
import { toAppError as defaultToAppError } from "./error/normalize";
import type { RunOptions, RunResult } from "./types";

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
    retryDelay = 0,
    retryBackoff = "fixed",
    shouldRetry = () => true,
    jitter = false,
  } = options;

  let attempt = 0;

  while (true) {
    try {
      const data = await fn();
      onSuccess?.(data);
      onFinally?.(); // Always call finally on success (last attempt)
      return { ok: true, data, error: null };
    } catch (e) {
      let err = toError(e);
      if (mapError) err = mapError(err);

      // Abort is critical: stop immediately, no retries
      const isAborted = err.code === "ABORTED";
      
      if (isAborted) {
         if (ignoreAbort) {
            onFinally?.();
            return { ok: false, data: null, error: err };
         }
         // If not ignoring abort, we fall through to onError and return
      } else if (attempt < retries && shouldRetry(err)) {
        attempt++;
        
        let delay = retryDelay;
        if (retryBackoff === "linear") delay *= attempt;
        if (retryBackoff === "exponential") delay *= Math.pow(2, attempt - 1); // 1st retry: 2^0=1x, 2nd: 2^1=2x
        
        if (jitter) {
           delay = delay * (0.5 + Math.random()); // +/- 50% randomization or similar
        }

        // Wait before retrying
        if (delay > 0) {
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
        continue; // Retry loop
      }

      // Final failure or aborted
      onError?.(err);
      onFinally?.();
      return { ok: false, data: null, error: err };
    }
  }
}
