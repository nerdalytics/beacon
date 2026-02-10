import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fc from 'fast-check'
import { effect, state } from '../src/index.ts'

/**
 * Property-based tests for dynamic dependency tracking under arbitrary
 * branch sequences.
 *
 * Beacon re-evaluates effect dependency sets on each run. When an effect
 * conditionally reads from different state objects, toggling the condition
 * must correctly add/remove subscriptions via updateEffectSubscriptions
 * (and the tryRestoreStableDeps fast path).
 *
 * These tests verify that for any sequence of boolean toggles, the effect
 * only fires when the currently-tracked dependency changes — never on
 * updates to the inactive branch's dependency.
 *
 * @see tests/PROPERTY_BASED_TESTING.md — Opportunity #10
 */

// --- Types ---

interface ToggleStep {
	branch: boolean
	updateActive: number
	updateInactive: number
}

// --- Arbitraries ---

const intArb: fc.Arbitrary<number> = fc.integer({
	max: 1000,
	min: -1000,
})

const toggleStepArb: fc.Arbitrary<ToggleStep> = fc.record({
	branch: fc.boolean(),
	updateActive: intArb,
	updateInactive: intArb,
})

const toggleSequenceArb: fc.Arbitrary<boolean[]> = fc.array(fc.boolean(), {
	maxLength: 30,
	minLength: 1,
})

// --- Tests ---

