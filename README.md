# tryo

Run sync/async functions and return a typed Result instead of throwing. `tryo` provides powerful error normalization, retry logic, concurrency control, and circuit breakers with a premium developer experience.

## Installation

```bash
npm install tryo
# or
bun add tryo
```

## Basic Usage

You can use the top-level shortcuts for simple cases, or create a configured instance for complex scenarios.

### Using Shortcuts

```typescript
import { run } from 'tryo'

const result = await run(async () => {
  const res = await fetch('/api/data')
  if (!res.ok) throw new Error('Failed')
  return res.json()
})

if (result.ok) {
  console.log(result.data) // result.data is typed
} else {
  console.error(result.error.code) // "HTTP", "UNKNOWN", etc.
}
```

### Using the Factory (Best for Apps)

Creating an instance allows you to shared configuration like retries, circuit breakers, and custom error rules across your app.

```typescript
import tryo from 'tryo'

const ex = tryo({
  retry: {
    maxRetries: 3,
    strategy: RetryStrategies.exponential(100),
  },
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeout: 10000,
  },
})

const result = await ex.run(fetchData)
```

## Error Handling

`tryo` normalizes all errors into a `TypedError` instance with a stable `code`.

### The `TypedError` Shape

```typescript
type TypedError<Code extends string = string, Meta = unknown> = {
  code: Code // Stable error code (e.g. "TIMEOUT", "HTTP")
  message: string // Human-readable message
  cause?: unknown // Original error
  meta?: Meta // Extra metadata (optional)
  status?: number // Optional HTTP status (if applicable)
  retryable: boolean // Whether the error is safe to retry
  timestamp: number // When the error occurred (ms)
  stack?: string // Stack trace for debugging
}
```

### Default Rules

By default, `tryo` detects:

- **ABORTED**: Detects `AbortError`.
- **TIMEOUT**: Detects `TimeoutError`.
- **HTTP**: Detects status codes in error objects.
- **UNKNOWN**: Fallback for everything else.

### Custom Rules

Map specific exceptions to typed error codes using the `rules` option.

```typescript
import tryo, { errorRule } from 'tryo'

const ex = tryo({
  rules: [
    errorRule
      .when(e => e === 'unauthorized')
      .toError(() => ({
        code: 'AUTH_ERROR',
        message: 'Please login',
      })),
  ] as const,
})
```

## API Reference

### `.run(task, options?)`

Executes a single task. The `options` can override the instance defaults (except `signal`, which must be passed per call).

```typescript
const result = await ex.run(task, {
  timeout: 5000,
  signal: abortController.signal,
})
```

### `.all(tasks, options?)`

Executes multiple tasks with **concurrency control**. Like `Promise.allSettled` but with retries, timeouts, and a worker pool.

```typescript
const tasks = [() => job(1), () => job(2), () => job(3)]

// Execute 5-at-a-time
const results = await ex.all(tasks, { concurrency: 5 })
```

### `.partitionAll(results)`

Utility to separate successes from failures after an `all()` call.

```typescript
const { ok, failure, aborted, timeout } = ex.partitionAll(results)

console.log(`Successes: ${ok.length}`)
console.log(`Errors: ${failure.length}`)
```

### `.runOrThrow(task, options?)`

Utility if you prefer exceptions but want the power of `tryo` (retries, breaker, normalization).

```typescript
const data = await ex.runOrThrow(task) // Returns data or throws TypedError
```

## Advanced Features

### Concurrency

The `all()` method includes a worker pool that respects your `concurrency` limit and stops launching new tasks if the `signal` is aborted.

### Circuit Breaker

If your tasks fail repeatedly, the circuit breaker opens and prevents further calls to protect your downstream services.

```typescript
const ex = tryo({
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeout: 30000,
    halfOpenRequests: 2,
  },
})
```

### Observability Hooks

Add hooks for logging or monitoring:

```typescript
const ex = tryo({
  onRetry: (attempt, error, delay) => console.log(`Retry ${attempt}...`),
  onCircuitStateChange: (from, to) =>
    console.log(`Breaker moved: ${from} -> ${to}`),
})
```

## Why tryo?

1. **No More Try/Catch**: Handle results as data.
2. **Concurrency Control**: Built-in worker pool for batch operations.
3. **Normalized Errors**: Stable codes instead of unreliable error messages.
4. **Resiliency**: Sophisticated retry strategies and circuit breakers out of the box.
5. **Type Safety**: Full TypeScript support with inference for custom error rules.

---

License: MIT
