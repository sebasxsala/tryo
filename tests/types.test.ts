import { describe, expect, it } from 'bun:test';
import { createExecutor } from '../src/core/executor';
import { errorRule } from '../src/error/error-rules';

describe('Type inference', () => {
	it('infers custom error codes from rules and narrows meta type', async () => {
		const ex = createExecutor({
			rules: [
				errorRule
					.when((e): e is 'foo' => e === 'foo')
					.toError(() => ({
						code: 'CUSTOM_FOO' as const,
						message: 'Foo error',
						meta: { fooId: 123 },
					})),
				errorRule
					.when((e): e is 'bar' => e === 'bar')
					.toError(() => ({
						code: 'CUSTOM_BAR' as const,
						message: 'Bar error',
						meta: { barData: 'test' },
					})),
			] as const,
		});

		const result = await ex.execute(async () => {
			throw 'foo';
		});

		if (!result.ok) {
			if (result.error.code === 'CUSTOM_FOO') {
				// Should compile without error and infer meta
				// meta is optional, so we need to check it
				if (result.error.meta) {
					const val: number = result.error.meta.fooId;
					expect(val).toBe(123);
				}
				// @ts-expect-error - barData should not exist on CUSTOM_FOO
				result.error.meta?.barData;
			} else if (result.error.code === 'CUSTOM_BAR') {
				if (result.error.meta) {
					const val: string = result.error.meta.barData;
					expect(val).toBe('test');
				}
			}
		}
	});

	it('preserves standard error codes', async () => {
		const ex = createExecutor();
		const result = await ex.execute(async () => {
			throw new Error('fail');
		});
		if (!result.ok) {
			// Should allow checking standard codes
			if (result.error.code === 'UNKNOWN') {
				expect(result.error.message).toBe('fail');
			}
		}
	});

	it('infers types in runAll', async () => {
		const ex = createExecutor({
			rules: [
				errorRule
					.when((e): e is 'foo' => e === 'foo')
					.toError(() => ({
						code: 'CUSTOM_FOO' as const,
						message: 'Foo error',
						meta: { fooId: 123 },
					})),
			] as const,
		});

		const results = await ex.executeAll([
			async () => {
				throw 'foo';
			},
		]);
		const first = results[0];

		if (first && !first.ok && first.error.code === 'CUSTOM_FOO') {
			if (first.error.meta) {
				expect(first.error.meta.fooId).toBe(123);
			}
		}
	});

	it("supports rulesMode='replace' to exclude default rules", async () => {
		const ex = createExecutor({
			rules: [
				errorRule
					.when((e): e is 'foo' => e === 'foo')
					.toError(() => ({
						code: 'CUSTOM_FOO',
						message: 'Foo',
					})),
			] as const,
			rulesMode: 'replace',
		});

		// Should handle custom error
		const resultFoo = await ex.execute(async () => {
			throw 'foo';
		});
		if (!resultFoo.ok) {
			expect(resultFoo.error.code).toBe('CUSTOM_FOO');
		}

		// Should NOT handle timeout (default rule) -> falls back to UNKNOWN
		const resultTimeout = await ex.execute(async () => {
			const err = new Error('timeout');
			err.name = 'TimeoutError';
			throw err;
		});

		if (!resultTimeout.ok) {
			expect(resultTimeout.error.code).toBe('UNKNOWN');
			// If it was extended, it would be "TIMEOUT"
		}
	});

	it("supports rulesMode='extend' (default) to include default rules", async () => {
		const ex = createExecutor({
			rules: [
				errorRule
					.when((e): e is 'foo' => e === 'foo')
					.toError(() => ({
						code: 'CUSTOM_FOO',
						message: 'Foo',
					})),
			] as const,
			// rulesMode: "extend" is default
		});

		// Should handle custom error
		const resultFoo = await ex.execute(async () => {
			throw 'foo';
		});
		if (!resultFoo.ok) {
			expect(resultFoo.error.code).toBe('CUSTOM_FOO');
		}

		// Should handle timeout (default rule)
		const resultTimeout = await ex.execute(async () => {
			const err = new Error('timeout');
			err.name = 'TimeoutError';
			throw err;
		});

		if (!resultTimeout.ok) {
			expect(resultTimeout.error.code as string).toBe('TIMEOUT');
		}
	});

	it('narrows success result types', async () => {
		const ex = createExecutor();

		const r = await ex.execute(async () => ({
			id: 123 as const,
			name: 'alice' as const,
		}));

		expect(r.ok).toBe(true);
		if (r.ok) {
			const id: 123 = r.data.id;
			const name: 'alice' = r.data.name;
			expect(id).toBe(123);
			expect(name).toBe('alice');
		}
	});
});
