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

describe(
	'Property-Based: Cleanup Completeness',
	{
		concurrency: true,
		timeout: 30000,
	},
	(): void => {
		it('only non-disposed effects fire after disposing an arbitrary subset', (): void => {
			fc.assert(
				fc.property(
					effectCountArb,
					fc.integer({
						max: 1000,
						min: -1000,
					}),
					(n: number, updatedValue: number): void => {
						const disposeMask = fc.sample(subsetArb(n), {
							numRuns: 1,
						})[0]

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
									runs[idx]++
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
							if (disposeMask[i]) {
								disposers[i]()
							}
						}

						// Update state
						$s.value = updatedValue

						// Verify: disposed effects did not run, non-disposed effects ran exactly once
						for (let i = 0; i < n; i++) {
							if (disposeMask[i]) {
								assert.strictEqual(runs[i], 0, `disposed effect ${i} should not have run`)
							} else {
								const expected = Object.is(0, updatedValue) ? 0 : 1
								assert.strictEqual(runs[i], expected, `active effect ${i} should have run ${expected} time(s)`)
							}
						}

						// Cleanup remaining
						for (let i = 0; i < n; i++) {
							if (!disposeMask[i]) {
								disposers[i]()
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
					const order = fc.sample(permutationArb(n), {
						numRuns: 1,
					})[0]

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
								runs[idx]++
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
						disposers[idx]()
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
					const order = fc.sample(permutationArb(n), {
						numRuns: 1,
					})[0]

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
								runs[idx]++
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
						disposers[idx]()
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
					const order = fc.sample(permutationArb(n), {
						numRuns: 1,
					})[0]

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
						assert.doesNotThrow((): void => {
							disposers[idx]()
						})
						assert.doesNotThrow((): void => {
							disposers[idx]()
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
							runs.push([])
							disposers.push([])
							for (let ei = 0; ei < nEffectsPerState; ei++) {
								const stateIdx = si
								const effectIdx = ei
								runs[si].push(0)
								disposers[si].push(
									effect((): void => {
										runs[stateIdx][effectIdx]++
										states[stateIdx].value
									})
								)
							}
						}

						// Dispose all effects on state 0
						for (let ei = 0; ei < nEffectsPerState; ei++) {
							disposers[0][ei]()
						}

						// Reset all counters
						for (let si = 0; si < nStates; si++) {
							for (let ei = 0; ei < nEffectsPerState; ei++) {
								runs[si][ei] = 0
							}
						}

						// Update state 0 — no effects should fire
						states[0].value = 999
						for (let ei = 0; ei < nEffectsPerState; ei++) {
							assert.strictEqual(runs[0][ei], 0, `disposed effect on state 0 should not fire`)
						}

						// Update state 1 — all its effects should still fire
						if (nStates > 1) {
							states[1].value = 888
							for (let ei = 0; ei < nEffectsPerState; ei++) {
								assert.strictEqual(runs[1][ei], 1, `effect on state 1 should still fire`)
							}
						}

						// Cleanup remaining
						for (let si = 1; si < nStates; si++) {
							for (let ei = 0; ei < nEffectsPerState; ei++) {
								disposers[si][ei]()
							}
						}
					}
				),
				{
					numRuns: 200,
				}
			)
		})
	}
)
