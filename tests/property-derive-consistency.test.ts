import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fc from 'fast-check'
import { batch, derive, effect, state } from '../src/index.ts'

/**
 * Property-based tests for derive consistency (referential transparency).
 *
 * Beacon's derive() creates eagerly-computed values that must always reflect
 * the current result of their computation function applied to the current
 * state. These tests verify that invariant under arbitrary values, arbitrary
 * pure functions, and after arbitrary state updates.
 *
 * @see tests/PROPERTY_BASED_TESTING.md — Opportunity #4
 */

// --- Types ---

type NumericTransform = (x: number) => number

interface TransformDef {
	apply: NumericTransform
	label: string
}

// --- Arbitraries ---

const intArb: fc.Arbitrary<number> = fc.integer({
	max: 10000,
	min: -10000,
})

// Generate a pure numeric function by picking from a family of transforms.
// Each transform is deterministic and side-effect-free.
const transformArb: fc.Arbitrary<TransformDef> = fc.oneof(
	fc
		.integer({
			max: 100,
			min: -100,
		})
		.map(
			(k: number): TransformDef => ({
				apply: (x: number): number => x + k,
				label: `x + ${k}`,
			})
		),
	fc
		.integer({
			max: 20,
			min: -20,
		})
		.map(
			(k: number): TransformDef => ({
				apply: (x: number): number => x * k,
				label: `x * ${k}`,
			})
		),
	fc.constant<TransformDef>({
		apply: (x: number): number => -x,
		label: '-x',
	}),
	fc.constant<TransformDef>({
		apply: (x: number): number => Math.abs(x),
		label: 'Math.abs(x)',
	}),
	fc.constant<TransformDef>({
		apply: (x: number): number => x * x,
		label: 'x * x',
	}),
	fc
		.integer({
			max: 31,
			min: 0,
		})
		.map(
			(k: number): TransformDef => ({
				apply: (x: number): number => x >>> k,
				label: `x >>> ${k}`,
			})
		),
	fc
		.integer({
			max: 31,
			min: 0,
		})
		.map(
			(k: number): TransformDef => ({
				apply: (x: number): number => x & k,
				label: `x & ${k}`,
			})
		)
)

const updateSequenceArb: fc.Arbitrary<number[]> = fc.array(intArb, {
	maxLength: 20,
	minLength: 1,
})

// --- Tests ---

