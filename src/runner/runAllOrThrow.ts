import { run } from "./run";
import type { AppError } from "../error/types";
import type { RunOptions, RunResult } from "../types";

export type RunAllOrThrowOptions<T, E extends AppError = AppError> = RunOptions<
  T,
  E
> & {
  /**
   * Maximum number of concurrent tasks to run.
   * @default Infinity
   */
  concurrency?: number;
};

export async function runAllOrThrow<T, E extends AppError = AppError>(
  tasks: Array<() => Promise<T>>,
  options: RunAllOrThrowOptions<T, E> = {}
): Promise<T[]> {
  const { concurrency = Infinity, ...runOptions } = options;

  if (tasks.length === 0) return [];

  const limit = Number.isFinite(concurrency)
    ? Math.max(1, Math.floor(concurrency))
    : Infinity;

  const data: T[] = new Array(tasks.length);

  // Run all in parallel if unlimited or limit >= count
  if (limit >= tasks.length) {
    await Promise.all(
      tasks.map(async (t, i) => {
        const r = await run<T, E>(t, runOptions);
        if (!r.ok) throw r.error;
        data[i] = r.data;
      })
    );
    return data;
  }

  let nextIndex = 0;
  let aborted = false;
  let firstError: E | null = null;

  const worker = async () => {
    while (true) {
      if (aborted) return;

      const i = nextIndex++;
      if (i >= tasks.length) return;

      const task = tasks[i];
      if (!task) continue; // skip if task is undefined

      const r = await run<T, E>(task, runOptions);

      if (!r.ok) {
        firstError ??= r.error;
        aborted = true;
        return;
      }

      data[i] = r.data;
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, () => worker())
  );

  if (firstError) throw firstError;

  // Safety fill
  return data;
}
