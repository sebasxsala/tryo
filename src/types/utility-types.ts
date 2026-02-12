/**
 * Utility types for enhanced type safety and ergonomics
 * Provides helper types for common patterns
 */

import type { TypedError } from '../error/typed-error';
import type { TryoResult } from './result-types';

// Extract success type from result
export type ExtractSuccess<T> =
	T extends TryoResult<infer U, TypedError> ? U : never;

// Extract error type from result
export type ExtractError<T> =
	T extends TryoResult<unknown, infer E> ? E : never;

// Conditional type for async functions
export type AsyncFunction<T extends unknown[], R> = (...args: T) => Promise<R>;

// Extract parameters from function
export type Params<T> = T extends (...args: infer P) => unknown ? P : never;

// Extract return type from function
export type Return<T> = T extends (...args: unknown[]) => infer R ? R : never;

// Make all properties readonly deeply
export type DeepReadonly<T> = {
	readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

// Make all properties optional deeply
export type DeepPartial<T> = {
	[P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Union to intersection
export type UnionToIntersection<U> = (
	U extends unknown
		? (k: U) => void
		: never
) extends (k: infer I) => void
	? I
	: never;

// Awaited type (built-in for older TypeScript versions)
export type Awaited<T> = T extends PromiseLike<infer U> ? Awaited<U> : T;

// Error type inference helper
export type InferErrorType<T> = T extends (
	...args: unknown[]
) => Promise<TryoResult<unknown, infer E>>
	? E
	: TypedError;

// Discriminated union helpers
export type DiscriminateBy<T, K extends keyof T, V extends T[K]> = Extract<
	T,
	Record<K, V>
>;

// Branded type helpers
export type Brand<T, B> = T & { readonly __brand: B };
export type Unbrand<T> = T & { readonly __brand?: never };

// Type guards
export const isObject = (value: unknown): value is object =>
	value !== null && typeof value === 'object';

export const isFunction = (
	value: unknown,
): value is (...args: never[]) => unknown => typeof value === 'function';

export const isPromise = <T>(value: unknown): value is Promise<T> =>
	value instanceof Promise ||
	(typeof value === 'object' && value !== null && 'then' in value);

// Type-safe assertion helper
export const assertType = <T>(
	value: unknown,
	predicate: (value: unknown) => value is T,
): T => {
	if (!predicate(value)) {
		throw new Error('Type assertion failed');
	}
	return value;
};

// Safe type cast with runtime check
export const safeCast = <T>(value: unknown, fallback: T): T => {
	return (value as T) ?? fallback;
};

// Type-safe key extraction
export const keysOf = <T extends object>(obj: T): Array<keyof T> => {
	return Object.keys(obj) as Array<keyof T>;
};

// Type-safe value extraction
export const valuesOf = <T extends object>(obj: T): Array<T[keyof T]> => {
	return Object.values(obj) as Array<T[keyof T]>;
};

// Type-safe entries extraction
export const entriesOf = <T extends object>(
	obj: T,
): [keyof T, T[keyof T]][] => {
	return Object.entries(obj) as [keyof T, T[keyof T]][];
};
