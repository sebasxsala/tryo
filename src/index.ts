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

export type { AppError, AppErrorCode } from "./error/types";
export {
  toAppError,
  defaultFallback,
  createNormalizer,
} from "./error/normalize";
export { rules } from "./error/core";

export { errorRule } from "./error/builder";

import type { AppError } from "./error/types";
import { createRunner } from "./runner/runner";
import type { CreateRunnerOptions, Runner } from "./runner/runner";

export default function trybox(
  options?: CreateRunnerOptions
): Runner<AppError> {
  return createRunner(options);
}
