/**
 * Modern circuit breaker implementation with enhanced state management
 * Provides circuit breaker pattern with type safety and observability
 */

import { type AnyTypedError, CircuitOpenError } from '../error/typed-error'
import {
	asMilliseconds,
	asRetryCount,
	type Milliseconds,
	type RetryCount,
} from '../types/branded-types'

// Circuit breaker configuration
export interface CircuitBreakerConfig<E extends AnyTypedError = AnyTypedError> {
	/** Number of consecutive failures before opening circuit */
	readonly failureThreshold: number

	/** How long to wait before attempting to close circuit */
	readonly resetTimeout: number

	/** Number of requests allowed in half-open state */
	readonly halfOpenRequests: number

	/** Optional function to determine if error should count as failure */
	readonly shouldCountAsFailure?: (error: E) => boolean
}

// Circuit breaker state
export type CircuitState = 'closed' | 'open' | 'half-open'

// Internal state tracking
interface CircuitBreakerInternalState {
	readonly state: CircuitState
	readonly failureCount: RetryCount
	readonly halfOpenCount: RetryCount
	readonly lastFailureTime?: Date
	readonly nextAttemptTime?: Date
}

// Modern circuit breaker implementation
export class CircuitBreaker<E extends AnyTypedError = AnyTypedError> {
	private state: CircuitBreakerInternalState
	private readonly config: {
		failureThreshold: RetryCount
		resetTimeout: Milliseconds
		halfOpenRequests: RetryCount
		shouldCountAsFailure?: (error: E) => boolean
	}

	constructor(config: CircuitBreakerConfig<E>) {
		this.config = {
			failureThreshold: asRetryCount(config.failureThreshold),
			resetTimeout: asMilliseconds(config.resetTimeout),
			halfOpenRequests: asRetryCount(config.halfOpenRequests),
			shouldCountAsFailure: config.shouldCountAsFailure,
		}
		this.state = {
			state: 'closed',
			failureCount: 0 as RetryCount,
			halfOpenCount: 0 as RetryCount,
		}
	}

	// Check if execution is allowed
	async canExecute(): Promise<boolean> {
		this.updateStateIfNeeded()
		if (this.state.state === 'open') {
			return false
		}
		if (this.state.state === 'half-open') {
			if (this.state.halfOpenCount >= this.config.halfOpenRequests) {
				return false
			}
			this.state = {
				...this.state,
				halfOpenCount: (this.state.halfOpenCount + 1) as RetryCount,
			}
		}
		return true
	}

	// Record successful execution
	async recordSuccess(): Promise<void> {
		switch (this.state.state) {
			case 'closed':
				// Reset failure count on success
				this.state = {
					...this.state,
					failureCount: 0 as RetryCount,
				}
				break

			case 'half-open':
				// Close circuit on first success in half-open
				this.state = {
					state: 'closed',
					failureCount: 0 as RetryCount,
					halfOpenCount: 0 as RetryCount,
				}
				break

			case 'open':
				// Should not happen, but handle gracefully
				break
		}
	}

	// Record failed execution
	async recordFailure(error: E): Promise<void> {
		const shouldCount = this.config.shouldCountAsFailure?.(error) ?? true

		if (!shouldCount) {
			return
		}

		const now = new Date()

		switch (this.state.state) {
			case 'closed': {
				const newFailureCount = (this.state.failureCount + 1) as RetryCount

				if (newFailureCount >= this.config.failureThreshold) {
					// Open circuit
					this.state = {
						state: 'open',
						failureCount: newFailureCount,
						halfOpenCount: 0 as RetryCount,
						lastFailureTime: now,
						nextAttemptTime: new Date(now.getTime() + this.config.resetTimeout),
					}
				} else {
					// Increment failure count
					this.state = {
						...this.state,
						failureCount: newFailureCount,
						lastFailureTime: now,
					}
				}
				break
			}

			case 'half-open':
				// Open circuit immediately on failure in half-open
				this.state = {
					state: 'open',
					failureCount: (this.state.failureCount + 1) as RetryCount,
					halfOpenCount: 0 as RetryCount,
					lastFailureTime: now,
					nextAttemptTime: new Date(now.getTime() + this.config.resetTimeout),
				}
				break

			case 'open':
				// Already open, just update failure time
				this.state = {
					...this.state,
					lastFailureTime: now,
					nextAttemptTime: new Date(now.getTime() + this.config.resetTimeout),
				}
				break
		}
	}

	// Get current circuit state
	getState(): CircuitBreakerState {
		this.updateStateIfNeeded()
		return {
			...this.state,
			canExecute: this.state.state !== 'open',
		}
	}

	// Create error for when circuit is open
	createOpenError(): CircuitOpenError {
		const resetAfter = this.state.nextAttemptTime
			? asMilliseconds(
					Math.max(0, this.state.nextAttemptTime.getTime() - Date.now()),
				)
			: this.config.resetTimeout

		return new CircuitOpenError(resetAfter)
	}

	// Force circuit to specific state (for testing/maintenance)
	forceState(state: CircuitState): void {
		this.state = {
			state,
			failureCount: 0 as RetryCount,
			halfOpenCount: 0 as RetryCount,
		}
	}

	// Reset circuit to closed state
	reset(): void {
		this.state = {
			state: 'closed',
			failureCount: 0 as RetryCount,
			halfOpenCount: 0 as RetryCount,
		}
	}

	// Update state based on time
	private updateStateIfNeeded(): void {
		if (this.state.state === 'open' && this.state.nextAttemptTime) {
			const now = new Date()
			if (now >= this.state.nextAttemptTime) {
				// Move to half-open state
				this.state = {
					...this.state,
					state: 'half-open',
					halfOpenCount: 0 as RetryCount,
				}
			}
		}
	}
}

// Circuit breaker state information
export interface CircuitBreakerState {
	readonly state: CircuitState
	readonly failureCount: RetryCount
	readonly halfOpenCount: RetryCount
	readonly lastFailureTime?: Date
	readonly nextAttemptTime?: Date
	readonly canExecute: boolean
}
