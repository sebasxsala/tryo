import type { AppError } from "./types";
import type { Rule } from "./normalize";

// Matcher genérico para AbortError (por si no quieres usar toAppError)
export const abortRule: Rule = (err) => {
  if (err instanceof DOMException && err.name === "AbortError") {
    return { code: "ABORTED", message: "Request cancelled", cause: err };
  }
  return null;
};

// Matcher para "timeout" (si el user usa AbortSignal.timeout o libs que tiran ese name)
export const timeoutRule: Rule = (err) => {
  if (err instanceof DOMException && err.name === "TimeoutError") {
    return { code: "TIMEOUT", message: "Request timed out", cause: err };
  }
  // algunas libs tiran Error con name = "TimeoutError"
  if (err instanceof Error && err.name === "TimeoutError") {
    return {
      code: "TIMEOUT",
      message: err.message || "Request timed out",
      cause: err,
    };
  }
  return null;
};

// Matcher para objetos con propiedad "message" (ej: { message: "Error X" })
export const messageRule: Rule = (err) => {
  if (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    typeof (err as any).message === "string"
  ) {
    return {
      code: "UNKNOWN",
      message: (err as any).message,
      cause: err,
    };
  }
  return null;
};

// Matcher para errores lanzados como string literal (ej: throw "Error X")
export const stringRule: Rule = (err) => {
  if (typeof err === "string") {
    return {
      code: "UNKNOWN",
      message: err,
      cause: err,
    };
  }
  return null;
};

// Matcher para errores con status/statusCode (común en clientes HTTP y APIs)
export const statusRule: Rule = (err) => {
  if (typeof err === "object" && err !== null) {
    // Comprobamos status o statusCode
    const status = (err as any).status ?? (err as any).statusCode;

    if (typeof status === "number") {
      return {
        code: "HTTP",
        message: (err as any).message || `HTTP Error ${status}`,
        status,
        cause: err,
      };
    }
  }
  return null;
};

// Matcher para AggregateError (Promise.any, etc)
export const aggregateRule: Rule = (err) => {
  if (typeof AggregateError !== "undefined" && err instanceof AggregateError) {
    return {
      code: "UNKNOWN",
      message: err.message || "Multiple errors occurred",
      cause: err,
      meta: { errors: err.errors },
    };
  }
  return null;
};

// Helper para crear matcher basado en "instanceof" (plugin-friendly)
export function matchInstance<T extends Error, Meta = unknown>(
  ErrorCtor: new (...args: any[]) => T,
  map: (e: T) => AppError<Meta>
): Rule<AppError<Meta>> {
  return (err) => (err instanceof ErrorCtor ? map(err) : null);
}
