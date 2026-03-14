import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fc from 'fast-check'
import { effect, state } from '../src/index.ts'

/**
 * Property-based tests for cleanup completeness under arbitrary disposal orders.
 *
 * Beacon's effect() returns a dispose function that removes the effect from
 * all subscriber sets. These tests verify that for any N effects on the same
 * state, disposing any subset in any order means only the non-disposed effects
 * fire on subsequent updates.
 *
 * @see tests/PROPERTY_BASED_TESTING.md — Opportunity #6
 */

// --- Helpers ---

function defined<T>(value: T | undefined, msg: string): T {
	if (value === undefined) throw new Error(msg)
	return value
}

// --- Types ---

type Unsubscribe = () => void

// --- Arbitraries ---

const effectCountArb: fc.Arbitrary<number> = fc.integer({
	max: 15,
	min: 2,
})

// Generate a subset as a boolean array indicating which effects to dispose
const subsetArb: (n: number) => fc.Arbitrary<boolean[]> = (n: number): fc.Arbitrary<boolean[]> =>
	fc.array(fc.boolean(), {
		maxLength: n,
		minLength: n,
	})

// Generate a permutation of indices [0..n-1] to control disposal order
const permutationArb: (n: number) => fc.Arbitrary<number[]> = (n: number): fc.Arbitrary<number[]> =>
	fc.shuffledSubarray(
		Array.from(
			{
				length: n,
			},
			(_: unknown, i: number): number => i
		),
		{
			maxLength: n,
			minLength: n,
		}
	)

// --- Tests ---

