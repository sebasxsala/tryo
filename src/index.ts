export { run } from "./runner/run";
export { runAllSettled, type RunAllItemResult } from "./runner/runAllSettled";
export type {
  RunAllOptions,
  SuccessResult,
  ErrorResult,
} from "./runner/runAllSettled";
export { isSuccess } from "./runner/runAllSettled";
export { runAll } from "./runner/runAll";
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

export default function trybox(
  options?: Omit<CreateRunnerOptions<ResultError>, "rules">
): Runner<ResultError>;

export default function trybox<const TRules extends readonly Rule<any>[]>(
  options: { rules: TRules } & Omit<
    CreateRunnerOptions<InferErrorFromRules<TRules>>,
    "rules"
  >
): Runner<InferErrorFromRules<TRules>>;

export default function trybox(options: any = {}): any {
  return createRunner(options);
}
