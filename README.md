# runtry

Run async functions and return a typed `Result` **instead of throwing**.

- ✅ No repetitive `try/catch` in UI code
- ✅ Typed success/error handling
- ✅ Pluggable error normalization (rules)
- ✅ **Automatic Retries** with backoff & jitter
- ✅ **Concurrency control** with `runAll`

---

## Install

```bash
npm i runtry
# or
bun add runtry
# or
pnpm add runtry
```

---

## Quick start

```ts
import { run } from "runtry";

const result = await run(async () => {
  // any async work
  return 42;
});

if (result.ok) {
  console.log("data:", result.data);
} else {
  console.log("error:", result.error.code); // "UNKNOWN" | "ABORTED" | ...
}
```

---

## `createRunner()` (Recommended)

Define your error rules once and reuse them. Types are inferred automatically!

```ts
import { createRunner, rules, errorRule } from "runtry";
import { ZodError } from "zod";
import { AxiosError } from "axios";

const runner = createRunner({
  rules: [
    // Core rules (optional)
    rules.abort(), // code: "ABORTED"
    rules.timeout(), // code: "TIMEOUT"

    // Custom rules (type inferred!)
    errorRule.instance(ZodError).toError((e) => ({
      code: "VALIDATION_ERROR", // Literal type "VALIDATION_ERROR"
      message: "Validation failed",
      meta: { issues: e.issues },
    })),

    errorRule.instance(AxiosError).toError((e) => ({
      code: "HTTP_ERROR",
      message: e.message,
      status: e.response?.status,
    })),
  ],
});

// Now use it everywhere
const result = await runner.run(fetchUser);

if (!result.ok) {
  // ⭐️ Strict typing based on your rules!
  // error.code is "ABORTED" | "TIMEOUT" | "VALIDATION_ERROR" | "HTTP_ERROR" | "UNKNOWN"

  if (result.error.code === "VALIDATION_ERROR") {
    console.log(result.error.meta.issues); // Typed!
  }
}
```

---

## API

### `run(fn, options?)`

Executes a single async function.

```ts
await runner.run(fn, {
  retries: 3,
  retryDelay: (attempt) => attempt * 1000,
  onError: (err) => toast.error(err.message),
  onSuccess: (data) => console.log(data),
});
```

### `runAll(tasks, options?)`

Executes multiple tasks with concurrency control.

```ts
const tasks = [
  () => fetch("/api/1"),
  () => fetch("/api/2"),
  () => fetch("/api/3"),
];

// Run max 2 at a time, stop if any fails
const results = await runner.all(tasks, {
  concurrency: 2,
  mode: "fail-fast", // or "settle" (default)
});
```

### `runAllOrThrow(tasks, options?)`

Like `Promise.all` but with concurrency control and retries. Throws the first error (normalized).

```ts
try {
  const data = await runner.allOrThrow(tasks, { concurrency: 5 });
} catch (err) {
  // err is your typed AppError
  console.error(err.code);
}
```

---

## React Example

```ts
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
