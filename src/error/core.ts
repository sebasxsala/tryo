import type { ResultError, Rule } from "./types";

export const abort: Rule<ResultError<"ABORTED">> = (err) => {
  if (err instanceof DOMException && err.name === "AbortError") {
    return { code: "ABORTED", message: "Request cancelled", cause: err };
  }
  if (err instanceof Error && err.name === "AbortError") {
    return {
      code: "ABORTED",
      message: err.message || "Request cancelled",
      cause: err,
    };
  }
  return null;
};

export const timeout: Rule<ResultError<"TIMEOUT">> = (err) => {
  if (err instanceof DOMException && err.name === "TimeoutError") {
    return { code: "TIMEOUT", message: "Request timed out", cause: err };
  }
  if (err instanceof Error && err.name === "TimeoutError") {
    return {
      code: "TIMEOUT",
      message: err.message || "Request timed out",
      cause: err,
    };
  }
  return null;
};

export const httpStatus: Rule<ResultError<"HTTP">> = (err) => {
  if (typeof err === "object" && err !== null) {
    const obj = err as Record<string, unknown>;
    const status = obj.status ?? obj.statusCode;
    if (typeof status === "number") {
      return {
        code: "HTTP",
        message:
          typeof obj.message === "string"
            ? obj.message
            : `HTTP Error ${status}`,
        status,
        cause: err,
      };
    }
  }
  return null;
};

export const aggregate: Rule<ResultError<"UNKNOWN", { errors: unknown[] }>> = (
  err
) => {
  if (typeof AggregateError !== "undefined" && err instanceof AggregateError) {
    return {
      code: "UNKNOWN",
      message: err.message || "Multiple errors occurred",
      cause: err,
      meta: { errors: err.errors as unknown[] },
    };
  }
  return null;
};

export const string: Rule<ResultError<"UNKNOWN">> = (err) => {
  if (typeof err === "string") {
    return { code: "UNKNOWN", message: err, cause: err };
  }
  return null;
};

export const message: Rule<ResultError<"UNKNOWN">> = (err) => {
  if (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    return {
      code: "UNKNOWN",
      message: (err as { message: string }).message,
      cause: err,
    };
  }
  return null;
};

export const rules = {
  abort,
  timeout,
  httpStatus,
  aggregate,
  string,
  message,
} satisfies Record<string, Rule<ResultError>>;
