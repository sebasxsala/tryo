import { describe, it, expect } from "bun:test";
import trybox, { errorRule } from "../src/index";

describe("Type inference", () => {
  it("infers custom error codes from rules and narrows meta type", async () => {
    const runner = trybox({
      rules: [
        errorRule
          .when((e): e is "foo" => e === "foo")
          .toError(() => ({
            code: "CUSTOM_FOO" as const,
            message: "Foo error",
            meta: { fooId: 123 },
          })),
        errorRule
          .when((e): e is "bar" => e === "bar")
          .toError(() => ({
            code: "CUSTOM_BAR" as const,
            message: "Bar error",
            meta: { barData: "test" },
          })),
      ],
    });

    const result = await runner.run(async () => {
      throw "foo";
    });

    if (!result.ok) {
      if (result.error.code === "CUSTOM_FOO") {
        // Should compile without error and infer meta
        // meta is optional, so we need to check it
        if (result.error.meta) {
          const val: number = result.error.meta.fooId;
          expect(val).toBe(123);
        }
        // @ts-expect-error - barData should not exist on CUSTOM_FOO
        result.error.meta?.barData;
      } else if (result.error.code === "CUSTOM_BAR") {
        if (result.error.meta) {
          const val: string = result.error.meta.barData;
          expect(val).toBe("test");
        }
      }
    }
  });

  it("preserves standard error codes", async () => {
    const runner = trybox();
    const result = await runner.run(async () => {
      throw new Error("fail");
    });
    if (!result.ok) {
      // Should allow checking standard codes
      if (result.error.code === "UNKNOWN") {
        expect(result.error.message).toBe("fail");
      }
    }
  });

  it("infers types in runAll", async () => {
    const runner = trybox({
      rules: [
        errorRule
          .when((e): e is "foo" => e === "foo")
          .toError(() => ({
            code: "CUSTOM_FOO" as const,
            message: "Foo error",
            meta: { fooId: 123 },
          })),
      ],
    });

    const results = await runner.all([
      async () => {
        throw "foo";
      },
    ]);
    const first = results[0];

    if (first && first.status === "error") {
      if (first.error.code === "CUSTOM_FOO") {
        if (first.error.meta) {
          expect(first.error.meta.fooId).toBe(123);
        }
      }
    }
  });

  it("supports rulesMode='replace' to exclude default rules", async () => {
    const runner = trybox({
      rules: [
        errorRule
          .when((e): e is "foo" => e === "foo")
          .toError(() => ({
            code: "CUSTOM_FOO",
            message: "Foo",
          })),
      ],
      rulesMode: "replace",
    });

    // Should handle custom error
    const resultFoo = await runner.run(async () => {
      throw "foo";
    });
    if (!resultFoo.ok) {
      expect(resultFoo.error.code).toBe("CUSTOM_FOO");
    }

    // Should NOT handle timeout (default rule) -> falls back to UNKNOWN
    const resultTimeout = await runner.run(async () => {
      const err = new Error("timeout");
      err.name = "TimeoutError";
      throw err;
    });

    if (!resultTimeout.ok) {
      expect(resultTimeout.error.code).toBe("UNKNOWN");
      // If it was extended, it would be "TIMEOUT"
    }
  });

  it("supports rulesMode='extend' (default) to include default rules", async () => {
    const runner = trybox({
      rules: [
        errorRule
          .when((e): e is "foo" => e === "foo")
          .toError(() => ({
            code: "CUSTOM_FOO",
            message: "Foo",
          })),
      ],
      // rulesMode: "extend" is default
    });

    // Should handle custom error
    const resultFoo = await runner.run(async () => {
      throw "foo";
    });
    if (!resultFoo.ok) {
      expect(resultFoo.error.code).toBe("CUSTOM_FOO");
    }

    // Should handle timeout (default rule)
    const resultTimeout = await runner.run(async () => {
      const err = new Error("timeout");
      err.name = "TimeoutError";
      throw err;
    });

    if (!resultTimeout.ok) {
      expect(resultTimeout.error.code as string).toBe("TIMEOUT");
    }
  });
});
