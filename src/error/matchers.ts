import type { AppError } from "./types";
import type { Matcher } from "./normalize";

// Matcher genérico para AbortError (por si no quieres usar toAppError)
export const abortMatcher: Matcher = (err) => {
  if (err instanceof DOMException && err.name === "AbortError") {
    return { code: "ABORTED", message: "Request cancelled", cause: err };
  }
  return null;
};

// Matcher para "timeout" (si el user usa AbortSignal.timeout o libs que tiran ese name)
export const timeoutMatcher: Matcher = (err) => {
  if (err instanceof DOMException && err.name === "TimeoutError") {
    return { code: "TIMEOUT", message: "Request timed out", cause: err };
  }
  // algunas libs tiran Error con name = "TimeoutError"
  if (err instanceof Error && err.name === "TimeoutError") {
    return { code: "TIMEOUT", message: err.message || "Request timed out", cause: err };
  }
  return null;
};

// Helper para crear matcher basado en "instanceof" (plugin-friendly)
export function instanceOfMatcher<T extends Error, Meta = unknown>(
  ErrorCtor: new (...args: any[]) => T,
  map: (e: T) => AppError<Meta>
): Matcher<AppError<Meta>> {
  return (err) => (err instanceof ErrorCtor ? map(err) : null);
}
