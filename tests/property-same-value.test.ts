import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fc from 'fast-check'
import { batch, derive, effect, state } from '../src/index.ts'

/**
 * Property-based tests for same-value optimization.
 *
 * Beacon uses Object.is() internally to skip writes when the new value is
 * identical to the current value. This file verifies that invariant holds
 * across the full primitive type space, including Object.is edge cases
 * like NaN self-equality and -0 vs +0 distinction.
 *
 * @see tests/PROPERTY_BASED_TESTING.md — Opportunity #2
 */

// --- Types ---

type Primitive = boolean | null | number | string | undefined

// --- Arbitraries ---

// Weighted arbitrary that ensures edge cases (NaN, -0, +0, Infinity) are
// generated frequently alongside the full range of primitives.
const primitiveArb: fc.Arbitrary<Primitive> = fc.oneof(
	{
		arbitrary: fc.constant(-0),
		weight: 2,
	},
	{
		arbitrary: fc.constant(0),
		weight: 2,
	},
	{
		arbitrary: fc.constant(Number.NaN),
		weight: 2,
	},
	{
		arbitrary: fc.constant(Number.NEGATIVE_INFINITY),
		weight: 1,
	},
	{
		arbitrary: fc.constant(Number.POSITIVE_INFINITY),
		weight: 1,
	},
	{
		arbitrary: fc.constant(''),
		weight: 1,
	},
	{
		arbitrary: fc.constant(false),
		weight: 1,
	},
	{
		arbitrary: fc.constant(null),
		weight: 1,
	},
	{
		arbitrary: fc.constant(true),
		weight: 1,
	},
	{
		arbitrary: fc.constant(undefined),
		weight: 1,
	},
	{
		arbitrary: fc.boolean(),
		weight: 2,
	},
	{
		arbitrary: fc.double(),
		weight: 5,
	},
	{
		arbitrary: fc.integer(),
		weight: 5,
	},
	{
		arbitrary: fc.string(),
		weight: 3,
	}
)

// --- Tests ---

describe(
	'Property-Based: Same-Value Optimization',
	{
		concurrency: true,
		timeout: 30000,
	},
	(): void => {
		it('never triggers effects when writing the same value', (): void => {
			fc.assert(
				fc.property(primitiveArb, (value: Primitive): void => {
					const $s = state<{
						value: Primitive
					}>({
						value,
					})
					let runs = 0

					const dispose = effect((): void => {
						runs++
						$s.value
					})

					runs = 0
					$s.value = value
					assert.strictEqual(runs, 0)

					dispose()
				}),
				{
					numRuns: 500,
				}
			)
		})

		it('triggers effect if and only if Object.is(old, new) is false', (): void => {
			fc.assert(
				fc.property(primitiveArb, primitiveArb, (initial: Primitive, updated: Primitive): void => {
					const $s = state<{
						value: Primitive
					}>({
						value: initial,
					})
					let runs = 0

					const dispose = effect((): void => {
						runs++
						$s.value
					})

					runs = 0
					$s.value = updated

					const shouldTrigger = !Object.is(initial, updated)
					assert.strictEqual(runs, shouldTrigger ? 1 : 0)

					dispose()
				}),
				{
					numRuns: 500,
				}
			)
		})

		it('never triggers after N repeated writes of the same value', (): void => {
			fc.assert(
				fc.property(
					primitiveArb,
					fc.integer({
						max: 50,
						min: 1,
					}),
					(value: Primitive, count: number): void => {
						const $s = state<{
							value: Primitive
						}>({
							value,
						})
						let runs = 0

						const dispose = effect((): void => {
							runs++
							$s.value
						})

						runs = 0
						for (let i = 0; i < count; i++) {
							$s.value = value
						}
						assert.strictEqual(runs, 0)

						dispose()
					}
				),
				{
					numRuns: 300,
				}
			)
		})

		it('never triggers when same-value writes are batched', (): void => {
			fc.assert(
				fc.property(
					primitiveArb,
					fc.integer({
						max: 50,
						min: 1,
					}),
					(value: Primitive, count: number): void => {
						const $s = state<{
							value: Primitive
						}>({
							value,
						})
						let runs = 0

						const dispose = effect((): void => {
							runs++
							$s.value
						})

						runs = 0
						batch((): void => {
							for (let i = 0; i < count; i++) {
								$s.value = value
							}
						})
						assert.strictEqual(runs, 0)

						dispose()
					}
				),
				{
					numRuns: 300,
				}
			)
		})

		it('derive does not notify downstream when computed output is unchanged', (): void => {
			fc.assert(
				fc.property(fc.integer(), fc.integer(), (initial: number, updated: number): void => {
					fc.pre(!Object.is(initial, updated))

					const $s = state({
						value: initial,
					})
					// Many-to-one function: different inputs can produce the same output
					const $sign = derive((): boolean => $s.value > 0)
					let effectRuns = 0

					const dispose = effect((): void => {
						effectRuns++
						$sign.value
					})

					effectRuns = 0
					$s.value = updated

					const derivedOutputChanged = !Object.is(initial > 0, updated > 0)
					assert.strictEqual(effectRuns, derivedOutputChanged ? 1 : 0)

					dispose()
					$sign.reactive = false
				}),
				{
					numRuns: 300,
				}
			)
		})
	}
)
