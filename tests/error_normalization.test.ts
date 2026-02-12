import { describe, expect, it } from 'bun:test';

import { tryo } from '../src/core/tryo';
import { HttpError, TypedError } from '../src/error/typed-error';

describe('Error normalization', () => {
	it('preserves thrown TypedError instances', async () => {
		class MyTypedError extends TypedError<'MY_CODE', { foo: string }> {
			readonly code = 'MY_CODE' as const;
			constructor() {
				super('boom', { meta: { foo: 'bar' } });
			}
		}

		const ex = tryo();
		const r = await ex.run(async () => {
			throw new MyTypedError();
		});

		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.error.code).toBe('MY_CODE');
			expect(r.error.message).toBe('boom');
			expect(r.error.meta).toEqual({ foo: 'bar' });
		}
	});

	it('keeps HttpError code and status', async () => {
		const ex = tryo();
		const r = await ex.run(async () => {
			throw new HttpError('bad', 500);
		});

		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.error.code).toBe('HTTP');
			expect(r.error.status).toBe(500);
		}
	});

	it('maps plain { status } objects to HTTP when status >= 400', async () => {
		const ex = tryo();
		const r = await ex.run(async () => {
			throw { status: 500, message: 'server' };
		});

		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.error.code).toBe('HTTP');
			expect(r.error.status).toBe(500);
		}
	});
});
