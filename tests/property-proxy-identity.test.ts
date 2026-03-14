import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fc from 'fast-check'
import { effect, state } from '../src/index.ts'

/**
 * Property-based tests for proxy identity invariants.
 *
 * Beacon's state() uses a proxyCache WeakMap and a [PROXY] symbol check
 * to guarantee:
 *   1. state(obj) === state(obj)  — idempotent wrapping via proxyCache
 *   2. state(state(obj)) === state(obj)  — already-proxied returned as-is
 *
 * These tests exercise those invariants with diverse object shapes:
 * empty objects, deeply nested, arrays-as-values, mixed types, etc.
 *
 * @see tests/PROPERTY_BASED_TESTING.md — Opportunity #5
 */

// --- Arbitraries ---

// Leaf values that can appear inside generated objects
const leafArb: fc.Arbitrary<boolean | number | string | null> = fc.oneof(
	fc.integer(),
	fc.double({
		noNaN: true,
	}),
	fc.string(),
	fc.boolean(),
	fc.constant(null)
)

// Shallow plain object with string keys and leaf values
const shallowObjArb: fc.Arbitrary<Record<string, boolean | number | string | null>> = fc.dictionary(
	fc.string({
		maxLength: 10,
		minLength: 1,
	}),
	leafArb,
	{
		maxKeys: 8,
	}
)

// Object containing an array property
const arrayValueObjArb: fc.Arbitrary<{
	items: (boolean | number | string | null)[]
}> = fc.record({
	items: fc.array(leafArb, {
		maxLength: 10,
	}),
})

// Nested object (depth 2)
const nestedObjArb: fc.Arbitrary<Record<string, Record<string, boolean | number | string | null>>> = fc.dictionary(
	fc.string({
		maxLength: 8,
		minLength: 1,
	}),
	fc.dictionary(
		fc.string({
			maxLength: 8,
			minLength: 1,
		}),
		leafArb,
		{
			maxKeys: 4,
		}
	),
	{
		maxKeys: 4,
	}
)

// Union of all object shapes
const anyObjArb: fc.Arbitrary<object> = fc.oneof(
	shallowObjArb as fc.Arbitrary<object>,
	arrayValueObjArb as fc.Arbitrary<object>,
	nestedObjArb as fc.Arbitrary<object>,
	fc.constant({} as object),
	fc.array(leafArb, {
		maxLength: 10,
	}) as fc.Arbitrary<object>
)

// --- Tests ---

describe('Property-Based: Proxy Identity', {
	concurrency: true,
	timeout: 30000,
}, (): void => {
	it('state(obj) === state(obj) for any object shape', (): void => {
		fc.assert(
			fc.property(anyObjArb, (obj: object): void => {
				const $first = state(obj)
				const $second = state(obj)

				assert.strictEqual($first, $second)
			}),
			{
				numRuns: 300,
			}
		)
	})

	it('state(state(obj)) === state(obj) for any object shape', (): void => {
		fc.assert(
			fc.property(anyObjArb, (obj: object): void => {
				const $proxy = state(obj)
				const $double = state($proxy)

				assert.strictEqual($double, $proxy)
			}),
			{
				numRuns: 300,
			}
		)
	})

	it('proxy identity holds after mutations', (): void => {
		fc.assert(
			fc.property(
				shallowObjArb,
				fc.string({
					maxLength: 10,
					minLength: 1,
				}),
				fc.integer(),
				(obj: Record<string, boolean | number | string | null>, key: string, value: number): void => {
					const $proxy = state(obj)

					// Mutate through proxy
					;($proxy as Record<string, unknown>)[key] = value

					// Identity still holds
					const $again = state(obj)
					assert.strictEqual($again, $proxy)

					const $double = state($proxy)
					assert.strictEqual($double, $proxy)
				}
			),
			{
				numRuns: 300,
			}
		)
	})

	it('distinct objects always produce distinct proxies', (): void => {
		fc.assert(
			fc.property(anyObjArb, anyObjArb, (a: object, b: object): void => {
				// fast-check generates new object instances per run,
				// so a and b are always distinct references
				fc.pre(a !== b)

				const $a = state(a)
				const $b = state(b)

				assert.notStrictEqual($a, $b)
			}),
			{
				numRuns: 300,
			}
		)
	})

	it('proxy is reactive for any object shape', (): void => {
		fc.assert(
			fc.property(
				shallowObjArb,
				fc.string({
					maxLength: 10,
					minLength: 1,
				}),
				fc.integer(),
				(obj: Record<string, boolean | number | string | null>, key: string, value: number): void => {
					const $proxy = state(obj)
					let runs = 0

					const dispose = effect((): void => {
						runs++
						;($proxy as Record<string, unknown>)[key]
					})

					runs = 0
					const oldValue = obj[key]
					;($proxy as Record<string, unknown>)[key] = value

					const shouldTrigger = !Object.is(oldValue, value)

					if (shouldTrigger) {
						assert.strictEqual(runs, 1)
					} else {
						assert.strictEqual(runs, 0)
					}

					dispose()
				}
			),
			{
				numRuns: 300,
			}
		)
	})

	it('arrays wrapped via state preserve proxy identity', (): void => {
		fc.assert(
			fc.property(
				fc.array(leafArb, {
					maxLength: 15,
				}),
				(arr: (boolean | number | string | null)[]): void => {
					const $first = state(arr)
					const $second = state(arr)
					const $double = state($first)

					assert.strictEqual($first, $second)
					assert.strictEqual($double, $first)
				}
			),
			{
				numRuns: 300,
			}
		)
	})
})
