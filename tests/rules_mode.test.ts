import { describe, it, expect } from "bun:test";
import trybox, { errorRule } from "../src/index";
import { sleep } from "../src/utils";

describe("rulesMode default behavior", () => {
  it("extends default rules when rulesMode is undefined (default)", async () => {
    const runner = trybox({
      rules: [
        errorRule
          .when((e): e is "custom" => e === "custom")
          .toError(() => ({
            code: "CUSTOM_ERROR" as const,
            message: "Custom error",
          })),
      ],
      // rulesMode is undefined, should default to "extend"
    });

    // 1. Check custom rule
    const resultCustom = await runner.run(async () => {
      throw "custom";
    });
    expect(resultCustom.ok).toBe(false);
    if (!resultCustom.ok) {
      expect(resultCustom.error.code).toBe("CUSTOM_ERROR");
    }

    // 2. Check default rule (e.g. Timeout)
    const resultTimeout = await runner.run(
      async () => {
        await sleep(50);
        return "done";
      },
      { timeout: 10 } // This forces a timeout inside run() which throws a TimeoutError
    );

    // If default rules are present, it should be TIMEOUT.
    // If they were replaced, it would be UNKNOWN (or fallback).
    expect(resultTimeout.ok).toBe(false);
    if (!resultTimeout.ok) {
      // NOTE: run() internal logic throws a special timeout error that matches default rules.
      expect(resultTimeout.error.code).toBe("TIMEOUT");
    }
  });

  it("replaces default rules when rulesMode is 'replace'", async () => {
    const runner = trybox({
      rules: [
        errorRule
          .when((e): e is "custom" => e === "custom")
          .toError(() => ({
            code: "CUSTOM_ERROR" as const,
            message: "Custom error",
          })),
      ],
      rulesMode: "replace",
    });

    // 1. Check custom rule
    const resultCustom = await runner.run(async () => {
      throw "custom";
    });
    expect(resultCustom.ok).toBe(false);
    if (!resultCustom.ok) {
      expect(resultCustom.error.code).toBe("CUSTOM_ERROR");
    }

    // 2. Check default rule behavior (should fail to match TIMEOUT and go to UNKNOWN)
    // We simulate a timeout error object manually to test the mapping,
    // because run({timeout}) might generate an error that we can't easily inspect if it's internal.
    // However, the default rules check for error.name === 'TimeoutError' usually.

    const resultTimeout = await runner.run(async () => {
      const e = new Error("timeout");
      e.name = "TimeoutError";
      throw e;
    });

    expect(resultTimeout.ok).toBe(false);
    if (!resultTimeout.ok) {
      expect(resultTimeout.error.code).toBe("UNKNOWN");
    }
  });
});