describe(
	'Property-Based: Derive Consistency',
	{
		concurrency: true,
		timeout: 30000,
	},
	(): void => {
		it('derive value equals f(state) at creation for any pure f and initial value', (): void => {
			fc.assert(
				fc.property(intArb, transformArb, (initial: number, t: TransformDef): void => {
					const $s = state({
						value: initial,
					})
					const $d = derive((): number => t.apply($s.value))

					assert.strictEqual(
						$d.value,
						t.apply(initial),
						`derive mismatch at creation for ${t.label} with initial=${initial}`
					)

					$d.reactive = false
				}),
				{
					numRuns: 300,
				}
			)
		})

		it('derive value equals f(state) after any state update', (): void => {
			fc.assert(
				fc.property(intArb, intArb, transformArb, (initial: number, updated: number, t: TransformDef): void => {
					const $s = state({
						value: initial,
					})
					const $d = derive((): number => t.apply($s.value))

					assert.strictEqual($d.value, t.apply(initial))

					$s.value = updated
					assert.strictEqual(
						$d.value,
						t.apply(updated),
						`derive mismatch after update for ${t.label}: initial=${initial}, updated=${updated}`
					)

					$d.reactive = false
				}),
				{
					numRuns: 300,
				}
			)
		})

		it('derive stays consistent through arbitrary update sequences', (): void => {
			fc.assert(
				fc.property(
					intArb,
					updateSequenceArb,
					transformArb,
					(initial: number, updates: number[], t: TransformDef): void => {
						const $s = state({
							value: initial,
						})
						const $d = derive((): number => t.apply($s.value))

						assert.strictEqual($d.value, t.apply(initial))

						for (const v of updates) {
							$s.value = v
							assert.strictEqual($d.value, t.apply(v), `derive mismatch during sequence for ${t.label}: value=${v}`)
						}

						$d.reactive = false
					}
				),
				{
					numRuns: 300,
				}
			)
		})

		it('chained derives remain consistent: g(f(state)) after updates', (): void => {
			fc.assert(
				fc.property(
					intArb,
					intArb,
					transformArb,
					transformArb,
					(initial: number, updated: number, f: TransformDef, g: TransformDef): void => {
						const $s = state({
							value: initial,
						})
						const $first = derive((): number => f.apply($s.value))
						const $second = derive((): number => g.apply($first.value as number))

						assert.strictEqual($first.value, f.apply(initial))
						assert.strictEqual($second.value, g.apply(f.apply(initial)))

						$s.value = updated
						assert.strictEqual(
							$first.value,
							f.apply(updated),
							`first derive mismatch for ${f.label}: updated=${updated}`
						)
						assert.strictEqual(
							$second.value,
							g.apply(f.apply(updated)),
							`chained derive mismatch for ${g.label}(${f.label}): updated=${updated}`
						)

						$second.reactive = false
						$first.reactive = false
					}
				),
				{
					numRuns: 300,
				}
			)
		})

		it('derive recomputes exactly once per actual state change', (): void => {
			fc.assert(
				fc.property(
					intArb,
					updateSequenceArb,
					transformArb,
					(initial: number, updates: number[], t: TransformDef): void => {
						const $s = state({
							value: initial,
						})
						let computeCount = 0

						const $d = derive((): number => {
							computeCount++
							return t.apply($s.value)
						})

						// Initial computation
						void $d.value
						assert.strictEqual(computeCount, 1)

						for (const v of updates) {
							const prevValue = $s.value
							computeCount = 0
							$s.value = v

							// Access to trigger lazy recompute if needed
							void $d.value

							if (Object.is(prevValue, v)) {
								// Same value: no recompute
								assert.strictEqual(computeCount, 0, `unexpected recompute for same value ${v} with ${t.label}`)
							} else {
								// Different value: exactly one recompute
								assert.strictEqual(computeCount, 1, `expected exactly 1 recompute for ${t.label}: ${prevValue} -> ${v}`)
							}
						}

						$d.reactive = false
					}
				),
				{
					numRuns: 300,
				}
			)
		})

		it('derive stays consistent when state changes inside a batch', (): void => {
			fc.assert(
				fc.property(
					intArb,
					updateSequenceArb,
					transformArb,
					(initial: number, updates: number[], t: TransformDef): void => {
						const $s = state({
							value: initial,
						})
						const $d = derive((): number => t.apply($s.value))

						assert.strictEqual($d.value, t.apply(initial))

						batch((): void => {
							for (const v of updates) {
								$s.value = v
							}
						})

						const lastValue = updates[updates.length - 1]
						if (lastValue === undefined) throw new Error('updates must be non-empty')
						assert.strictEqual(
							$d.value,
							t.apply(lastValue),
							`derive mismatch after batch for ${t.label}: last=${lastValue}`
						)

						$d.reactive = false
					}
				),
				{
					numRuns: 300,
				}
			)
		})

		it('effect observing derive fires only when derived output changes', (): void => {
			fc.assert(
				fc.property(intArb, intArb, transformArb, (initial: number, updated: number, t: TransformDef): void => {
					fc.pre(!Object.is(initial, updated))

					const $s = state({
						value: initial,
					})
					const $d = derive((): number => t.apply($s.value))
					let effectRuns = 0

					const dispose = effect((): void => {
						effectRuns++
						$d.value
					})

					effectRuns = 0
					$s.value = updated

					const derivedChanged = !Object.is(t.apply(initial), t.apply(updated))
					assert.strictEqual(
						effectRuns,
						derivedChanged ? 1 : 0,
						`effect ran ${effectRuns} times but derived ${derivedChanged ? 'changed' : 'unchanged'} for ${t.label}: ${initial} -> ${updated}`
					)

					dispose()
					$d.reactive = false
				}),
				{
					numRuns: 300,
				}
			)
		})
	}
)
