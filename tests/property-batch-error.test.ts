import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fc from 'fast-check'
import { batch, effect, state } from '../src/index.ts'

/**
 * Property-based tests for batch error recovery (depth invariant).
 *
 * Beacon's batch() increments batchDepth on entry and decrements on exit
 * (including error paths). If batchDepth reaches 0, clearBatchState() runs.
 * These tests verify that after a batch throws at any nesting depth K of N,
 * the system remains fully functional — subsequent non-batched writes
 * immediately trigger effects (proving batchDepth returned to 0).
 *
 * @see tests/PROPERTY_BASED_TESTING.md — Opportunity #9
 */

// --- Helpers ---

/**
 * Build a nested batch chain of depth N that throws at depth K (1-indexed).
 * depth=3, throwAt=2 →  batch(() => { batch(() => { throw ... }) })
 */
function nestedBatchThrowingAt(totalDepth: number, throwAtDepth: number): void {
	let currentDepth = 0

	const recurse = (): void => {
		currentDepth++
		if (currentDepth === throwAtDepth) {
			throw new Error(`batch-error-at-${throwAtDepth}`)
		}
		if (currentDepth < totalDepth) {
			batch(recurse)
		}
	}

	batch(recurse)
}

// --- Arbitraries ---

const totalDepthArb: fc.Arbitrary<number> = fc.integer({
	max: 20,
	min: 1,
})

const intArb: fc.Arbitrary<number> = fc.integer({
	max: 1000,
	min: -1000,
})

// --- Tests ---

describe(
	'Property-Based: Batch Error Recovery',
	{
		concurrency: true,
		timeout: 30000,
	},
	(): void => {
		it('system is functional after batch error at any depth K of N', (): void => {
			fc.assert(
				fc.property(totalDepthArb, intArb, (totalDepth: number, updatedValue: number): void => {
					// throwAtDepth in [1, totalDepth]
					const throwAtDepth = fc.sample(
						fc.integer({
							max: totalDepth,
							min: 1,
						}),
						{
							numRuns: 1,
						}
					)[0]

					// Trigger the error
					assert.throws(
						(): void => {
							nestedBatchThrowingAt(totalDepth, throwAtDepth)
						},
						(err: unknown): boolean => err instanceof Error && err.message === `batch-error-at-${throwAtDepth}`
					)

					// System should be functional: non-batched write triggers effect immediately
					const $s = state({
						value: 0,
					})
					let runs = 0

					const dispose = effect((): void => {
						runs++
						$s.value
					})

					runs = 0
					$s.value = updatedValue

					const expected = Object.is(0, updatedValue) ? 0 : 1
					assert.strictEqual(
						runs,
						expected,
						`effect did not fire after batch error at depth ${throwAtDepth}/${totalDepth}`
					)

					dispose()
				}),
				{
					numRuns: 300,
				}
			)
		})

		it('batch works correctly after a previous batch error', (): void => {
			fc.assert(
				fc.property(totalDepthArb, intArb, (totalDepth: number, updatedValue: number): void => {
					fc.pre(!Object.is(0, updatedValue))

					const throwAtDepth = fc.sample(
						fc.integer({
							max: totalDepth,
							min: 1,
						}),
						{
							numRuns: 1,
						}
					)[0]

					// Trigger the error
					try {
						nestedBatchThrowingAt(totalDepth, throwAtDepth)
					} catch {
						// Expected
					}

					// A new batch should work correctly
					const $s = state({
						value: 0,
					})
					let runs = 0

					const dispose = effect((): void => {
						runs++
						$s.value
					})

					runs = 0

					batch((): void => {
						$s.value = updatedValue
					})

					assert.strictEqual(runs, 1, `effect did not fire in batch after error at depth ${throwAtDepth}/${totalDepth}`)
					assert.strictEqual($s.value, updatedValue)

					dispose()
				}),
				{
					numRuns: 300,
				}
			)
		})

		it('error at every possible depth K of N leaves system functional', (): void => {
			fc.assert(
				fc.property(
					fc.integer({
						max: 10,
						min: 1,
					}),
					(totalDepth: number): void => {
						// Exhaustively test every throw-at-depth for this totalDepth
						for (let k = 1; k <= totalDepth; k++) {
							try {
								nestedBatchThrowingAt(totalDepth, k)
							} catch {
								// Expected
							}

							// Verify system works after each error
							const $s = state({
								value: 0,
							})
							let runs = 0

							const dispose = effect((): void => {
								runs++
								$s.value
							})

							runs = 0
							$s.value = k

							assert.strictEqual(runs, 1, `system broken after error at depth ${k}/${totalDepth}`)

							dispose()
						}
					}
				),
				{
					numRuns: 200,
				}
			)
		})

		it('nested batch after error at intermediate depth still deduplicates', (): void => {
			fc.assert(
				fc.property(
					fc.integer({
						max: 15,
						min: 2,
					}),
					fc.array(intArb, {
						maxLength: 10,
						minLength: 2,
					}),
					(totalDepth: number, updates: number[]): void => {
						const throwAtDepth = fc.sample(
							fc.integer({
								max: totalDepth,
								min: 1,
							}),
							{
								numRuns: 1,
							}
						)[0]

						// Trigger error
						try {
							nestedBatchThrowingAt(totalDepth, throwAtDepth)
						} catch {
							// Expected
						}

						// Now a fresh batch should still deduplicate effects
						const $s = state({
							value: 0,
						})
						let runs = 0

						const dispose = effect((): void => {
							runs++
							$s.value
						})

						runs = 0

						batch((): void => {
							for (const v of updates) {
								$s.value = v
							}
						})

						assert.ok(runs <= 1, `effect ran ${runs} times in batch after error at ${throwAtDepth}/${totalDepth}`)

						dispose()
					}
				),
				{
					numRuns: 300,
				}
			)
		})

		it('multiple consecutive batch errors do not corrupt state', (): void => {
			fc.assert(
				fc.property(
					fc.array(totalDepthArb, {
						maxLength: 8,
						minLength: 2,
					}),
					intArb,
					(depths: number[], updatedValue: number): void => {
						fc.pre(!Object.is(0, updatedValue))

						// Trigger multiple errors in succession
						for (const depth of depths) {
							try {
								nestedBatchThrowingAt(depth, 1)
							} catch {
								// Expected
							}
						}

						// System should still work
						const $s = state({
							value: 0,
						})
						let runs = 0

						const dispose = effect((): void => {
							runs++
							$s.value
						})

						runs = 0
						$s.value = updatedValue

						assert.strictEqual(runs, 1, `system broken after ${depths.length} consecutive batch errors`)

						dispose()
					}
				),
				{
					numRuns: 300,
				}
			)
		})
	}
)
