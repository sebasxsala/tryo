/**
 * Public API
 *
 * Default export is the tryo factory.
 */

export {
	all,
	allOrThrow,
	orThrow,
	run,
	runOrThrow,
} from './core/default'
export {
	type RulesMode,
	type TryoOptions,
	tryo,
	tryo as default,
} from './core/tryo'
export { errorRule } from './error/error-rules'
export { TypedError } from './error/typed-error'
export { RetryStrategies } from './retry/retry-strategies'
export type {
	Milliseconds,
	RetryCount,
} from './types/branded-types'
export {
	asMilliseconds,
	asRetryCount,
} from './types/branded-types'
export type { TryoConfig } from './types/config-types'
export type {
	AbortedResult,
	FailureResult,
	SuccessResult,
	TimeoutResult,
	TryoMetrics,
	TryoResult,
} from './types/result-types'
