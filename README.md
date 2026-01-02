# runtry

Run async functions and return a typed Result instead of throwing.

## Install

```bash
npm install runtry
```

## Usage

```ts
import { run } from "runtry";

const result = await run(async () => {
  return 42;
});

if (result.ok) {
  console.log(result.data);
} else {
  console.error(result.error.message);
}
```

## Why?

    - No try/catch in your UI
    - Typed error handling
    - Framework-agnostic
