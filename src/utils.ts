import type { Jitter, RetryDelayFn } from "./types";

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function resolveRetryDelay<E>(
  retryDelay: number | RetryDelayFn<E> | undefined,
  attempt: number,
  err: E,
  defaultBaseDelay: number
): number {
  if (typeof retryDelay === "function") return retryDelay(attempt, err);
  if (typeof retryDelay === "number") return retryDelay;
  return defaultBaseDelay;
}

export function applyJitter(delay: number, jitter: Jitter | undefined): number {
  if (delay <= 0 || !jitter) return delay;

  const rng =
    typeof jitter === "object" && jitter.rng ? jitter.rng : Math.random;

  // defaults razonables
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

  // "full": 0..delay*r extra (recomendado para evitar thundering herd)
  // "equal": delay*(1-r) + random(0..delay*r)
  if (mode === "equal") {
    return delay * (1 - r) + rng() * delay * r;
  }

  // full jitter
  return rng() * delay * (1 + r);
}
