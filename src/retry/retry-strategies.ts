/**
 * Modern retry strategies with enhanced capabilities
 * Provides various retry patterns with type safety
 */

import type { RetryCount } from '../types/branded-types'

// Modern retry strategy types
export type RetryStrategy =
	| FixedDelayStrategy
	| ExponentialBackoffStrategy
	| FibonacciBackoffStrategy
	| CustomDelayStrategy

export interface FixedDelayStrategy {
	readonly type: 'fixed'
	readonly delay: number
}

export interface ExponentialBackoffStrategy {
	readonly type: 'exponential'
	readonly base: number
	readonly factor: number
	readonly maxDelay?: number
}

export interface FibonacciBackoffStrategy {
	readonly type: 'fibonacci'
	readonly base: number
	readonly maxDelay?: number
}

export interface CustomDelayStrategy {
	readonly type: 'custom'
	readonly calculate: (attempt: RetryCount, error: unknown) => number
}

// Strategy factory functions
export const RetryStrategies = {
	fixed: (delay: number): FixedDelayStrategy => ({
		type: 'fixed',
		delay,
	}),

	exponential: (
		base: number,
		factor: number = 2,
		maxDelay?: number,
	): ExponentialBackoffStrategy => ({
		type: 'exponential',
		base,
		factor,
		maxDelay,
	}),

	fibonacci: (base: number, maxDelay?: number): FibonacciBackoffStrategy => ({
		type: 'fibonacci',
		base,
		maxDelay,
	}),

	custom: (
		calculate: (attempt: RetryCount, error: unknown) => number,
	): CustomDelayStrategy => ({
		type: 'custom',
		calculate,
	}),
} as const

// Delay calculation functions
export const calculateDelay = (
	strategy: RetryStrategy,
	attempt: RetryCount,
	error: unknown,
): number => {
	switch (strategy.type) {
		case 'fixed': {
			return strategy.delay
		}
		case 'exponential': {
			const expDelay = strategy.base * strategy.factor ** (Number(attempt) - 1)
			return (
				strategy.maxDelay !== undefined
					? Math.min(expDelay, strategy.maxDelay)
					: expDelay
			) as number
		}

		case 'fibonacci': {
			const fibDelay = strategy.base * fibonacci(Number(attempt))
			return (
				strategy.maxDelay !== undefined
					? Math.min(fibDelay, strategy.maxDelay)
					: fibDelay
			) as number
		}

		case 'custom': {
			return strategy.calculate(attempt, error)
		}

		default: {
			const _exhaustive: never = strategy
			return _exhaustive
		}
	}
}

// Fibonacci sequence calculator
const fibonacci = (n: number): number => {
	if (n <= 1) return 1
	let prev = 1
	let curr = 1
	for (let i = 2; i <= n; i++) {
		const next = prev + curr
		prev = curr
		curr = next
	}
	return curr
}

// Utility functions for strategy validation
export const validateStrategy = (strategy: RetryStrategy): void => {
	switch (strategy.type) {
		case 'fixed': {
			if (strategy.delay < 0) {
				throw new Error('Fixed delay must be non-negative')
			}
			break
		}

		case 'exponential':
			if (strategy.base <= 0) {
				throw new Error('Exponential base delay must be positive')
			}
			if (strategy.factor <= 1) {
				throw new Error('Exponential factor must be greater than 1')
			}
			if (strategy.maxDelay !== undefined && strategy.maxDelay <= 0) {
				throw new Error('Exponential max delay must be positive')
			}
			break

		case 'fibonacci':
			if (strategy.base <= 0) {
				throw new Error('Fibonacci base delay must be positive')
			}
			if (strategy.maxDelay !== undefined && strategy.maxDelay <= 0) {
				throw new Error('Fibonacci max delay must be positive')
			}
			break

		case 'custom':
			// Cannot validate custom function at runtime
			break

		default: {
			const _exhaustive: never = strategy
			throw new Error(`Unknown strategy type: ${_exhaustive}`)
		}
	}
}
