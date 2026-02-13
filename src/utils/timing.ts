/**
 * Modern utility functions for timing and common operations
 * Provides enhanced utilities with type safety
 */

import type { Milliseconds } from '../types/branded-types'

// Enhanced sleep function with cancellation support
export const sleep = (
	ms: number | Milliseconds,
	signal?: AbortSignal,
): Promise<void> => {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new DOMException('Aborted', 'AbortError'))
			return
		}

		const cleanup = (onAbort?: () => void) => {
			if (signal && onAbort) {
				signal.removeEventListener('abort', onAbort)
			}
		}

		let timeoutId: ReturnType<typeof setTimeout> | undefined
		const onAbort = () => {
			if (timeoutId) clearTimeout(timeoutId)
			cleanup(onAbort)
			reject(new DOMException('Aborted', 'AbortError'))
		}

		timeoutId = setTimeout(() => {
			cleanup(onAbort)
			resolve()
		}, ms as number)

		signal?.addEventListener('abort', onAbort, { once: true })
	})
}

// Enhanced timeout with promise race
export const withTimeout = <T>(
	promise: Promise<T>,
	timeoutMs: number,
	signal?: AbortSignal,
	onTimeout?: () => unknown,
): Promise<T> => {
	return new Promise<T>((resolve, reject) => {
		if (signal?.aborted) {
			reject(new DOMException('Aborted', 'AbortError'))
			return
		}

		let settled = false
		const timeoutId = setTimeout(() => {
			settled = true
			cleanup()
			reject(
				onTimeout?.() ?? new Error(`Operation timed out after ${timeoutMs}ms`),
			)
		}, timeoutMs)

		const onAbort = () => {
			if (settled) return
			settled = true
			cleanup()
			reject(new DOMException('Aborted', 'AbortError'))
		}

		const cleanup = () => {
			clearTimeout(timeoutId)
			signal?.removeEventListener('abort', onAbort)
		}

		signal?.addEventListener('abort', onAbort, { once: true })

		promise.then(
			(value) => {
				if (settled) return
				settled = true
				cleanup()
				resolve(value)
			},
			(error) => {
				if (settled) return
				settled = true
				cleanup()
				reject(error)
			},
		)
	})
}
