import type { AppError, Rule } from "./types";

export function createNormalizer<E extends AppError>(
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

// Fallback general (sin depender de fetch / http)
export function defaultFallback(err: unknown): AppError {
  if (err instanceof Error) {
    // En browsers, errores de red a veces caen como TypeError (fetch),
    // pero esto no es 100% universal; lo tratamos como best-effort.
    const code = err.name === "TypeError" ? "NETWORK" : "UNKNOWN";
    return { code, message: err.message || "Something went wrong", cause: err };
  }
  return { code: "UNKNOWN", message: "Something went wrong", cause: err };
}

// Normalizador "default" que incluye rule de abort (muy útil en UI)
export function toAppError(err: unknown): AppError {
  // AbortError (browser / fetch / AbortController)
  if (err instanceof DOMException && err.name === "AbortError") {
    return { code: "ABORTED", message: "Request cancelled", cause: err };
  }
  return defaultFallback(err);
}
