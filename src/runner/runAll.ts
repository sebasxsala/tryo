import { run } from "./run";
import type { AppError } from "../error/types";
import type { RunOptions, RunResult } from "../types";

export type RunAllItemResult<T, E extends AppError = AppError> =
  | { status: "ok"; ok: true; data: T; error: null }
  | { status: "error"; ok: false; data: null; error: E }
  | { status: "skipped"; ok: false; data: null; error: null };

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
   * Execution mode regarding errors.
   * - "settle": Run all tasks (default).
   * - "fail-fast": Stop starting new tasks if one fails.
   * @default "settle"
   */
  mode?: "settle" | "fail-fast";
};

export async function runAll<T, E extends AppError = AppError>(
  tasks: Array<() => Promise<T>>,
  options: RunAllOptions<T, E> = {}
): Promise<RunAllItemResult<T, E>[]> {
  const { concurrency = Infinity, mode = "settle", ...runOptions } = options;

  if (tasks.length === 0) return [];

  const limit = Number.isFinite(concurrency)
    ? Math.max(1, Math.floor(concurrency))
    : Infinity;

  const results: RunAllItemResult<T, E>[] = new Array(tasks.length);

  let nextIndex = 0;
  let aborted = false;

  const setResult = (i: number, r: RunResult<T, E>) => {
    results[i] = r.ok
      ? { status: "ok", ok: true, data: r.data, error: null }
      : { status: "error", ok: false, data: null, error: r.error };
  };

  const markSkipped = () => {
    for (let i = 0; i < tasks.length; i++) {
      if (results[i]) continue;
      results[i] = {
        status: "skipped",
        ok: false,
        data: null,
        error: null,
      };
    }
  };

  // Run all in parallel if unlimited or limit >= count
  if (limit >= tasks.length) {
    const rs = await Promise.all(tasks.map((t) => run<T, E>(t, runOptions)));
    rs.forEach((r, i) => {
      setResult(i, r);
    });
    return results;
  }

  const worker = async () => {
    while (true) {
      if (aborted) return;

      const i = nextIndex++;
      if (i >= tasks.length) return;

      const task = tasks[i];
      if (!task) continue; // skip if task is undefined

      const r = await run<T, E>(task, runOptions);
      setResult(i, r);

      if (!r.ok) {
        if (mode === "fail-fast") {
          aborted = true;
          return;
        }
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, () => worker())
  );

  markSkipped();
  return results;
}
