import { runAll } from "./src/runner/runAll";
import { run } from "./src/runner/run";
import type { AppError } from "./src/error/types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log("Starting runAll features verification...");

  const tasks = [
    async () => {
      await delay(50);
      return 1;
    },
    async () => {
      await delay(50);
      throw new Error("Fail 1");
    },
    async () => {
      await delay(50);
      return 3;
    },
    async () => {
      await delay(50);
      return 4;
    },
  ];

  // Test 1: mode="settle" (default)
  console.log("\nTest 1: Default settle");
  const res1 = await runAll(tasks, { concurrency: 2 });
  if (res1.length === 4 && !res1[1].ok && res1[2].ok) {
    console.log("  ✅ Settle mode passed");
  } else {
    console.error("  ❌ Settle mode failed", res1);
    process.exit(1);
  }

  // Test 2: mode="fail-fast" (limited concurrency)
  console.log("\nTest 2: Fail fast (concurrency 1)");
  // Task 2 fails. Task 3 and 4 should NOT run.
  const res2 = await runAll(tasks, { concurrency: 1, mode: "fail-fast" });

  // Index 0: ok
  // Index 1: fail
  // Index 2: undefined (skipped)
  // Index 3: undefined (skipped)

  if (res2[0]?.ok && !res2[1]?.ok && res2[2] === undefined) {
    console.log("  ✅ Fail-fast stopped execution");
  } else {
    console.error("  ❌ Fail-fast failed", res2);
    process.exit(1);
  }

  // Test 3: throwOnError=true
  console.log("\nTest 3: throwOnError");
  try {
    await runAll(tasks, { throwOnError: true, concurrency: 2 });
    console.error("  ❌ Should have thrown");
    process.exit(1);
  } catch (err: any) {
    if (err.message === "Fail 1" || err.cause?.message === "Fail 1") {
      console.log("  ✅ Threw correct error");
    } else {
      console.error("  ❌ Threw wrong error", err);
      process.exit(1);
    }
  }

  console.log("\nAll feature tests passed!");
}

main().catch(console.error);
