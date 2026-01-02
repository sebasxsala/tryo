export type AppErrorCode =
  | "ABORTED"
  | "NETWORK"
  | "TIMEOUT"
  | "VALIDATION"
  | "HTTP"
  | "UNKNOWN";

export type Rule<E extends AppError = AppError> = (err: unknown) => E | null;

/**
 * A normalized error shape returned by `run()`.
 *
 * - `code`: A stable identifier you can switch on (e.g. "HTTP", "VALIDATION").
 * - `message`: User-facing or log-friendly message.
 * - `status`: Optional numeric status (commonly HTTP status).
 * - `meta`: Optional payload with extra context (response body, validation fields, etc.).
 * - `cause`: The original thrown value for debugging.
 */
export type AppError<Meta = unknown> = {
  code: AppErrorCode | (string & {}); // permite códigos custom sin perder autocomplete
  message: string;
  status?: number; // útil para HTTP pero opcional
  meta?: Meta; // libre (body, fields, etc.)
  cause?: unknown; // error original
};
