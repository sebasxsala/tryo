export { run } from "./runner/run";
export { runAll } from "./runner/runAll";
export type { RunAllOptions } from "./runner/runAll";
export type { RunOptions, RunResult, RetryOptions } from "./types";

export type { AppError, AppErrorCode } from "./error/types";
export {
  toAppError,
  defaultFallback,
  createNormalizer,
} from "./error/normalize";
export {
  abortRule,
  timeoutRule,
  errorRule,
  messageRule,
  stringRule,
  statusRule,
  aggregateRule,
} from "./error/rules";

export { createRunner } from "./runner/runner";
export type { CreateRunnerOptions } from "./runner/runner";
