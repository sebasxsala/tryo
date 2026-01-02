export { run } from "./run";
export type { RunOptions, RunResult } from "./types";

export type { AppError, AppErrorCode } from "./error/types";
export {
  toAppError,
  defaultFallback,
  createNormalizer,
} from "./error/normalize";
export {
  abortMatcher,
  timeoutMatcher,
  instanceOfMatcher,
} from "./error/matchers";