describe(
	'Property-Based: Dynamic Dependency Tracking',
	{
		concurrency: true,
		timeout: 30000,
	},
	(): void => {
		it('effect only fires when the active branch dependency changes', (): void => {
			fc.assert(
				fc.property(
					fc.boolean(),
					intArb,
					intArb,
					fc.array(toggleStepArb, {
						maxLength: 20,
						minLength: 1,
					}),
					(initialBranch: boolean, aInit: number, bInit: number, steps: ToggleStep[]): void => {
						const $cond = state({
							value: initialBranch,
						})
						const $a = state({
							value: aInit,
						})
						const $b = state({
							value: bInit,
						})
						let result = 0

						const dispose = effect((): void => {
							if ($cond.value) {
								result = $a.value
							} else {
								result = $b.value
							}
						})

						for (const step of steps) {
							// Set the branch
							$cond.value = step.branch

							const expectedBefore = step.branch ? $a.value : $b.value
							assert.strictEqual(
								result,
								expectedBefore,
								`result should reflect active branch after toggle to ${step.branch}`
							)

							// Update the INACTIVE dependency — effect should NOT fire
							if (step.branch) {
								// Active is $a, inactive is $b
								$b.value = step.updateInactive
							} else {
								// Active is $b, inactive is $a
								$a.value = step.updateInactive
							}

							// result should be unchanged since inactive dep was updated
							assert.strictEqual(
								result,
								expectedBefore,
								`result changed when inactive branch dep was updated (branch=${step.branch})`
							)

							// Update the ACTIVE dependency — effect SHOULD fire (if value differs)
							const activeBefore = step.branch ? $a.value : $b.value
							if (step.branch) {
								$a.value = step.updateActive
							} else {
								$b.value = step.updateActive
							}

							if (!Object.is(activeBefore, step.updateActive)) {
								assert.strictEqual(
									result,
									step.updateActive,
									`result should update when active dep changes (branch=${step.branch})`
								)
							}
						}

						dispose()
					}
				),
				{
					numRuns: 300,
				}
			)
		})

		it('rapid toggling correctly switches subscriptions', (): void => {
			fc.assert(
				fc.property(intArb, intArb, toggleSequenceArb, (aInit: number, bInit: number, toggles: boolean[]): void => {
					const $cond = state({
						value: true,
					})
					const $a = state({
						value: aInit,
					})
					const $b = state({
						value: bInit,
					})
					let result = 0

					const dispose = effect((): void => {
						if ($cond.value) {
							result = $a.value
						} else {
							result = $b.value
						}
					})

					// Rapidly toggle the condition
					for (const branch of toggles) {
						$cond.value = branch
					}

					const finalBranch = toggles[toggles.length - 1]
					const expectedResult = finalBranch ? $a.value : $b.value
					assert.strictEqual(
						result,
						expectedResult,
						`after ${toggles.length} toggles, result should match final branch (${finalBranch})`
					)

					// Verify only the active dependency triggers the effect
					// Update inactive — should not change result
					const resultBefore = result
					if (finalBranch) {
						$b.value = 9999
					} else {
						$a.value = 9999
					}
					assert.strictEqual(result, resultBefore, 'inactive dep update changed result after toggles')

					// Update active — should change result
					if (finalBranch) {
						$a.value = -7777
						assert.strictEqual(result, -7777, 'active dep update did not change result after toggles')
					} else {
						$b.value = -7777
						assert.strictEqual(result, -7777, 'active dep update did not change result after toggles')
					}

					dispose()
				}),
				{
					numRuns: 300,
				}
			)
		})

		it('multi-branch effect tracks only the taken branch dependencies', (): void => {
			fc.assert(
				fc.property(
					fc.integer({
						max: 5,
						min: 0,
					}),
					fc.array(
						fc.integer({
							max: 5,
							min: 0,
						}),
						{
							maxLength: 15,
							minLength: 1,
						}
					),
					(initialBranch: number, branchSequence: number[]): void => {
						// 6 states, effect reads from one based on a selector
						const states: {
							value: number
						}[] = []
						for (let i = 0; i < 6; i++) {
							states.push(
								state({
									value: i * 10,
								})
							)
						}
						const $selector = state({
							value: initialBranch,
						})
						let result = 0

						const dispose = effect((): void => {
							const active = states[$selector.value]
							if (!active) throw new Error(`no state at index ${$selector.value}`)
							result = active.value
						})

						assert.strictEqual(result, initialBranch * 10)

						for (const branch of branchSequence) {
							$selector.value = branch

							const activeBranchState = states[branch]
							if (!activeBranchState) throw new Error(`no state at index ${branch}`)
							const expected = activeBranchState.value
							assert.strictEqual(result, expected, `result mismatch after switching to branch ${branch}`)

							// Update a non-active state — result should not change
							const inactiveIdx = (branch + 1) % 6
							const inactiveState = states[inactiveIdx]
							if (!inactiveState) throw new Error(`no state at index ${inactiveIdx}`)
							const prevResult = result
							inactiveState.value = inactiveState.value + 1000
							assert.strictEqual(
								result,
								prevResult,
								`result changed when updating inactive state ${inactiveIdx} (active=${branch})`
							)
						}

						dispose()
					}
				),
				{
					numRuns: 300,
				}
			)
		})

		it('effect re-subscribes correctly when toggling back to a previously active branch', (): void => {
			fc.assert(
				fc.property(
					intArb,
					intArb,
					fc.array(fc.boolean(), {
						maxLength: 20,
						minLength: 3,
					}),
					(aInit: number, bInit: number, toggles: boolean[]): void => {
						const $cond = state({
							value: true,
						})
						const $a = state({
							value: aInit,
						})
						const $b = state({
							value: bInit,
						})
						let result = 0

						const dispose = effect((): void => {
							if ($cond.value) {
								result = $a.value
							} else {
								result = $b.value
							}
						})

						let nextA = aInit
						let nextB = bInit

						for (const branch of toggles) {
							$cond.value = branch

							// Increment the active value to ensure it's always different
							if (branch) {
								nextA++
								$a.value = nextA
								assert.strictEqual(result, nextA, `a-branch result mismatch after re-subscribe`)
							} else {
								nextB++
								$b.value = nextB
								assert.strictEqual(result, nextB, `b-branch result mismatch after re-subscribe`)
							}
						}

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
