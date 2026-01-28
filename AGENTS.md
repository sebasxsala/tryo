# trybox AGENT GUIDE

This repository uses TypeScript + Bun and ships via `tsup`. Below you will find every command an agent needs plus the stylistic guardrails for coding, testing, and documenting so future contributors stay aligned.

## Build / Lint / Test

- **Full build**
  - `bun run build` -> Bundles the project with `tsup` and emits ESM/CJS/types in `dist`. Always run before publishing or shipping artifacts.
  - `bun run typecheck` -> Runs `tsc --noEmit` against `tsconfig.json` to keep the strict surface error-free.
  - When adjusting exports, also refresh `dist` locally to ensure the generated `.d.ts` files match what you intend to expose.

- **Quality tooling**
  - `bun run format` -> `biome format --write`; run before commits to maintain consistent whitespace, tabs, and import order.
  - `bun run lint` -> `biome lint --write`; ensures lint rules, unused imports, and stylistic expectations stay satisfied.
  - `bun run check` -> `biome check --write`; provides an additional layer of static analysis beyond linting.
  - Mintlify docs: `bun run docs:dev`, `bun run docs:dev:es`, `bun run docs:build`, and `bun run docs:preview` all expect you to `cd docs && mintlify ...` as the scripts declare.

- **Testing**
  - `bun test` -> Runs all tests via `bun:test` (the default test runner inside `tests/`).
  - `bun test tests/<file>.test.ts` -> Execute a single test file for diagnostics; keep the relative path precise for Bun.
  - When you hit timing-heavy cases, rely on `sleep` helpers or `AbortController` to drive the scenario instead of inserting arbitrary waits.
  - `bun test --watch` is available for rapid iteration if you need Bun’s watch mode, though no script currently calls it.

- **Pre-publish safety**
  - `bun run prepublishOnly` -> Alias to `bun run build`; run this (or let npm run it) when publishing since npm invokes the script before publishing.

## Code Style & Conventions

### Imports & exports

- Prefer explicit `import`/`export` statements, grouped by feature, not by alphabetical order.
- Stick with module-relative paths (`./`, `../`); there are no path aliases configured.
- Re-export type-only members through `export type { ... }` to keep the public API surface explicit.
- Avoid default exports; named exports provide better tree-shaking and clearer diff history.

### Formatting

- Use tabs for indentation; the source files consistently indent with tabs, so match that spacing.
- Group logically related statements together; separate configuration blobs, helper functions, and exports with blank lines.
- When wrapping long generics or chained calls, align the continuation level to match the first argument or `.` chain.
- Comments explain *why* the code exists, not the obvious behavior; lean on header comments for modules or complex blocks.

### Types & Structures

- Favor strongly typed return shapes like `ExecutionResult<T, E>` and `ExecutionMetrics<E>` rather than `any`.
- Use branded utility types (`Milliseconds`, `RetryCount`, etc.) from `src/types` to keep units explicit.
- Guard optional hooks or logger callbacks with safe navigation (`hooks?.onError?.(...)`).
- When inferring custom errors, rely on `InferErrorFromRules` so the compiler knows the shape of `error` everywhere.
- Keep execution configuration separate from options objects (use a dedicated `ExecutionConfig` type so the constructor isn’t overloaded).

### Naming

- Functions run camelCase (`execute`, `executeInternal`, `runAttempt`).
- Classes follow PascalCase (`Executor`, `CircuitBreaker`).
- Config constants and unions remain descriptive (`RulesMode`, `DefaultError`, `retryHistory`).
- Don’t abbreviate unless universally understood (`ctx`, `opts`, `ex`, `r`).

### Async / Control Flow

- Accept an `AbortSignal` for any I/O and wrap it with `createCompositeSignal` so calls can layer their own cancellations.
- Track retries with `totalAttempts`, `totalRetries`, and push entries to `retryHistory` before sleeping to preserve context.
- Re-use the `sleep` helper from `src/utils/timing` and pass the composite signal for cancellation-aware delays.
- Circuit breaker checks happen before calling the task: if `canExecute` is false, return a `CIRCUIT_OPEN` failure result immediately.

### Retry Strategy

- Compute retry delays through `calculateDelay` in `src/retry/retry-strategies.ts` so every strategy stays centralized.
- Save a structured object for every retry attempt (`{ attempt, error, delay, timestamp }`) in `retryHistory` to feed hooks and metrics.
- Always await `sleep(delay, compositeSignal)` so the delay honors `AbortSignal` state when a caller cancels mid-delay.

### Circuit Breaker Handling

- Keep breaker configuration on the `Executor`; do not mutate shared breaker state outside the class.
- When the threshold is reached, the breaker returns failures with `code === 'CIRCUIT_OPEN'` until the reset timeout runs.
- Half-open runs should trigger `recordSuccess` when they succeed so the breaker closes and failure counters reset.

### Error Handling

- Normalize all thrown values via `errorHandling.normalizer`; if a custom `mapError` exists, apply it immediately afterward.
- Default rules cover `ABORTED`, `TIMEOUT`, `HTTP`, `UNKNOWN`, plus `CIRCUIT_OPEN` coming from the breaker.
- Custom rules use `errorRule` helpers; you can extend or replace the built-ins depending on `rulesMode`.
- Prefer the fallback normalizer when nothing matches; it ensures every result carries a `code`, `message`, and optional `meta` data.
- Do not swallow errors; if retries are exhausted or disabled, `throw mapped` and let the caller convert it into an `ExecutionResult` record.

