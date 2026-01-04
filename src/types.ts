import type { AppError } from "./error/types";

export type RetryDelayFn<E> = (attempt: number, err: E) => number;

export type Jitter =
  | boolean
  | number // ratio 0..1
  | { ratio?: number; mode?: "full" | "equal"; rng?: () => number };

/**
 * Estrategia de backoff para calcular el delay entre reintentos.
 * - "linear": usa el delay base tal cual en cada intento.
 * - "exponential": multiplica por 2^(attempt-1) el delay.
 * - "fibonacci": multiplica por F(attempt) (serie fibonacci clásica).
 * - function: función personalizada basada en el número de intento.
 */
export type BackoffStrategy =
  | "linear"
  | "exponential"
  | "fibonacci"
  | ((attempt: number) => number);

/**
 * Opciones de reintentos para `run`, `runAll` y `runAllOrThrow`.
 */
export type RetryOptions<E extends AppError = AppError> = {
  /**
   * Cantidad de reintentos a realizar (no incluye el intento inicial).
   * @default 0
   */
  retries?: number;
  /**
   * Delay entre intentos:
   * - number: delay fijo (ms)
   * - () => number: delay lazy (evaluado por intento)
   * - (attempt, err) => number: delay basado en intento y último error
   * @default 0 o un baseDelay por defecto si hay retries
   */
  retryDelay?: number | (() => number) | RetryDelayFn<E>;
  /**
   * Decide si se debe reintentar ante un error dado.
   * Puede ser síncrono o asíncrono.
   * Recibe el intento siguiente y un contexto con métricas acumuladas.
   * @default () => true
   */
  shouldRetry?: (
    attempt: number,
    error: E,
    context: RetryContext
  ) => boolean | Promise<boolean>;
  /**
   * Jitter aleatorio para evitar thundering herd:
   * - true: ratio 0.5 por defecto
   * - false: sin jitter
   * - number: ratio 0..1
   * - object: control completo (ratio, mode, rng)
   * @default 0.5
   */
  jitter?: Jitter;
  /**
   * Estrategia de backoff a aplicar sobre el delay calculado.
   * @default "linear"
   */
  backoffStrategy?: BackoffStrategy;
  /**
   * Límite superior del delay tras backoff y antes de jitter.
   * @default undefined (sin límite)
   */
  maxDelay?: number;
};

/**
 * Contexto para `shouldRetry` con acumulados del intento actual.
 */
export type RetryContext = {
  /** Total de intentos (incluyendo el próximo reintento). */
  totalAttempts: number;
  /** Tiempo transcurrido en ms desde el inicio del `run`. */
  elapsedTime: number;
};

/**
 * Opciones principales para `run` y extendidas a `runAll`/`runAllOrThrow`.
 */
export type RunOptions<T, E extends AppError = AppError> = RetryOptions<E> & {
  /**
   * Normaliza un valor de error desconocido a tu tipo `E`.
   * Si no se provee, se usa un normalizador por defecto.
   */
  toError?: (err: unknown) => E;
  /**
   * Transformación opcional aplicada luego de `toError`.
   * Útil para ajustar mensajes, códigos o agregar metadata.
   */
  mapError?: (error: E) => E;
  /**
   * Callback al fallar (no se llama si `ignoreAbort` y el error es ABORTED).
   */
  onError?: (error: E) => void;
  /**
   * Callback al tener éxito.
   */
  onSuccess?: (data: T) => void;
  /**
   * Callback que se ejecuta siempre al finalizar (éxito o error).
   */
  onFinally?: () => void;
  /**
   * Si true, los abortos (ABORTED) no se consideran error fatal:
   * no se llama `onError` y se devuelve `{ ok: false, error }`.
   * @default true
   */
  ignoreAbort?: boolean;
  /**
   * Señal para cancelación nativa del trabajo.
   * Si está abortada, se corta con `AbortError`.
   */
  signal?: AbortSignal;
  /**
   * Timeout máximo en ms para el trabajo; expira con `TimeoutError`.
   */
  timeout?: number;
  /**
   * Observabilidad de reintentos: recibe intento, error y delay siguiente.
   */
  onRetry?: (attempt: number, error: E, nextDelay: number) => void;
  /**
   * Logger estructurado opcional para debug y errores.
   */
  logger?: {
    debug?: (msg: string, meta?: any) => void;
    error?: (msg: string, error: E) => void;
  };
  /**
   * Limpieza de recursos que se ejecuta siempre al terminar.
   */
  cleanup?: () => void | Promise<void>;
  /**
   * Callback al abortar, útil para reaccionar a `AbortSignal`.
   */
  onAbort?: (signal: AbortSignal) => void;
  /**
   * Configuración de circuit breaker por llamada.
   * Si no se define, puede usar el valor por defecto del `Runner`.
   */
  circuitBreaker?: CircuitBreakerOptions;
};

/**
 * Opciones de configuración del circuit breaker:
 * - failureThreshold: número de fallos consecutivos para abrir el circuito
 * - resetTimeout: tiempo en ms que permanece abierto antes de intentar half-open
 * - halfOpenRequests: cantidad permitida en estado half-open
 */
export type CircuitBreakerOptions = {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenRequests?: number;
};

/**
 * Métricas de ejecución devueltas opcionalmente en `RunResult`.
 */
export type Metrics = {
  totalAttempts: number;
  totalRetries: number;
  totalDuration: number;
  lastError?: AppError;
};

export type RunResult<T, E extends AppError = AppError> =
  | { ok: true; data: T; error: null; metrics?: Metrics }
  | { ok: false; data: null; error: E; metrics?: Metrics };

/**
 * Valida opciones comunes de ejecución/reintentos.
 */
export function validateOptions<T, E extends AppError = AppError>(
  options: RunOptions<T, E>
): void {
  if (options.retries != null && options.retries < 0) {
    throw new Error("retries must be >= 0");
  }
  if (options.timeout != null && options.timeout <= 0) {
    throw new Error("timeout must be > 0");
  }
  if (options.maxDelay != null && options.maxDelay < 0) {
    throw new Error("maxDelay must be >= 0");
  }
  const cb = options.circuitBreaker;
  if (cb) {
    if (cb.failureThreshold < 1) {
      throw new Error("failureThreshold must be >= 1");
    }
    if (cb.resetTimeout <= 0) {
      throw new Error("resetTimeout must be > 0");
    }
    if (cb.halfOpenRequests != null && cb.halfOpenRequests < 1) {
      throw new Error("halfOpenRequests must be >= 1");
    }
  }
}
