import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fc from 'fast-check'
import { batch, effect, state } from '../src/index.ts'

/**
 * Property-based tests for batch effect deduplication.
 *
 * Beacon's batch() groups writes and flushes effects once at the outermost
 * batch boundary. These tests verify that invariant under arbitrary write
 * sequences, multi-property updates, multi-state updates, and arbitrary
 * nesting depths.
 *
 * @see tests/PROPERTY_BASED_TESTING.md — Opportunity #3
 */

// --- Types ---

interface MultiPropState {
	a: number
	b: number
	c: number
	d: number
	e: number
}

type PropKey = keyof MultiPropState

interface PropWrite {
	key: PropKey
	value: number
}

// --- Arbitraries ---

const propKeys: PropKey[] = [
	'a',
	'b',
	'c',
	'd',
	'e',
]

const intArb: fc.Arbitrary<number> = fc.integer({
	max: 1000,
	min: -1000,
})

const writeSequenceArb: fc.Arbitrary<number[]> = fc.array(intArb, {
	maxLength: 50,
	minLength: 1,
})

const propWriteArb: fc.Arbitrary<PropWrite> = fc.record({
	key: fc.constantFrom(...propKeys),
	value: intArb,
})

const multiWriteArb: fc.Arbitrary<PropWrite[]> = fc.array(propWriteArb, {
	maxLength: 30,
	minLength: 1,
})

// --- Tests ---

describe('Property-Based: Batch Deduplication', {
	concurrency: true,
	timeout: 30000,
}, (): void => {
	it('fires effect at most once for arbitrary writes to a single property', (): void => {
		fc.assert(
			fc.property(intArb, writeSequenceArb, (initial: number, writes: number[]): void => {
				const $s = state({
					value: initial,
				})
				let runs = 0

				const dispose = effect((): void => {
					runs++
					$s.value
				})

				runs = 0

				batch((): void => {
					for (const w of writes) {
						$s.value = w
					}
				})

				assert.ok(runs <= 1, `Effect ran ${runs} times for ${writes.length} writes in batch`)

				const lastWrite = writes[writes.length - 1]
				assert.strictEqual($s.value, lastWrite)

				dispose()
			}),
			{
				numRuns: 300,
			}
		)
	})

	it('fires effect at most once for writes across multiple properties', (): void => {
		fc.assert(
			fc.property(multiWriteArb, (writes: PropWrite[]): void => {
				const $s = state<MultiPropState>({
					a: 0,
					b: 0,
					c: 0,
					d: 0,
					e: 0,
				})
				let runs = 0

				const dispose = effect((): void => {
					runs++
					// Subscribe to all properties
					$s.a
					$s.b
					$s.c
					$s.d
					$s.e
				})

				runs = 0

				batch((): void => {
					for (const { key, value } of writes) {
						$s[key] = value
					}
				})

				assert.ok(runs <= 1, `Effect ran ${runs} times for ${writes.length} multi-prop writes`)

				// Verify final value per property matches last write for each key
				const expected: MultiPropState = {
					a: 0,
					b: 0,
					c: 0,
					d: 0,
					e: 0,
				}
				for (const { key, value } of writes) {
					expected[key] = value
				}
				for (const k of propKeys) {
					assert.strictEqual($s[k], expected[k])
				}

				dispose()
			}),
			{
				numRuns: 300,
			}
		)
	})

	it('fires effect at most once when updating multiple states in a batch', (): void => {
		fc.assert(
			fc.property(
				fc.array(intArb, {
					maxLength: 20,
					minLength: 1,
				}),
				(values: number[]): void => {
					// Create one state per value
					const states: {
						value: number
					}[] = []
					for (const v of values) {
						states.push(
							state({
								value: v,
							})
						)
					}

					let runs = 0
					const dispose = effect((): void => {
						runs++
						// Subscribe to all states
						for (const $s of states) {
							$s.value
						}
					})

					runs = 0

					batch((): void => {
						for (const $s of states) {
							$s.value = $s.value + 1
						}
					})

					assert.ok(runs <= 1, `Effect ran ${runs} times for ${states.length} state updates`)

					dispose()
				}
			),
			{
				numRuns: 300,
			}
		)
	})

	it('does not fire effects during nested batches, only after the outermost', (): void => {
		fc.assert(
			fc.property(
				fc.integer({
					max: 20,
					min: 1,
				}),
				intArb,
				intArb,
				(depth: number, initial: number, updated: number): void => {
					fc.pre(!Object.is(initial, updated))

					const $s = state({
						value: initial,
					})
					let runs = 0
					const midBatchRuns: number[] = []

					const dispose = effect((): void => {
						runs++
						$s.value
					})

					runs = 0

					// Build nested batch: depth levels deep, write at innermost
					const leaf: () => void = (): void => {
						$s.value = updated
						midBatchRuns.push(runs) // capture effect run count at write time
					}

					let fn: () => void = leaf
					for (let i = 0; i < depth; i++) {
						const inner: () => void = fn
						fn = (): void => {
							batch(inner)
						}
					}

					batch(fn)

					// Effect must NOT have run during nested batches
					assert.deepStrictEqual(
						midBatchRuns,
						[
							0,
						]
					)
					// Effect runs exactly once after outermost batch completes
					assert.strictEqual(runs, 1)
					assert.strictEqual($s.value, updated)

					dispose()
				}
			),
			{
				numRuns: 300,
			}
		)
	})
})