### Hooks & Observability

- Invoke `hooks?.onSuccess`, `hooks?.onError`, and `hooks?.onRetry` only with normalized payloads so observers never see raw throws.
- Fire `hooks?.onFinally?.(metrics)` after either success or failure so the observer can finalize dashboards or cleanup.
- Use `logger?.info` for happy path milestones and `logger?.error` for failure traces; don’t let logging throw.

### Metrics & Logging

- Build the `ExecutionMetrics` object *before* returning: include counts, duration, `retryHistory`, and the `lastError` when applicable.
- When a run fails, set `metrics.lastError` early so `hooks?.onFinally` can inspect the failure if it needs to.
- Avoid logging inside loops; aggregate metrics first, then log a concise summary once per attempt.

### Testing Patterns

- Tests rely on Bun’s built-in runner (`import { describe, expect, it } from 'bun:test'`).
- Use factory helpers (`const make = (...) => new Executor(...)`) so repetitive setup remains DRY and easy to tweak.
- Scope features with `describe` blocks (`run: success`, `run: abort`, etc.) and keep assertions inside `it` statements focused.
- Guard typed expectations with conditional checks (`if (r.ok) expect(r.data)...`) to satisfy TypeScript.
- For abort/timeout scenarios, drive the helper `sleep` and the `AbortController` so metrics can be asserted reliably.

## Documentation & Release Notes

- Documentation lives in the `docs/` folder; run the Mintlify scripts from within that directory.
- When updating docs, keep changes in sync with the API surface in `src/index.ts` so the README examples match exports.
- Version bumps should accompany `bun run build` (and ideally `bun run typecheck`) to guarantee the `dist` files align with the new API.

## Agent Guidance

- Be deliberate with retries: only re-run when `retry.shouldRetry` is missing or returns `true`, and always await `sleep(delay, compositeSignal)` so cancellation is honored.
- Circuit breaker configuration (failure threshold, reset timeout, half-open requests) stays locked inside the `Executor`; do not mutate shared breaker state manually.
- No Cursor rules or Copilot instructions exist in this repo (`.cursor/rules` and `.github/copilot-instructions.md` are absent), so these general conventions are the source of truth.
- Keep docs workflows separate from source changes; Mintlify scripts run in `docs/` and regenerate static output without touching `src`.
- If you add new tooling or patterns, update this AGENTS guide so the next agent knows how to proceed.
- Don’t revert or touch unrelated user changes; read others’ edits carefully and work around them when possible.

## Common Patterns

- `execute` is the central entry point; `executeOrThrow`, `executeAll`, and `executeAllOrThrow` all funnel through the same config path so updates stay consistent.
- `createExecutor` allows you to tighten error typing by supplying rules/rulesMode without overflowing the base `ExecutorOptions` shape.
- Retry hooks (`hooks?.onRetry`, `hooks?.onError`) always log normalized errors and only trigger when the run fails to keep metrics clean.
- `withConfig` and `withErrorType` helpers produce fresh executors when you need different retry/circuit or error mappings without mutating global state.
- `ExecutionMetrics` objects always capture the start/duration timestamps, retry history, and last error so observability consumers can trace runs without hitting logs.
- When you touch error handling, keep the default rules in step with `defaultRules` in `src/error/error-rules.ts` so codes remain aligned with README examples.
- Tests target every path described in README (success, abort, timeout, circuit breaker) so use the same scenarios when expanding coverage.

## Workspace Hygiene

- This repo may already contain unrelated changes from the user. Never revert them unless explicitly asked; work around them instead.
- Only create commits when the user explicitly asks for one. If the user later requests a commit, summarize staged changes first before crafting the message.
- Formatting should be handled via `bun run format` rather than ad-hoc edits; this keeps whitespace and imports uniform.
- Avoid destructive git commands (`reset --hard`, `checkout --`, etc.) unless the user explicitly approves the operation.
- If a git hook fails, fix the issue and make a fresh commit; do not use `--amend` unless the user requests it and you meet the special conditions.
- Never push to remote unless explicitly instructed. If the user asks for a push, describe exactly what you pushed and why.
- Treat directories such as `dist` and `node_modules` as generated outputs; you should not edit them manually.

## Next Steps

- After making code changes, rerun `bun run build`, `bun run typecheck`, `bun run format`, and `bun run lint` in that order if you touched source files.
- Run targeted tests via `bun test tests/<file>.test.ts` whenever you adjust `tests/` or execution logic; this catches regressions quickly.
- When handing work back to the user, highlight any risky assumptions (e.g., flaky timing, new retries, or circuit breaker thresholds) so they can validate the behavior.
- Update `README.md` or `docs/` whenever you change exports or public APIs so examples stay aligned with the code.
- If you change retry/circuit defaults, mention the deviation in the docs and double-check that `ExecutionMetrics` still captures expected values.
- Before finishing, scan `bun.lock`/`package.json` for dependency changes to ensure they align with the requested feature scope.
