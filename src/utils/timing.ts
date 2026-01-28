/**
 * Modern utility functions for timing and common operations
 * Provides enhanced utilities with type safety
 */

import type { Milliseconds } from '../types/branded-types';

// Enhanced sleep function with cancellation support
export const sleep = (
	ms: number | Milliseconds,
	signal?: AbortSignal,
): Promise<void> => {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new DOMException('Aborted', 'AbortError'));
			return;
		}

		const cleanup = (onAbort?: () => void) => {
			if (signal && onAbort) {
				signal.removeEventListener('abort', onAbort);
			}
		};

		let timeoutId: ReturnType<typeof setTimeout> | undefined;
		const onAbort = () => {
			if (timeoutId) clearTimeout(timeoutId);
			cleanup(onAbort);
			reject(new DOMException('Aborted', 'AbortError'));
		};

		timeoutId = setTimeout(() => {
			cleanup(onAbort);
			resolve();
		}, ms as number);

		signal?.addEventListener('abort', onAbort, { once: true });
	});
};

// Enhanced timeout with promise race
export const withTimeout = <T>(
	promise: Promise<T>,
	timeoutMs: number,
	signal?: AbortSignal,
): Promise<T> => {
	return new Promise<T>((resolve, reject) => {
		if (signal?.aborted) {
			reject(new DOMException('Aborted', 'AbortError'));
			return;
		}

		let settled = false;
		const timeoutId = setTimeout(() => {
			settled = true;
			cleanup();
			reject(new Error(`Operation timed out after ${timeoutMs}ms`));
		}, timeoutMs);

		const onAbort = () => {
			if (settled) return;
			settled = true;
			cleanup();
			reject(new DOMException('Aborted', 'AbortError'));
		};

		const cleanup = () => {
			clearTimeout(timeoutId);
			signal?.removeEventListener('abort', onAbort);
		};

		signal?.addEventListener('abort', onAbort, { once: true });

		promise.then(
			(value) => {
				if (settled) return;
				settled = true;
				cleanup();
				resolve(value);
			},
			(error) => {
				if (settled) return;
				settled = true;
				cleanup();
				reject(error);
			},
		);
	});
};

// Debounce function with type safety
export const debounce = <T extends (...args: unknown[]) => unknown>(
	func: T,
	delay: Milliseconds,
): T => {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	return ((...args: Parameters<T>) => {
		if (timeoutId !== null) {
			clearTimeout(timeoutId);
		}

		timeoutId = setTimeout(() => {
			func(...args);
			timeoutId = null;
		}, delay);
	}) as T;
};

// Throttle function with type safety
export const throttle = <T extends (...args: unknown[]) => unknown>(
	func: T,
	delay: Milliseconds,
): T => {
	let lastCallTime = 0;
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	return ((...args: Parameters<T>) => {
		const now = Date.now();

		if (now - lastCallTime >= delay) {
			lastCallTime = now;
			func(...args);
		} else if (timeoutId === null) {
			timeoutId = setTimeout(
				() => {
					lastCallTime = Date.now();
					func(...args);
					timeoutId = null;
				},
				delay - (now - lastCallTime),
			);
		}
	}) as T;
};

// Retry with exponential backoff
export const retry = async <T>(
	operation: () => Promise<T>,
	maxRetries: number,
	baseDelay: Milliseconds,
	backoffFactor: number = 2,
): Promise<T> => {
	let lastError: Error | undefined;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await operation();
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			if (attempt === maxRetries) {
				throw lastError;
			}

			const delay = baseDelay * backoffFactor ** attempt;
			await sleep(delay as Milliseconds);
		}
	}

	throw lastError ?? new Error('Operation failed after retries');
};

// Measure execution time
export const measureTime = async <T>(
	operation: () => Promise<T>,
): Promise<{ result: T; duration: Milliseconds }> => {
	const start = Date.now();
	const result = await operation();
	const duration = (Date.now() - start) as Milliseconds;

	return { result, duration };
};

// Create a promise with external resolve/reject
export const createDeferred = <T = void>(): {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (reason?: unknown) => void;
} => {
	let resolve: ((value: T) => void) | undefined;
	let reject: ((reason?: unknown) => void) | undefined;

	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});

	if (!resolve || !reject) {
		throw new Error('Promise executor did not initialize resolve/reject');
	}

	return { promise, resolve, reject };
};

// Safe JSON parsing with error handling
export const safeJsonParse = <T = unknown>(
	text: string,
	fallback?: T,
): T | null => {
	try {
		return JSON.parse(text) as T;
	} catch {
		return fallback ?? null;
	}
};

// Safe JSON stringify with error handling
export const safeJsonStringify = (
	value: unknown,
	fallback?: string,
): string | null => {
	try {
		return JSON.stringify(value);
	} catch {
		return fallback ?? null;
	}
};
