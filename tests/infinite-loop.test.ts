import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { batch, derive, effect, state } from '../src/index.ts'
import type { StateHooks } from '../src/types.ts'

/**
 * Tests for infinite loop detection in reactive effects.
 *
 * These tests focus specifically on direct infinite loops - where an effect
 * reads from a state and then writes to the same state, which would cause
 * an infinite loop if not handled. The infinite loop detection mechanism
 * throws an error in these cases to prevent the loop.
 *
 * These tests are distinct from cyclic dependency tests, which focus on
 * indirect cycles between multiple effects and states that form circular
 * dependencies but may not cause infinite loops.
 */

// Both kinds of state: hooks only observe, so the loop check must behave the same on each
const observingHooks: StateHooks<number[]> = {
	onRead: (): void => {},
	onWrite: (): void => {},
}

function bothKinds(initial: number[]): [string, number[]][] {
	return [
		['no hooks', state([...initial])],
		['hooks', state([...initial], observingHooks)],
	]
}

const mutatingCalls: [string, (list: number[]) => unknown][] = [
	['push', (list: number[]): unknown => list.push(1)],
	['pop', (list: number[]): unknown => list.pop()],
	['shift', (list: number[]): unknown => list.shift()],
	['unshift', (list: number[]): unknown => list.unshift(1)],
	['splice', (list: number[]): unknown => list.splice(0, 1)],
	['sort', (list: number[]): unknown => list.sort()],
	['reverse', (list: number[]): unknown => list.reverse()],
]

