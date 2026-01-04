export type AppErrorCode =
  | "ABORTED"
  | "NETWORK"
  | "TIMEOUT"
  | "VALIDATION"
  | "HTTP"
  | "UNKNOWN";

/**
 * A normalized error shape returned by `run()`.
 *
 * - `code`: A stable identifier you can switch on (e.g. "HTTP", "VALIDATION").
 * - `message`: User-facing or log-friendly message.
 * - `status`: Optional numeric status (commonly HTTP status).
 * - `meta`: Optional payload with extra context (response body, validation fields, etc.).
 * - `cause`: The original thrown value for debugging.
 */
export type AppError<
  Code extends string = AppErrorCode | (string & {}),
  Meta = unknown
> = {
  code: Code; // allows custom codes without losing autocomplete
  message: string;
  status?: number; // useful for HTTP but optional
  meta?: Meta; // free (body, fields, etc.)
  cause?: unknown; // original error
};

type NonNull<T> = T extends null ? never : T;
type RuleReturn<R> = R extends (err: unknown) => infer Out
  ? NonNull<Out>
  : never;
export type InferErrorFromRules<TRules extends readonly Rule<any>[]> =
  TRules extends readonly []
    ? AppError
    : RuleReturn<TRules[number]> | AppError<"UNKNOWN">;
export type Rule<E extends AppError = AppError> = (err: unknown) => E | null;
