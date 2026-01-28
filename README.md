# trybox

Run sync/async functions and return a typed Result instead of throwing. `trybox` provides powerful error normalization, retry logic, and concurrency control.

## Installation

```bash
npm install trybox
# or
bun add trybox
```

## Basic Usage

```typescript
import trybox from "trybox";

const runner = trybox();

const result = await runner.run(async () => {
  const res = await fetch("/api/data");
  if (!res.ok) throw new Error("Failed");
  return res.json();
});

if (result.ok) {
  console.log(result.data);
} else {
  console.error(result.error.message);
}
```

## Error Handling

`trybox` normalizes all errors into a `TypedError` instance with a stable `code`.

### The `TypedError` Shape

All errors are normalized to this shape:

```typescript
type TypedError<Code extends string = string, Meta = unknown> = {
  code: Code; // Stable error code (e.g. "TIMEOUT", "HTTP")
  message: string; // Human-readable message
  cause?: unknown; // Original error
  meta?: Meta; // Extra metadata (optional)
  status?: number; // Optional HTTP status (if applicable)
};
```

### Default Rules

If no custom rules are provided, `trybox` applies these default rules:

- **ABORTED**: Detects `AbortError` (e.g., from `AbortController`).
- **TIMEOUT**: Detects `TimeoutError`.
- **HTTP**: Detects objects with `status` or `statusCode` (number).
- **UNKNOWN**: Fallback for other errors (strings, generic errors).

```typescript
const result = await runner.run(fetchData);

if (!result.ok) {
  switch (result.error.code) {
    case "ABORTED":
      // Handle cancellation
      break;
    case "TIMEOUT":
      // Handle timeout
      break;
    case "HTTP":
      console.log("Status:", result.error.status);
      break;
  }
}
```

### Custom Rules

You can define custom error rules to map specific exceptions to typed error codes.

```typescript
import trybox, { errorRule } from "trybox";

const runner = trybox({
  rules: [
    // Map specific error string to a code
    errorRule
      .when((e) => e === "foo")
      .toError(() => ({
        code: "CUSTOM_FOO",
        message: "Foo happened",
      })),
    // Map class instance
    errorRule.instance(MyCustomError).toError((e) => ({
      code: "MY_ERROR",
      message: e.message,
      meta: { details: e.details },
    })),
  ],
});
```

## API

### `runner.run(fn, options?)`

Executes a single function with retry and error handling.

```typescript
import trybox, { RetryStrategies } from "trybox";

await runner.run(fn, {
  retry: {
    maxRetries: 3,
    strategy: RetryStrategies.fixed(1000),
  },
  hooks: {
    onSuccess: (data) => console.log("Success:", data),
    onError: (err) => console.error("Error:", err),
  },
});
```

### `runner.runAll(tasks, options?)`

Executes multiple tasks with concurrency control. Returns all results (success or failure).

```typescript
const tasks = [
  () => fetch("/api/1"),
  () => fetch("/api/2"),
  () => fetch("/api/3"),
];

const results = await runner.runAll(tasks, {
  concurrency: 2,
});
```

### `runner.runOrThrowAll(tasks, options?)`

Like `Promise.all` but with concurrency control. Throws the first normalized error if any fails.

```typescript
try {
  const data = await runner.runOrThrowAll(tasks, { concurrency: 5 });
} catch (err) {
  // err is TypedError
  console.error(err.code);
}
```

## React Example

```typescript
useEffect(() => {
  let cancelled = false;

  runner.run(fetchData, {
    onSuccess: (data) => {
      if (!cancelled) setData(data);
    },
    onError: (err) => {
      if (err.code === "ABORTED") return;
      toast.error(err.message);
    },
  });

  return () => {
    cancelled = true;
  };
}, []);
```

## Cancellation and Timeout

- `signal` and `timeout` control how long we wait for the operation to finish.
- If your `fn` does not use the provided `AbortSignal`, we cannot cancel the underlying I/O magically.
- The library races the work and can return `ABORTED`/`TIMEOUT` quickly, but it does not terminate the request unless your code cooperates with the `signal`.

```typescript
const controller = new AbortController();
const r = await runner.run(fetchData, { signal: controller.signal, timeout: 3000 });
// If fetchData doesn't use the signal, run() will stop waiting and return TIMEOUT/ABORTED,
// but the inner request continues unless it handles the signal.
```

## Circuit Breaker (Runner-level)

- Configuration lives at the Runner level via `trybox({ circuitBreaker: ... })`.
- Per-call circuit breaker in `RunOptions` is not supported to reduce API surface.
- Example:

```typescript
const runner = trybox({
  circuitBreaker: { failureThreshold: 3, resetTimeout: 1000, halfOpenRequests: 1 },
});
```
