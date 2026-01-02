export { run } from "./run";
export { runAll } from "./runAll";
export type { RunAllOptions } from "./runAll";
export type { RunOptions, RunResult, RetryOptions } from "./types";

export type { AppError, AppErrorCode } from "./error/types";
export {
  toAppError,
  defaultFallback,
  createNormalizer,
} from "./error/normalize";
export {
  abortMatcher,
  timeoutMatcher,
  matchInstance,
  messageMatcher,
  stringMatcher,
  statusMatcher,
  aggregateMatcher,
} from "./error/matchers";

export { createClient } from "./client";
export type { CreateClientOptions } from "./client";
