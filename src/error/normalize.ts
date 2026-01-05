import type { ResultError, Rule } from "./types";

export function createNormalizer<E extends ResultError>(
  rules: Rule<E>[],
  fallback: (err: unknown) => E
) {
  return (err: unknown): E => {
    for (const r of rules) {
      const out = r(err);
      if (out) return out;
    }
    return fallback(err);
  };
}

// General fallback (without depending on fetch / http)
export function defaultFallback(err: unknown): ResultError {
  if (err instanceof Error) {
    // In browsers, network errors sometimes fall as TypeError (fetch),
    // but this is not 100% universal; we treat it as best-effort.
    const code = err.name === "TypeError" ? "NETWORK" : "UNKNOWN";
    return { code, message: err.message || "Something went wrong", cause: err };
  }
  return { code: "UNKNOWN", message: "Something went wrong", cause: err };
}

// "default" normalizer that includes abort rule (very useful in UI)
export function toResultError(err: unknown): ResultError {
  // AbortError (browser / fetch / AbortController)
  if (err instanceof DOMException && err.name === "AbortError") {
    return { code: "ABORTED", message: "Request cancelled", cause: err };
  }
  if (err instanceof DOMException && err.name === "TimeoutError") {
    return { code: "TIMEOUT", message: "Request timed out", cause: err };
  }
  return defaultFallback(err);
}