describe('Property-Based: Cleanup Completeness', {
	concurrency: true,
	timeout: 30000,
}, (): void => {
	it('only non-disposed effects fire after disposing an arbitrary subset', (): void => {
		fc.assert(
			fc.property(
				effectCountArb,
				fc.integer({
					max: 1000,
					min: -1000,
				}),
				(n: number, updatedValue: number): void => {
					const disposeMask = defined(
						fc.sample(subsetArb(n), {
							numRuns: 1,
						})[0],
						'fc.sample must return at least one element'
					)

					const $s = state({
						value: 0,
					})
					const runs: number[] = Array.from(
						{
							length: n,
						},
						(): number => 0
					)
					const disposers: Unsubscribe[] = []

					for (let i = 0; i < n; i++) {
						const idx = i
						disposers.push(
							effect((): void => {
								const current = defined(runs[idx], `runs[${idx}] missing`)
								runs[idx] = current + 1
								$s.value
							})
						)
					}

					// All effects ran once at creation
					for (let i = 0; i < n; i++) {
						assert.strictEqual(runs[i], 1, `effect ${i} should have run once at creation`)
					}

					// Reset counters
					for (let i = 0; i < n; i++) {
						runs[i] = 0
					}

					// Dispose the subset
					for (let i = 0; i < n; i++) {
						if (defined(disposeMask[i], `disposeMask[${i}] missing`)) {
							defined(disposers[i], `disposers[${i}] missing`)()
						}
					}

					// Update state
					$s.value = updatedValue

					// Verify: disposed effects did not run, non-disposed effects ran exactly once
					for (let i = 0; i < n; i++) {
						if (defined(disposeMask[i], `disposeMask[${i}] missing`)) {
							assert.strictEqual(runs[i], 0, `disposed effect ${i} should not have run`)
						} else {
							const expected = Object.is(0, updatedValue) ? 0 : 1
							assert.strictEqual(runs[i], expected, `active effect ${i} should have run ${expected} time(s)`)
						}
					}

					// Cleanup remaining
					for (let i = 0; i < n; i++) {
						if (!defined(disposeMask[i], `disposeMask[${i}] missing`)) {
							defined(disposers[i], `disposers[${i}] missing`)()
						}
					}
				}
			),
			{
				numRuns: 300,
			}
		)
	})

	it('disposal order does not affect which effects fire', (): void => {
		fc.assert(
			fc.property(effectCountArb, (n: number): void => {
				const order = defined(
					fc.sample(permutationArb(n), {
						numRuns: 1,
					})[0],
					'fc.sample must return at least one element'
				)

				const $s = state({
					value: 0,
				})
				const runs: number[] = Array.from(
					{
						length: n,
					},
					(): number => 0
				)
				const disposers: Unsubscribe[] = []

				for (let i = 0; i < n; i++) {
					const idx = i
					disposers.push(
						effect((): void => {
							const current = defined(runs[idx], `runs[${idx}] missing`)
							runs[idx] = current + 1
							$s.value
						})
					)
				}

				// Reset counters
				for (let i = 0; i < n; i++) {
					runs[i] = 0
				}

				// Dispose ALL effects in a random permutation order
				for (const idx of order) {
					defined(disposers[idx], `disposers[${idx}] missing`)()
				}

				// Update state — no effects should fire
				$s.value = 42

				for (let i = 0; i < n; i++) {
					assert.strictEqual(runs[i], 0, `effect ${i} should not run after disposal (order: ${order})`)
				}
			}),
			{
				numRuns: 300,
			}
		)
	})

	it('incremental disposal: after each dispose, remaining effects still fire', (): void => {
		fc.assert(
			fc.property(effectCountArb, (n: number): void => {
				const order = defined(
					fc.sample(permutationArb(n), {
						numRuns: 1,
					})[0],
					'fc.sample must return at least one element'
				)

				const $s = state({
					value: 0,
				})
				const runs: number[] = Array.from(
					{
						length: n,
					},
					(): number => 0
				)
				const disposers: Unsubscribe[] = []
				const disposed: Set<number> = new Set()

				for (let i = 0; i < n; i++) {
					const idx = i
					disposers.push(
						effect((): void => {
							const current = defined(runs[idx], `runs[${idx}] missing`)
							runs[idx] = current + 1
							$s.value
						})
					)
				}

				let nextValue = 1
				for (const idx of order) {
					// Reset counters
					for (let i = 0; i < n; i++) {
						runs[i] = 0
					}

					// Dispose one more effect
					defined(disposers[idx], `disposers[${idx}] missing`)()
					disposed.add(idx)

					// Update state
					$s.value = nextValue++

					// Verify
					for (let i = 0; i < n; i++) {
						if (disposed.has(i)) {
							assert.strictEqual(runs[i], 0, `disposed effect ${i} fired after step removing ${idx}`)
						} else {
							assert.strictEqual(runs[i], 1, `active effect ${i} did not fire after step removing ${idx}`)
						}
					}
				}
			}),
			{
				numRuns: 300,
			}
		)
	})

	it('double-dispose is safe for any effect in any order', (): void => {
		fc.assert(
			fc.property(effectCountArb, (n: number): void => {
				const order = defined(
					fc.sample(permutationArb(n), {
						numRuns: 1,
					})[0],
					'fc.sample must return at least one element'
				)

				const $s = state({
					value: 0,
				})
				const disposers: Unsubscribe[] = []

				for (let i = 0; i < n; i++) {
					disposers.push(
						effect((): void => {
							$s.value
						})
					)
				}

				// Dispose each effect twice in random order — should never throw
				for (const idx of order) {
					const dispose = defined(disposers[idx], `disposers[${idx}] missing`)
					assert.doesNotThrow((): void => {
						dispose()
					})
					assert.doesNotThrow((): void => {
						dispose()
					})
				}

				// State updates should be safe with no active effects
				assert.doesNotThrow((): void => {
					$s.value = 99
				})
			}),
			{
				numRuns: 300,
			}
		)
	})

	it('disposing effects on multiple states leaves unrelated effects active', (): void => {
		fc.assert(
			fc.property(
				fc.integer({
					max: 8,
					min: 2,
				}),
				fc.integer({
					max: 8,
					min: 2,
				}),
				(nStates: number, nEffectsPerState: number): void => {
					const states: {
						value: number
					}[] = []
					for (let i = 0; i < nStates; i++) {
						states.push(
							state({
								value: i,
							})
						)
					}

					const runs: number[][] = []
					const disposers: Unsubscribe[][] = []

					for (let si = 0; si < nStates; si++) {
						const runsRow: number[] = []
						const disposersRow: Unsubscribe[] = []
						runs.push(runsRow)
						disposers.push(disposersRow)
						for (let ei = 0; ei < nEffectsPerState; ei++) {
							const stateIdx = si
							const effectIdx = ei
							runsRow.push(0)
							disposersRow.push(
								effect((): void => {
									const stateRuns = defined(runs[stateIdx], `runs[${stateIdx}] missing`)
									const current = defined(stateRuns[effectIdx], `runs[${stateIdx}][${effectIdx}] missing`)
									stateRuns[effectIdx] = current + 1
									defined(states[stateIdx], `states[${stateIdx}] missing`).value
								})
							)
						}
					}

					// Dispose all effects on state 0
					const disposers0 = defined(disposers[0], 'disposers[0] missing')
					for (let ei = 0; ei < nEffectsPerState; ei++) {
						defined(disposers0[ei], `disposers[0][${ei}] missing`)()
					}

					// Reset all counters
					for (let si = 0; si < nStates; si++) {
						const runsRow = defined(runs[si], `runs[${si}] missing`)
						for (let ei = 0; ei < nEffectsPerState; ei++) {
							runsRow[ei] = 0
						}
					}

					// Update state 0 — no effects should fire
					defined(states[0], 'states[0] missing').value = 999
					const runs0 = defined(runs[0], 'runs[0] missing')
					for (let ei = 0; ei < nEffectsPerState; ei++) {
						assert.strictEqual(runs0[ei], 0, `disposed effect on state 0 should not fire`)
					}

					// Update state 1 — all its effects should still fire
					if (nStates > 1) {
						defined(states[1], 'states[1] missing').value = 888
						const runs1 = defined(runs[1], 'runs[1] missing')
						for (let ei = 0; ei < nEffectsPerState; ei++) {
							assert.strictEqual(runs1[ei], 1, `effect on state 1 should still fire`)
						}
					}

					// Cleanup remaining
					for (let si = 1; si < nStates; si++) {
						const disposersRow = defined(disposers[si], `disposers[${si}] missing`)
						for (let ei = 0; ei < nEffectsPerState; ei++) {
							defined(disposersRow[ei], `disposers[${si}][${ei}] missing`)()
						}
					}
				}
			),
			{
				numRuns: 200,
			}
		)
	})
})