describe('Infinite Loop Detection', {
	concurrency: true,
	timeout: 1000,
}, (): void => {
	// Track all unsubscribe functions created in each test
	let unsubscribes: Array<() => void> = []

	afterEach((): void => {
		// Clean up all effects created during the test
		for (const unsubscribe of unsubscribes) {
			try {
				unsubscribe()
			} catch {
				// Ignore errors during cleanup
			}
		}
		unsubscribes = []
	})
	it('should detect direct infinite loops in effects (read + write to same state)', (): void => {
		const $count = state({
			value: 0,
		})
		let errorThrown = false

		try {
			effect((): void => {
				const currentCount = $count.value
				$count.value = currentCount + 1
			})

			// Trigger another update to cause the error
			$count.value = 10
		} catch (error: unknown) {
			errorThrown = true
			assert.ok(
				error instanceof Error && error.message.includes('Infinite loop detected'),
				`Expected infinite loop error, but got: ${error}`
			)
		}

		assert.strictEqual(errorThrown, true, 'An infinite loop error should have been thrown')
	})

	it('detects direct infinite loops on state created with hooks', (): void => {
		const $count = state({ value: 0 }, { onRead: (): void => {}, onWrite: (): void => {} })

		assert.throws(() => {
			unsubscribes.push(
				effect((): void => {
					$count.value = $count.value + 1
				})
			)
			$count.value = 10
		}, /Infinite loop detected/)
	})

	it('should allow a single read-write cycle but prevent infinite loops', (): void => {
		const $counter = state({
			value: 5,
		})
		const values: number[] = []
		let errorThrown = false
		let effectRanCount = 0

		try {
			effect((): void => {
				effectRanCount++
				const current = $counter.value
				values.push(current)
				$counter.value = current + 1
			})

			// Trigger the effect again with a new value
			$counter.value = 10
		} catch (error: unknown) {
			errorThrown = true
			assert.ok(
				error instanceof Error && error.message.includes('Infinite loop detected'),
				`Expected infinite loop error, but got: ${error}`
			)
		}

		assert.strictEqual(effectRanCount, 1, 'Effect should run once before the error')
		assert.ok(values.length === 1, 'Counter should have been updated once')
		assert.strictEqual(errorThrown, true, 'An infinite loop error should have been thrown')
	})

	it('should allow safe patterns that avoid infinite loops', (): void => {
		// Create two states to break the cycle
		const $source = state({
			value: 0,
		})
		const $target = state({
			value: 0,
		})
		let effectRunCount = 0

		// This pattern is safe: source → target (different states)
		const dispose = effect((): void => {
			effectRunCount++
			// Read from source, write to target
			$target.value = $source.value * 2
		})
		unsubscribes.push(dispose)

		// Reset counter after initial effect run
		effectRunCount = 0

		// Update source several times
		$source.value = 1
		$source.value = 2
		$source.value = 3

		// Check final values
		assert.strictEqual($source.value, 3)
		assert.strictEqual($target.value, 6)
		assert.strictEqual(effectRunCount, 3, 'Effect should run once per update')
	})

	it('should not catch infinite loop error in safe complex update patterns', (): void => {
		// Setup multiple states in a chain
		const $a = state({
			value: 1,
		})
		const $b = state({
			value: 2,
		})
		const $c = state({
			value: 3,
		})
		let errorThrown = false

		try {
			// First effect creates a safe dependency: a → b
			effect((): void => {
				$b.value = $a.value * 2
			})

			// Second effect creates another safe chain: b → c
			effect((): void => {
				$c.value = $b.value + 1
			})

			// This effect creates the dangerous cycle: c → a
			// This completes a cycle: a → b → c → a
			effect((): void => {
				const cValue = $c.value
				$a.value = cValue
			})

			// Trigger the cycle
			$a.value = 5
		} catch (error: unknown) {
			errorThrown = true
			assert.ok(
				error instanceof Error && error.message.includes('Infinite loop detected'),
				`Expected infinite loop error, but got: ${error}`
			)
		}

		assert.strictEqual(errorThrown, false, 'No infinite loop error should have been thrown')
	})

	it('should not catch infinite loop error with safe derived states', (): void => {
		// Create the base state
		const $baseState = state({
			value: 5,
		})
		let errorThrown = false

		try {
			// Create a derived state that depends on the base state
			const $derivedResult = derive((): number => {
				return $baseState.value * 2
			})

			// This effect creates a cycle: derivedResult → baseState
			effect((): void => {
				const value = $derivedResult.value as number
				$baseState.value = value
			})

			// Trigger the cycle
			$baseState.value = 10
		} catch (error: unknown) {
			errorThrown = true
			assert.ok(
				error instanceof Error && error.message.includes('Infinite loop detected'),
				`Expected infinite loop error, but got: ${error}`
			)
		}

		assert.strictEqual(errorThrown, false, 'No infinite loop error should have been thrown')
	})

	it('should detect infinite loops even with conditional logic', (): void => {
		const $counter = state({
			value: 2,
		})
		let errorThrown = false

		try {
			effect((): void => {
				const current = $counter.value
				// Only write back for even values
				if (current % 2 === 0) {
					$counter.value = current + 1
				}
			})
		} catch (error: unknown) {
			errorThrown = true
			assert.ok(
				error instanceof Error && error.message.includes('Infinite loop detected'),
				`Expected infinite loop error, but got: ${error}`
			)
		}

		assert.strictEqual(errorThrown, true, 'An infinite loop error should have been thrown')
	})

	it('should detect infinite loops in effects created inside batches', (): void => {
		const $value = state({
			value: 10,
		})
		let errorThrown = false

		try {
			// Batch operation that creates an effect with a potential infinite loop
			batch((): void => {
				// Set initial value
				$value.value = 20

				// Create effect inside batch that creates an infinite loop
				effect((): void => {
					const _currentValue = $value.value
					$value.value = 42
				})

				// Another update inside the batch
				$value.value = 30
			})
		} catch (error: unknown) {
			errorThrown = true
			assert.ok(
				error instanceof Error && error.message.includes('Infinite loop detected'),
				`Expected infinite loop error, but got: ${error}`
			)
		}

		assert.strictEqual(errorThrown, true, 'An infinite loop error should have been thrown')
	})

	it('should name the effect and property in the error for a named effect', (): void => {
		const $count = state({
			value: 0,
		})

		assert.throws(
			(): void => {
				effect((): void => {
					$count.value = $count.value + 1
				}, 'counter')
			},
			{
				message: 'Infinite loop detected: effect "counter" cannot update property "value" it depends on',
			}
		)
	})

	it('should detect infinite loops in oscillating patterns', (): void => {
		const $a = state({
			value: 5,
		})
		let errorThrown = false

		try {
			// Create an effect that reads and writes to the same state
			effect((): void => {
				const currentValue = $a.value
				// Negate the value - would cause oscillation
				$a.value = -currentValue
			})

			// Trigger the effect
			$a.value = 10
		} catch (error: unknown) {
			errorThrown = true
			assert.ok(
				error instanceof Error && error.message.includes('Infinite loop detected'),
				`Expected infinite loop error, but got: ${error}`
			)
		}

		assert.strictEqual(errorThrown, true, 'An infinite loop error should have been thrown')
	})

	it('raises the named loop error when a sync effect calls any mutating array method on both kinds of state', (): void => {
		for (const [name, call] of mutatingCalls) {
			for (const [kind, $list] of bothKinds([2, 1])) {
				assert.throws(
					(): void => {
						unsubscribes.push(
							effect((): void => {
								call($list)
							}, name)
						)
					},
					new RegExp(`Infinite loop detected: effect "${name}" cannot update property "`),
					`${name} ${kind}`
				)
			}
		}
	})

	it('raises nothing when sort or reverse in a sync effect has fewer than two elements to move', (): void => {
		for (const initial of [[], [5]]) {
			for (const [, $list] of bothKinds(initial)) {
				unsubscribes.push(
					effect((): void => {
						$list.sort()
					})
				)
				unsubscribes.push(
					effect((): void => {
						$list.reverse()
					})
				)
				assert.deepStrictEqual([...$list], initial)
			}
		}
	})

	it('lets a child effect push onto a reactive array without raising', (): void => {
		for (const [, $list] of bothKinds([])) {
			unsubscribes.push(
				effect((): void => {
					effect((): void => {
						$list.push(1)
					})
				})
			)
			assert.deepStrictEqual([...$list], [1])
		}
	})

	it('lets a microtask effect push until length reaches 3 without raising', async (): Promise<void> => {
		for (const [, $list] of bothKinds([])) {
			unsubscribes.push(
				effect(
					(): void => {
						if ($list.length < 3) $list.push(1)
					},
					undefined,
					undefined,
					{ schedule: 'microtask' }
				)
			)
			// One microtask flush per push: three pushes, one spare turn to prove it stops
			for (let turn = 0; turn < 4; turn++) {
				await new Promise<void>((resolve): void => queueMicrotask(resolve))
			}
			assert.deepStrictEqual([...$list], [1, 1, 1])
		}
	})
})
