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
  } = options;

  try {
    const data = await fn();
    onSuccess?.(data);
    return { ok: true, data, error: null };
  } catch (e) {
    let err = toError(e);
    if (mapError) err = mapError(err);

    if (ignoreAbort && err.code === "ABORTED") {
      // decisión de diseño: devolvemos ok:false pero sin llamar onError (para no toastear)
      return { ok: false, data: null, error: err };
    }

    onError?.(err);
    return { ok: false, data: null, error: err };
  } finally {
    onFinally?.();
  }
}
