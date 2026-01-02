import { describe, it, expect } from "bun:test";
import { createRunner } from "../src/runner/runner";
import { rules } from "../src/error/core";
import { errorRule } from "../src/error/builder";

describe("Runner", () => {
  describe("Basic Usage (No Rules)", () => {
    const runner = createRunner();

    it("should return data on success", async () => {
      const result = await runner.run(async () => "success");
      expect(result.data).toBe("success");
      expect(result.error).toBeNull();
    });

    it("should return default error on failure", async () => {
      const error = new Error("fail");
      const result = await runner.run(async () => {
        throw error;
      });
      expect(result.data).toBeNull();
      expect(result.error).toEqual({
        code: "UNKNOWN",
        message: "fail",
        cause: error,
      });
    });
  });

  describe("Core Rules", () => {
    it("should handle AbortError", async () => {
      const runner = createRunner({ rules: [rules.abort] });
      const abortError = new Error("AbortError");
      abortError.name = "AbortError";

      const result = await runner.run(async () => {
        throw abortError;
      });

      expect(result.error?.code).toBe("ABORTED");
      expect(result.error?.message).toBe("AbortError");
    });

    it("should handle TimeoutError", async () => {
      const runner = createRunner({ rules: [rules.timeout] });
      const timeoutError = new Error("TimeoutError");
      timeoutError.name = "TimeoutError";

      const result = await runner.run(async () => {
        throw timeoutError;
      });

      expect(result.error?.code).toBe("TIMEOUT");
    });

    it("should handle HttpStatus", async () => {
      const runner = createRunner({ rules: [rules.httpStatus] });
      const httpError = { status: 404, message: "Not Found" };

      const result = await runner.run(async () => {
        throw httpError;
      });

      expect(result.error?.code).toBe("HTTP");
      expect(result.error?.status).toBe(404);
    });

    it("should infer types correctly for mixed rules", async () => {
      const runner = createRunner({
        rules: [rules.abort, rules.timeout],
      });

      await runner.run(
        async () => {
          throw new Error("fail");
        },
        {
          onError: (e) => {
            // Type assertion to verify inference
            const code: "ABORTED" | "TIMEOUT" | "UNKNOWN" = e.code;
            expect(code).toBe("UNKNOWN");
          },
        }
      );
    });
  });

  describe("Custom Rules", () => {
    class CustomError extends Error {
      customCode = 123;
    }

    it("should handle custom class errors", async () => {
      const runner = createRunner({
        rules: [
          errorRule.instance(CustomError).toError((e) => ({
            code: "CUSTOM",
            message: e.message,
            meta: { code: e.customCode },
          })),
        ],
      });

      const result = await runner.run(async () => {
        throw new CustomError("custom fail");
      });

      expect(result.error?.code).toBe("CUSTOM");
      expect(result.error?.meta).toEqual({ code: 123 });

      // Type check
      if (result.error?.code === "CUSTOM") {
        const meta = result.error.meta;
        // @ts-ignore
        const invalid = meta.invalidProp;
      }
    });
  });

  describe("Methods", () => {
    const runner = createRunner();

    it("should handle runAll success", async () => {
      const results = await runner.all([async () => 1, async () => 2]);

      expect(results).toHaveLength(2);
      expect(results[0]!.data).toBe(1);
      expect(results[1]!.data).toBe(2);
    });

    it("should handle runAll mixed results", async () => {
      const results = await runner.all([
        async () => 1,
        async () => {
          throw new Error("fail");
        },
      ]);

      expect(results[0]!.data).toBe(1);
      expect(results[1]!.error?.code).toBe("UNKNOWN");
    });

    it("should handle runAllOrThrow success", async () => {
      const results = await runner.allOrThrow([async () => 1, async () => 2]);
      expect(results).toEqual([1, 2]);
    });

    it("should handle runAllOrThrow failure", async () => {
      try {
        await runner.allOrThrow([
          async () => 1,
          async () => {
            throw new Error("fail");
          },
        ]);
      } catch (e: any) {
        expect(e.code).toBe("UNKNOWN");
      }
    });

    it("should handle concurrency and fail-fast in runAll", async () => {
      const tasks = [
        async () => {
          await new Promise((r) => setTimeout(r, 10));
          return 1;
        },
        async () => {
          await new Promise((r) => setTimeout(r, 10));
          throw new Error("fail");
        },
        async () => {
          await new Promise((r) => setTimeout(r, 10));
          return 3;
        },
        async () => {
          await new Promise((r) => setTimeout(r, 10));
          return 4;
        },
      ];

      // Fail fast with concurrency 1
      const results = await runner.all(tasks, {
        concurrency: 1,
        mode: "fail-fast",
      });

      // 0 ok, 1 fail, 2 skipped, 3 skipped
      expect(results[0]?.ok).toBe(true);
      expect(results[1]?.ok).toBe(false);
      expect(results[2]?.status).toBe("skipped");
      expect(results[3]?.status).toBe("skipped");
    });
  });

  describe("Hooks", () => {
    const runner = createRunner();

    it("should trigger onSuccess", async () => {
      let called = false;
      await runner.run(async () => "ok", {
        onSuccess: (data) => {
          called = true;
          expect(data).toBe("ok");
        },
      });
      expect(called).toBe(true);
    });

    it("should trigger onError", async () => {
      let called = false;
      await runner.run(
        async () => {
          throw new Error("fail");
        },
        {
          onError: (err) => {
            called = true;
            expect(err.code).toBe("UNKNOWN");
          },
        }
      );
      expect(called).toBe(true);
    });

    it("should trigger onFinally", async () => {
      let called = false;
      await runner.run(async () => "ok", {
        onFinally: () => {
          called = true;
        },
      });
      expect(called).toBe(true);
    });
  });
});
