import type { AppError, Rule } from "./types";

class ErrorRuleBuilder<E> {
  constructor(private readonly matcher: (err: unknown) => err is E) {}

  toError<const Out extends AppError>(mapper: (err: E) => Out): Rule<Out> {
    return (err: unknown) => {
      if (!this.matcher(err)) return null;
      return mapper(err);
    };
  }
}

export const errorRule = {
  instance<E extends new (...args: any[]) => any>(ctor: E) {
    return new ErrorRuleBuilder<InstanceType<E>>(
      (err): err is InstanceType<E> => err instanceof ctor
    );
  },

  when<E = unknown>(predicate: (err: unknown) => err is E) {
    return new ErrorRuleBuilder<E>(predicate);
  },
};
