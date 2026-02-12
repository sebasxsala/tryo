import { describe, expect, it } from 'bun:test';
import type { TryoOptions } from '../src/core/tryo';
import { tryo } from '../src/core/tryo';
import { errorRule } from '../src/error/error-rules';
import { sleep } from '../src/utils/timing';

describe('rulesMode default behavior', () => {
	it('extends default rules when rulesMode is undefined (default)', async () => {
		const ex = tryo({
			rules: [
				errorRule
					.when((e): e is 'custom' => e === 'custom')
					.toError(() => ({
						code: 'CUSTOM_ERROR' as const,
						message: 'Custom error',
					})),
			],
			// rulesMode is undefined, should default to "extend"
		} as TryoOptions);

		// 1. Check custom rule
		const resultCustom = await ex.run(async () => {
			throw 'custom';
		});
		expect(resultCustom.ok).toBe(false);
		if (!resultCustom.ok) {
			expect(resultCustom.error.code).toBe('CUSTOM_ERROR');
		}

		// 2. Check default rule (e.g. Timeout)
		const resultTimeout = await ex.run(
			async () => {
				await sleep(50);
				return 'done';
			},
			{ timeout: 10 },
		);

		// If default rules are present, it should be TIMEOUT.
		// If they were replaced, it would be UNKNOWN (or fallback).
		expect(resultTimeout.ok).toBe(false);
		if (!resultTimeout.ok) {
			// NOTE: run() internal logic throws a special timeout error that matches default rules.
			expect(resultTimeout.error.code).toBe('TIMEOUT');
		}
	});

	it("replaces default rules when rulesMode is 'replace'", async () => {
		const ex = tryo({
			rules: [
				errorRule
					.when((e): e is 'custom' => e === 'custom')
					.toError(() => ({
						code: 'CUSTOM_ERROR' as const,
						message: 'Custom error',
					})),
			],
			rulesMode: 'replace',
		} as TryoOptions);

		// 1. Check custom rule
		const resultCustom = await ex.run(async () => {
			throw 'custom';
		});
		expect(resultCustom.ok).toBe(false);
		if (!resultCustom.ok) {
			expect(resultCustom.error.code).toBe('CUSTOM_ERROR');
		}

		// 2. Check default rule behavior (should fail to match TIMEOUT and go to UNKNOWN)
		// We simulate a timeout error object manually to test the mapping,
		// because run({timeout}) might generate an error that we can't easily inspect if it's internal.
		// However, the default rules check for error.name === 'TimeoutError' usually.

		const resultTimeout = await ex.run(async () => {
			const e = new Error('timeout');
			e.name = 'TimeoutError';
			throw e;
		});

		expect(resultTimeout.ok).toBe(false);
		if (!resultTimeout.ok) {
			expect(resultTimeout.error.code).toBe('UNKNOWN');
		}
	});
});
