## Alcance y compatibilidad
- Implementar las 12 mejoras proponiendo cambios mínimos compatibles con el API actual.
- Mantener `run()`, `runAll()` y `createRunner()` como puntos de entrada, ampliando opciones y tipos sin romper usos existentes.
- Reutilizar el normalizador y reglas actuales para mapear `AbortError` y `TimeoutError`.

## Cambios de tipos
- En [types.ts](file:///Users/sebastiansala/projects/tryrun/src/types.ts):
  - Añadir `BackoffStrategy = 'linear' | 'exponential' | 'fibonacci' | ((attempt: number) => number)`.
  - Extender `RetryOptions<E>` con `backoffStrategy?: BackoffStrategy` y `maxDelay?: number`.
  - Añadir `RetryContext = { totalAttempts: number; elapsedTime: number }`.
  - Permitir lazy en `retryDelay?: number | (() => number) | RetryDelayFn<E>` y `shouldRetry?: (attempt: number, error: E, context: RetryContext) => boolean | Promise<boolean>`.
  - Extender `RunOptions<T,E>` con: `timeout?: number`, `onRetry?: (attempt: number, error: E, nextDelay: number) => void`, `logger?: { debug?: (msg: string, meta?: any) => void; error?: (msg: string, error: E) => void }`, `cleanup?: () => void | Promise<void>`, `onAbort?: (signal: AbortSignal) => void`, `circuitBreaker?: CircuitBreakerOptions`.
  - Añadir `CircuitBreakerOptions = { failureThreshold: number; resetTimeout: number; halfOpenRequests?: number }`.
  - Añadir `Metrics = { totalAttempts: number; totalRetries: number; totalDuration: number; lastError?: AppError }`.
  - Extender `RunResult<T,E>` para incluir `metrics?: Metrics` manteniendo el discriminado actual.
  - Exportar helpers para `runAll`: `SuccessResult<T>` y `ErrorResult<E>`, y `isSuccess<T,E>(r): r is SuccessResult<T>`.

## Utilidades (backoff y jitter)
- En [utils.ts](file:///Users/sebastiansala/projects/tryrun/src/utils.ts):
  - Crear `computeBackoffDelay(strategy, base, attempt)` que soporte linear/exponential/fibonacci/custom.
  - Actualizar `resolveRetryDelay` para considerar: `retryDelay` fijo/lazy/fn, `backoffStrategy` y `maxDelay`, manteniendo `defaultBaseDelay` actual.
  - Mantener `applyJitter()` tal cual, aplicando después del cálculo de backoff y del clamp de `maxDelay`.

## Implementación en run()
- En [run.ts](file:///Users/sebastiansala/projects/tryrun/src/runner/run.ts#L15-L85):
  - Validar opciones al inicio con `validateOptions(options)`.
  - Integrar `AbortSignal` nativo: si `options.signal?.aborted`, lanzar `DOMException('Aborted','AbortError')`. Suscribirse a `signal` para cancelación durante la ejecución, propagando `AbortError`.
  - Integrar `timeout`: crear `timeoutPromise` que rechace con `DOMException('Timeout','TimeoutError')` y usar `Promise.race([fn(), timeoutPromise])`.
  - Instrumentar métricas: `start = now`, `attempt` y `totalRetries`, `lastError`; al finalizar, calcular `totalDuration` y añadir `metrics` al `RunResult`.
  - Mejorar reintentos: calcular `delay` con estrategia de backoff + jitter, clamp a `maxDelay`, soportar `retryDelay` lazy, llamar `onRetry(attempt,error,delay)` y `logger.debug`.
  - Logging estructurado: `logger.debug` para intentos/éxitos/aborts/timeout y `logger.error` en fallo final.
  - Recursos: en abort, disparar `onAbort(signal)`; en `finally`, ejecutar `cleanup()` capturando errores y logueando `Cleanup failed` con `logger.error`.
  - `ignoreAbort`: cuando `ABORTED`, respetar comportamiento actual (no `onError` si `ignoreAbort`), pero siempre llamar `onFinally` y devolver `ok:false`.

## Circuit Breaker en createRunner
- En [runner.ts](file:///Users/sebastiansala/projects/tryrun/src/runner/runner.ts#L62-L127):
  - Añadir estado interno por instancia: `failureCount`, `openUntil`, y soporte `halfOpen` con contador de requests.
  - Soportar `opts` por defecto y `options.circuitBreaker` por llamada.
  - Antes de ejecutar, si breaker está "open" y no ha vencido `resetTimeout`, devolver inmediato error `AppError<'UNKNOWN'>` o una variante dedicada (podemos usar `code: 'UNKNOWN'` con mensaje `Circuit open`).
  - Al éxito, resetear contador y cerrar breaker; al fallo, incrementar y abrir cuando `failureThreshold` se alcanza; al expirar `resetTimeout`, permitir `halfOpenRequests` concurrencias controladas.
  - Mantener composición de `mapError` y delegar en `baseRun` para el resto.

## runAll y helpers
- En [runAll.ts](file:///Users/sebastiansala/projects/tryrun/src/runner/runAll.ts#L1-L101):
  - Exportar `SuccessResult`, `ErrorResult` y `isSuccess` (o dejarlos en `types.ts` y re-exportar desde `index.ts`).
  - Mantener lógica de concurrencia y `mode` actual; propagar nuevas opciones (`timeout`, `logger`, etc.) al `run()` interno.

## Validación y logging
- Añadir `validateOptions(options)` en [types.ts](file:///Users/sebastiansala/projects/tryrun/src/types.ts#L47-L106) y llamarlo en `run()`, `runAll()` y `createRunner().allOrThrow()`.
- Validaciones: `retries >= 0`, `timeout > 0` si definido, `maxDelay >= 0`, `failureThreshold >= 1`, `resetTimeout > 0`, etc.

## Telemetría y métricas
- `RunResult` incluirá `metrics` opcional; `runAll` continúa transformando a `RunAllItemResult` sin métricas (conservamos shape actual), dejando métricas disponibles cuando se use `run()` directo.
- Posible extensión futura: `RunAllItemResult` con `metrics`, se documentará pero se mantiene fuera para no romper.

## Exportaciones públicas
- En [index.ts](file:///Users/sebastiansala/projects/tryrun/src/index.ts#L1-L17): exportar nuevos tipos (`BackoffStrategy`, `CircuitBreakerOptions`, `Metrics`, helpers de `runAll`).

## Pruebas y verificación
- Unit tests:
  - Abort: con `AbortController` verificando `ABORTED` y `ignoreAbort`.
  - Timeout: confirmar rechazo por `TimeoutError` y normalización a `code: 'TIMEOUT'`.
  - Backoff: validar `linear`, `exponential`, `fibonacci` y custom; jitter dentro de rango; `maxDelay` aplicado.
  - Reintentos: `onRetry` invocado con `attempt` y `delay` correctos.
  - Circuit breaker: abrir tras `failureThreshold`, comportamiento `open`, `halfOpen` y cierre tras éxito.
  - Metrics: `totalAttempts`, `totalRetries`, `totalDuration` y `lastError`.
  - Helpers `isSuccess`: type guard correcto.
- Ejecución manual en ejemplo de uso aportado: con `timeout`, `backoffStrategy: 'exponential'`, `signal` y `circuitBreaker`.

## Ejemplo de uso actualizado
- Usar el ejemplo que compartiste, añadiendo `onAbort` y observando `onRetry` y `logger`.

¿Confirmas que procedamos con esta implementación y cambios de API (compatibles) para aplicar las 12 mejoras?