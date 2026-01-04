import type { Jitter, RetryDelayFn, BackoffStrategy } from "./types";

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function resolveRetryDelay<E>(
  retryDelay: number | RetryDelayFn<E> | undefined,
  attempt: number,
  err: E,
  defaultBaseDelay: number,
  backoffStrategy?: BackoffStrategy,
  maxDelay?: number
): number {
  let base =
    typeof retryDelay === "function"
      ? (retryDelay as RetryDelayFn<E>)(attempt, err)
      : typeof retryDelay === "number"
      ? (retryDelay as number)
      : typeof retryDelay === "undefined"
      ? defaultBaseDelay
      : defaultBaseDelay;

  const backoff = computeBackoffDelay(
    backoffStrategy ?? "linear",
    base,
    attempt
  );

  const out = maxDelay != null ? clamp(backoff, 0, maxDelay) : backoff;
  return Number.isFinite(out) ? out : 0;
}

export function applyJitter(delay: number, jitter: Jitter | undefined): number {
  if (delay <= 0 || !jitter) return delay;

  const rng =
    typeof jitter === "object" && jitter.rng ? jitter.rng : Math.random;

  // reasonable defaults
  const ratio =
    typeof jitter === "number"
      ? jitter
      : jitter === true
      ? 0.5
      : typeof jitter === "object" && jitter.ratio != null
      ? jitter.ratio
      : 0.5;

  const r = clamp(ratio, 0, 1);

  const mode = typeof jitter === "object" && jitter.mode ? jitter.mode : "full";

  // "full": 0..delay*r extra (recommended to avoid thundering herd)
  // "equal": delay*(1-r) + random(0..delay*r)
  if (mode === "equal") {
    return delay * (1 - r) + rng() * delay * r;
  }

  // full jitter
  return rng() * delay * (1 + r);
}

export function computeBackoffDelay(
  strategy: BackoffStrategy,
  base: number,
  attempt: number
): number {
  if (typeof strategy === "function") {
    const v = strategy(attempt);
    return v >= 0 ? v : 0;
  }
  const b = base >= 0 ? base : 0;
  const a = attempt >= 1 ? attempt : 1;
  if (strategy === "linear") return b;
  if (strategy === "exponential") return b * Math.pow(2, a - 1);
  if (strategy === "fibonacci") {
    if (a <= 2) return b;
    let prev = 1;
    let curr = 1;
    for (let i = 3; i <= a; i++) {
      const next = prev + curr;
      prev = curr;
      curr = next;
    }
    return b * curr;
  }
  return b;
}
