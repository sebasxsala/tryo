import { run } from "./run";
import type { AppError } from "./error/types";
import type { RunOptions, RunResult } from "./types";

export type RunAllOptions<T, E extends AppError = AppError> = RunOptions<
  T,
  E
> & {
  /**
   * Maximum number of concurrent tasks to run.
   * @default Infinity
   */
  concurrency?: number;

  /**
   * Called after each task finishes (success or error).
   */
  onSettled?: (result: RunResult<T, E>, index: number) => void;
};

export async function runAll<T, E extends AppError = AppError>(
  tasks: Array<() => Promise<T>>,
  options: RunAllOptions<T, E> = {}
): Promise<RunResult<T, E>[]> {
  const { concurrency = Infinity, onSettled, ...runOptions } = options;

  if (tasks.length === 0) return [];

  const limit = Number.isFinite(concurrency)
    ? Math.max(1, Math.floor(concurrency))
    : Infinity;

  // Run all in parallel if unlimited or limit >= count
  if (limit >= tasks.length) {
    const results = await Promise.all(
      tasks.map((t) => run<T, E>(t, runOptions))
    );
    results.forEach((r, i) => onSettled?.(r, i));
    return results;
  }

  const results: RunResult<T, E>[] = new Array(tasks.length);
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const i = nextIndex++;
      if (i >= tasks.length) return;

      const task = tasks[i];
      if (!task) continue;

      const res = await run<T, E>(task, runOptions);
      results[i] = res;
      onSettled?.(res, i);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, worker)
  );
  return results;
}
