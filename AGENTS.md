# AGENTS.md

Repository guidance for autonomous coding agents working in `runtry`.

## Project Snapshot

- Package name: `tryo` (library exports `tryo` and related helpers).
- Language/runtime: TypeScript on Bun.
- Build output: `dist/` (ESM + CJS + type declarations) via `tsup`.
- Primary source: `src/`.
- Tests: `tests/*.test.ts` using `bun:test`.
- Docs site: `docs/` (Mintlify).

## Environment and Setup

- Install dependencies: `bun install`.
- Use Bun for all scripts unless explicitly required otherwise.
- Node package manager files present: `package.json`, `bun.lock`.
- TypeScript is configured in strict mode (`tsconfig.json`).

## Build, Lint, Typecheck, Test Commands

- Build library: `bun run build`.
- Type check only: `bun run typecheck`.
- Lint: `bun run lint`.
- Lint + safe fixes: `bun run lint:fix`.
- Full Biome check: `bun run check`.
- Full Biome check with writes: `bun run check:fix`.
- Run full test suite: `bun test` or `bun run test`.
- Run docs dev server: `bun run docs:dev`.
- Run Spanish docs dev server: `bun run docs:dev:es`.
- Build docs: `bun run docs:build`.
- Preview docs build: `bun run docs:preview`.

## Running a Single Test (Important)

- Run one test file: `bun test tests/retry.test.ts`.
- Run multiple specific files: `bun test tests/retry.test.ts tests/runner.test.ts`.
- Run tests by file name pattern: `bun test retry`.
- Run one test by name regex: `bun test -t "counts retries correctly"`.
- Combine file + test name filter: `bun test tests/retry.test.ts -t "succeeds after retries"`.
- Rerun flaky checks repeatedly: `bun test tests/retry.test.ts --rerun-each 20`.

## CI and Git Hook Expectations

- CI runs (GitHub Actions):
- `bun install`
- `bun run typecheck`
- `bun run lint`
- `bun run check:fix`
- `bun test`
- Pre-commit hook runs: `bun lint-staged`.
- Pre-push hook runs: `bun run typecheck` and `bun run test`.
- Keep changes passing these checks before handing work back.

## Files Agents Should Treat As Generated

- `dist/**` is build output from `tsup`.
- Do not manually edit generated files in `dist/`.
- Regenerate with `bun run build` when needed.

## Formatting and Style Baseline

- Formatter/linter: Biome (`biome.json`).
- Indentation: tabs (not spaces).
- JavaScript/TypeScript quotes: single quotes.
- JSON trailing commas: disabled.
- Imports are auto-organized by Biome assist.
- Keep formatting tool-driven; do not hand-format against Biome.

## Import Conventions

- Prefer relative imports within `src` (no path alias pattern is configured).
- Keep imports at top of file.
- Use `import type` for type-only imports.
- It is acceptable to mix value and type imports from the same module when clearer.
- Group imports logically: external first, then internal.
- Avoid unused imports; `noUnusedLocals` and lint rules are enabled.

## TypeScript Conventions

- Preserve strict typing; do not weaken `strict` guarantees.
- Avoid `any`; use `unknown` and narrow intentionally.
- Prefer explicit domain types and generics over loose records.
- Use discriminated unions for result/error shapes (e.g. `ok`, `type`, `code`).
- Favor `readonly` fields in interfaces and config objects.
- Use exhaustive `switch` handling with `never` fallback in union branches.
- Follow existing branded-type helpers (`asMilliseconds`, `asRetryCount`, etc.).
- Keep public API types exported from `src/index.ts` when adding surfaced features.
- Default generic parameters are used widely; preserve that style.

## Naming Conventions

- File names: kebab-case (examples: `error-normalizer.ts`, `retry-strategies.ts`).
- Classes/types/interfaces: PascalCase.
- Functions/variables/methods: camelCase.
- Constants that are semantic codes are uppercase string literals (e.g. `'TIMEOUT'`).
- Error classes end with `Error`.
- Factory/builder utilities use verb-oriented names (`createX`, `asX`).
- Test files end in `.test.ts` and mirror behavior-focused naming.

## Error Handling Patterns

- In source, normalize unknown failures into typed errors.
- Prefer `TypedError` hierarchy and normalization rules over ad-hoc throws.
- Use rule-based normalization (`errorRule`, `createErrorNormalizer`) when extending behavior.
- Keep fallback behavior explicit (`UnknownError` path).
- `run`/`all` return typed results; reserve throws for `orThrow` APIs.
- Treat hook/logger failures as non-fatal (wrap in safe calls).
- Respect abort and timeout semantics; pass and honor `AbortSignal`.
- Avoid swallowing actionable errors unless pattern requires control-flow safety.

## Testing Conventions

- Use `bun:test` imports (`describe`, `it`, `expect`).
- Prefer async tests for async behavior and retries.
- Assert both success/failure state and metrics where relevant.
- For type-level behavior, use compile-time assertions and `@ts-expect-error` sparingly.
- Keep test names descriptive and behavior-based.
- Add regression tests for bug fixes.

## Change Discipline for Agents

- Make minimal, focused edits aligned with existing architecture.
- Do not rename public API identifiers without clear migration intent.
- Update docs/tests when behavior or signatures change.
- Run relevant checks locally after edits:
- Minimum for code changes: `bun run typecheck` and targeted `bun test ...`.
- Preferred before completion: `bun run lint`, `bun run typecheck`, `bun test`.

## Cursor/Copilot Rule Files

- Checked for `.cursorrules`: not present.
- Checked for `.cursor/rules/`: not present.
- Checked for `.github/copilot-instructions.md`: not present.
- No Cursor/Copilot instruction files are currently enforced in this repo.
- If any of these files are added later, treat them as high-priority instructions.

## Quick Command Reference

- `bun install`
- `bun run lint`
- `bun run typecheck`
- `bun test`
- `bun test tests/<file>.test.ts`
- `bun test -t "<regex>"`
- `bun run build`
