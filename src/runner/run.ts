import type { ResultError } from "../error/types";
import { toResultError as defaultToResultError } from "../error/normalize";
import type { MaybePromise, RunOptions, RunResult } from "../types";
import { validateOptions } from "../types";
import { applyJitter, resolveRetryDelay, sleep } from "../utils";

/**
 * Executes an async operation and returns a Result instead of throwing.
 *
 * Errors are normalized into an `ResultError` (or a custom error type `E`)
 * using the provided `toError` function.
 *
 * This utility is framework-agnostic and works in browsers, Node.js,
 * React effects, and any async context.
 */
export async function run<T, E extends ResultError = ResultError>(
  fn: (ctx?: { signal: AbortSignal }) => MaybePromise<T>,
  options: RunOptions<T, E> = {}
): Promise<RunResult<T, E>> {
  const {
    toError = defaultToResultError as unknown as (err: unknown) => E,
    mapError,
    onError,
    onSuccess,
    onFinally,
    ignoreAbort = true,
    retries = 0,
    retryDelay,
    shouldRetry = () => true,
    jitter = { ratio: 0.5, mode: "full" },
    backoffStrategy,
    maxDelay,
    timeout,
    signal,
    onRetry,
    logger,
    onAbort,
  } = options;

  const defaultBaseDelay = retries > 0 ? 300 : 0;

  validateOptions(options);

  if (signal?.aborted) {
    try {
      onAbort?.(signal);
    } finally {
      const err = toError(new DOMException("Aborted", "AbortError"));
      const mapped = mapError ? mapError(err) : err;
      if (!ignoreAbort) {
        onError?.(mapped);
      }
      onFinally?.();
      return {
        ok: false,
        data: null,
        error: mapped,
        metrics: {
          totalAttempts: 0,
          totalRetries: 0,
          totalDuration: 0,
          lastError: mapped,
        },
      };
    }
  }

  const startedAt = Date.now();
  let attempt = 0;
  let lastError: E | undefined;
  let lastDelay = 0;

  while (true) {
    const controller = new AbortController();
    if (signal) {
      if (signal.aborted) {
        controller.abort(signal.reason);
      } else {
        signal.addEventListener(
          "abort",
          () => controller.abort(signal.reason),
          {
            once: true,
          }
        );
      }
    }

    let timeoutId: any = null;
    if (timeout && timeout > 0) {
      timeoutId = setTimeout(() => {
        controller.abort(new DOMException("Timeout", "TimeoutError"));
      }, timeout);
    }

    try {
      const abortPromise = new Promise<never>((_, reject) => {
        if (controller.signal.aborted) {
          reject(controller.signal.reason);
        } else {
          controller.signal.addEventListener(
            "abort",
            () => reject(controller.signal.reason),
            { once: true }
          );
        }
      });

      const data = await Promise.race([
        fn({ signal: controller.signal }),
        abortPromise,
      ]);

      if (timeoutId) clearTimeout(timeoutId);
      try {
        onSuccess?.(data);
      } catch (e) {
        logger?.error?.("run:onSuccess failed", toError(e));
      }
      try {
        onFinally?.();
      } catch (e) {
        logger?.error?.("run:onFinally failed", toError(e));
      }
      const totalDuration = Date.now() - startedAt;
      const metrics = {
        totalAttempts: attempt + 1,
        totalRetries: attempt,
        totalDuration,
        lastError,
      };
      logger?.debug?.("run:success", {
        attempts: metrics.totalAttempts,
        duration: metrics.totalDuration,
      });
      return { ok: true, data, error: null, metrics };
    } catch (e) {
      let err = toError(e);
      if (mapError) err = mapError(err);

      const isAborted =
        (err as any)?.code === "ABORTED" ||
        (e instanceof DOMException && e.name === "AbortError") ||
        signal?.aborted;

      if (isAborted) {
        try {
          if (signal) {
            try {
              onAbort?.(signal);
            } catch (e) {
              logger?.error?.("run:onAbort failed", toError(e));
            }
          }
        } finally {
          if (!ignoreAbort) {
            try {
              onError?.(err);
            } catch (e) {
              logger?.error?.("run:onError failed", toError(e));
            }
          }
          try {
            onFinally?.();
          } catch (e) {
            logger?.error?.("run:onFinally failed", toError(e));
          }
          const totalDuration = Date.now() - startedAt;
          const metrics = {
            totalAttempts: attempt + 1,
            totalRetries: attempt,
            totalDuration,
            lastError: err,
          };
          logger?.debug?.("run:aborted", {
            attempt,
            duration: metrics.totalDuration,
          });
          return { ok: false, data: null, error: err, metrics };
        }
      }

      lastError = err;
      const nextAttempt = attempt + 1;
      const context = {
        totalAttempts: nextAttempt,
        elapsedTime: Date.now() - startedAt,
        startTime: startedAt,
        lastDelay: lastDelay > 0 ? lastDelay : undefined,
      };
      const decision = await Promise.resolve(
        shouldRetry(nextAttempt, err, context)
      );
      const canRetry = attempt < retries && decision;

      if (canRetry) {
        attempt = nextAttempt;

        let delay = resolveRetryDelay(
          retryDelay,
          attempt,
          err,
          defaultBaseDelay,
          backoffStrategy,
          maxDelay
        );

        if (!Number.isFinite(delay) || delay < 0) delay = 0;

        delay = applyJitter(delay, jitter);
        lastDelay = delay;

        onRetry?.(attempt, err, delay);
        logger?.debug?.("run:retry", { attempt, delay });
        if (delay > 0) await sleep(delay);
        continue;
      }

      // Final failure or aborted
      try {
        onError?.(err);
      } catch (e) {
        logger?.error?.("run:onError failed", toError(e));
      }
      try {
        onFinally?.();
      } catch (e) {
        logger?.error?.("run:onFinally failed", toError(e));
      }
      const totalDuration = Date.now() - startedAt;
      const metrics = {
        totalAttempts: attempt + 1,
        totalRetries: attempt,
        totalDuration,
        lastError: err,
      };
      logger?.error?.("run:error", err);
      return { ok: false, data: null, error: err, metrics };
    }
  }
}
