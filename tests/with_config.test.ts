import { describe, expect, it } from 'bun:test';

import { Executor } from '../src/core/executor';
import { errorRule } from '../src/error/error-rules';

describe('Executor.withConfig', () => {
	it('preserves existing error normalization by default', async () => {
		const ex = new Executor({
			rules: [
				errorRule
					.when((e): e is 'custom' => e === 'custom')
					.toError(() => ({
						code: 'CUSTOM_ERROR' as const,
						message: 'Custom error',
					})),
			],
		});

		const derived = ex.withConfig({ timeout: 1 });
		const r = await derived.execute(async () => {
			throw 'custom';
		});

		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.error.code).toBe('CUSTOM_ERROR');
		}
	});
});
