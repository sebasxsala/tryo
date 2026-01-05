````

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
````

### `runAllSettled(tasks, options?)`

Executes multiple tasks with concurrency control. Returns a discriminated union for each result.

```ts
const tasks = [
  () => fetch("/api/1"),
  () => fetch("/api/2"),
  () => fetch("/api/3"),
];

// Run max 2 at a time, settle all results
const results = await runner.allSettled(tasks, {
  concurrency: 2,
  mode: "settle", // "fail-fast" is also supported
});
```

### `runAll(tasks, options?)`

Like `Promise.all` but with concurrency control and retries. Throws the first error (normalized).

```ts
try {
  const data = await runner.all(tasks, { concurrency: 5 });
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
