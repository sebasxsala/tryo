export { run } from "./runner/run";
export { runAll, type RunAllItemResult } from "./runner/runAll";
export type {
  RunAllOptions,
  SuccessResult,
  ErrorResult,
} from "./runner/runAll";
export { isSuccess } from "./runner/runAll";
export { runAllOrThrow } from "./runner/runAllOrThrow";
export type { RunOptions, RunResult, RetryOptions } from "./types";
export type {
  BackoffStrategy,
  CircuitBreakerOptions,
  Metrics,
  RetryContext,
} from "./types";

export type { ResultError, ResultErrorCode } from "./error/types";
export {
  toResultError,
  defaultFallback,
  createNormalizer,
} from "./error/normalize";
export { rules } from "./error/core";

export { errorRule } from "./error/builder";

import type { ResultError, Rule, InferErrorFromRules } from "./error/types";
import { createRunner } from "./runner/runner";
import type { CreateRunnerOptions, Runner } from "./runner/runner";
import type { DefaultError } from "./error/core";

export default function trybox(
  options?: Omit<CreateRunnerOptions<ResultError>, "rules">
): Runner<ResultError>;

export default function trybox<const TRules extends readonly Rule<any>[]>(
  options: {
    rules: TRules;
    rulesMode: "replace";
  } & Omit<
    CreateRunnerOptions<InferErrorFromRules<TRules>>,
    "rules" | "rulesMode"
  >
): Runner<InferErrorFromRules<TRules>>;

export default function trybox<const TRules extends readonly Rule<any>[]>(
  options: {
    rules: TRules;
    rulesMode?: "extend";
  } & Omit<
    CreateRunnerOptions<InferErrorFromRules<TRules> | DefaultError>,
    "rules" | "rulesMode"
  >
): Runner<InferErrorFromRules<TRules> | DefaultError>;

export default function trybox(options: any = {}): any {
  return createRunner(options);
}
