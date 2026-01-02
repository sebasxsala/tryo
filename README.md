# runtry

Run async functions and return a typed `Result` **instead of throwing**.

- ✅ No repetitive `try/catch` in UI code
- ✅ Typed success/error handling
- ✅ Pluggable error normalization (matchers / adapters)

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
  console.error("error:", result.error.code, result.error.message);
}
```

---

## API

### `run(fn, options?)`

```ts
import type { AppError, RunOptions, RunResult } from "runtry";

declare function run<T, E extends AppError = AppError>(
  fn: () => Promise<T>,
  options?: RunOptions<T, E>
): Promise<RunResult<T, E>>;
```

- Returns `{ ok: true, data, error: null }` on success
- Returns `{ ok: false, data: null, error }` on failure
- Never throws (unless your callbacks throw)

---

## Normalizing errors (matchers)

`runtry` can normalize unknown thrown values (`unknown`) into a consistent `AppError` shape.

### 1) Create matchers (adapters)

```ts
import {
  createNormalizer,
  abortMatcher,
  instanceOfMatcher,
  defaultFallback,
} from "runtry";
import type { AppError } from "runtry";
import { HttpError } from "./http-error"; // your app error class

type MyMeta = { url?: string; body?: unknown };

const httpMatcher = instanceOfMatcher(HttpError, (e) => ({
  code: "HTTP",
  message: e.message,
  status: e.status,
  meta: { url: e.url, body: e.body } as MyMeta,
  cause: e,
}));

const toError = createNormalizer<AppError<MyMeta>>(
  [abortMatcher, httpMatcher],
  (e) => defaultFallback(e) as AppError<MyMeta>
);
```

### 2) Use the normalizer in `run`

```ts
import { run } from "runtry";

const res = await run(getDocuments, {
  toError,
  onError: (e) => console.log(e.status, e.message),
});
```

---

## `createClient()` (configure once, reuse everywhere)

If you don't want to pass `toError` every time, create a client:

```ts
import {
  createClient,
  abortMatcher,
  instanceOfMatcher,
  defaultFallback,
} from "runtry";
import { HttpError } from "./http-error";

const client = createClient({
  matchers: [
    abortMatcher,
    instanceOfMatcher(HttpError, (e) => ({
      code: "HTTP",
      message: e.message,
      status: e.status,
      meta: { url: e.url, body: e.body },
      cause: e,
    })),
  ],
  fallback: defaultFallback,
  ignoreAbort: true, // default
});

const result = await client.run(getDocuments, {
  onError: (e) => console.log(e.code, e.message),
});
```

---

## React example (loading + toast, no try/catch)

```ts
import { createClient, abortMatcher, defaultFallback } from "runtry";

const client = createClient({
  matchers: [abortMatcher],
  fallback: defaultFallback,
});

useEffect(() => {
  let cancelled = false;
  setIsLoading(true);

  client.run(getDocuments, {
    onSuccess: (docs) => {
      if (cancelled) return;
      setUploadedFiles(docs.map(mapper));
    },
    onError: (e) => {
      if (e.code === "ABORTED") return;
      toast.error(e.message);
    },
    onFinally: () => {
      if (!cancelled) setIsLoading(false);
    },
  });

  return () => {
    cancelled = true;
  };
}, []);
```
