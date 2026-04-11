import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { batch, derive, effect, state } from '../src/index.ts'

/**
 * Tests for cyclical dependencies between states.
 *
 * These tests verify how the library handles situations where states form
 * dependency cycles. The tests establish specifications for how cyclic dependencies
 * should be handled by the reactive system.
 *
 * These tests focus on indirect cycles formed by multiple effects and states
 * that create circular dependencies, but where each individual effect only
 * depends on states it doesn't directly modify (therefore not triggering
 * the infinite loop detection).
 *
 * Key behaviors to test:
 * - Stabilization of cycles (convergence, oscillation, or divergence)
 * - Cycle breaking mechanisms
 * - Performance and memory impact
 * - Different cycle patterns (diamonds, complex chains)
 */
describe('Cyclic Dependencies', {
	concurrency: false,
	timeout: 1000,
}, (): void => {
	it('should eventually stabilize direct cyclic dependencies between states', (): void => {
		// Set up two signals with initial values
		const $signalA = state({
			value: 1,
		})
		const $signalB = state({
			value: 10,
		})

		// Track values for convergence analysis
		const aValues: number[] = []
		const bValues: number[] = []
		// Use a non-empty array with known index 0
		const executionCount = [
			0,
		]

		// Set up effects that create the cycle:
		// A changes → update B → B changes → update A → ...

		// When A changes, update B = A * 2
		const unsubscribeA = effect((): void => {
			const valueA = $signalA.value
			aValues.push(valueA)
			$signalB.value = valueA * 2
			// Safe incrementing
			if (executionCount[0] !== undefined) {
				executionCount[0] += 1
			}
		})

		// When B changes, update A = B / 2
		const unsubscribeB = effect((): void => {
			const valueB = $signalB.value
			bValues.push(valueB)

			// Only update if the computed value is different
			// This breaks the cycle when values stabilize
			const newA = valueB / 2
			if (newA !== $signalA.value) {
				$signalA.value = newA
			}
		})

		// Trigger the cycle with a new value for A
		$signalA.value = 5

		// Assert the system stabilized at the expected values
		assert.strictEqual($signalA.value, 5, 'signalA should stabilize at 5')
		assert.strictEqual($signalB.value, 10, 'signalB should stabilize at 10')

		assert.deepStrictEqual(
			aValues,
			[
				1,
				5,
			],
			'A values should match expected history'
		)
		assert.deepStrictEqual(
			bValues,
			[
				2,
				10,
			],
			'B values should match expected history'
		)

		// For this specific test case, we consider it "stabilized" because:
		// 1. We know the exact expected values
		// 2. The cycle has logically completed with the if-condition preventing further updates
		// 3. There's no need to change values further to reach a stable state

		const lastValueA = aValues.at(-1) ?? 0
		const lastValueB = bValues.at(-1) ?? 0
		assert.strictEqual(lastValueB / 2, lastValueA, 'Last B/2 should equal last A, proving cycle stabilized')

		unsubscribeA()
		unsubscribeB()
	})

	it('should stabilize derived signals with cyclic dependencies', (): void => {
		const $source = state({
			value: 5,
		})
		const valueHistory: Array<{
			a: number
			b: number
		}> = []

		// Pre-declare variables to allow cross-references
		let $signalA: ReturnType<typeof derive<number>>
		let $signalB: ReturnType<typeof derive<number>>

		// Setup derived signals with circular dependency
		$signalA = derive((): number => {
			// A depends on source and B
			const b = $signalB?.value ? $signalB.value : 10 // Initial case when B isn't defined yet
			return $source.value + b / 10
		})

		$signalB = derive((): number => {
			// B depends on A
			return $signalA?.value ? $signalA.value * 2 : 0
		})

		// Monitor values to detect stabilization
		effect((): void => {
			valueHistory.push({
				a: $signalA.value as number,
				b: $signalB.value as number,
			})
		})

		// Record initial values
		const initialA = $signalA.value
		const initialB = $signalB.value

		// Trigger update to source which should propagate through both signals
		$source.value = 10

		// Get final values
		const finalA = $signalA.value
		const finalB = $signalB.value

		// Check values are finite
		assert.ok(Number.isFinite(finalA), `A should have a finite value, got ${finalA}`)
		assert.ok(Number.isFinite(finalB), `B should have a finite value, got ${finalB}`)

		// Verify values changed from initial state
		assert.notStrictEqual(finalA, initialA, 'A should update after source change')
		assert.notStrictEqual(finalB, initialB, 'B should update after source change')

		// Verify consistent values
		assert.strictEqual(finalB, (finalA as number) * 2, 'Final B value should be A * 2')
		assert.strictEqual(finalA, 10 + (finalB as number) / 10, 'Final A value should be source + B/10')
	})

	it('should stabilize cycles between multiple states and prevent infinite loops', (): void => {
		// Create a cycle: A → B → C → A
		const $signalA = state({
			value: 5,
		})
		const $signalB = state({
			value: 10,
		})
		const $signalC = state({
			value: 15,
		})

		// Track values and update count
		const aValues: number[] = []
		const bValues: number[] = []
		const cValues: number[] = []

		// Add debugging log arrays
		const debugLog: string[] = []

		// Set up effects to create the cycle
		effect((): void => {
			// A changes → update B
			const a = $signalA.value
			aValues.push(a)

			$signalB.value = a * 2
		})

		effect((): void => {
			// B changes → update C
			const b = $signalB.value
			bValues.push(b)

			$signalC.value = b + 5
		})

		effect((): void => {
			effect((): void => {
				// C changes → update A (completing the cycle)
				const c = $signalC.value
				cValues.push(c)

				// Include a condition that will eventually break the cycle
				const newA = Math.min(c / 5, 20)

				// Use epsilon comparison instead of strict equality
				if (Math.abs(newA - $signalA.value) > 1e-10) {
					$signalA.value = newA
				}
			})
		})

		// Reset counter before triggering the cycle
		aValues.length = 0
		bValues.length = 0
		cValues.length = 0
		debugLog.length = 0

		// Trigger the cycle
		$signalA.value = 7

		// Check values are finite (not NaN or Infinity)
		assert.ok(Number.isFinite($signalA.value), `A should have a finite value, got ${$signalA.value}`)
		assert.ok(Number.isFinite($signalB.value), `B should have a finite value, got ${$signalB.value}`)
		assert.ok(Number.isFinite($signalC.value), `C should have a finite value, got ${$signalC.value}`)

		// Verify values eventually stabilized
		assert.ok(hasStabilized(aValues, 3, 2), `A values should stabilize, got: ${aValues.join(', ')}`)
		assert.ok(hasStabilized(bValues, 3, 2), `B values should stabilize, got: ${bValues.join(', ')}`)
		assert.ok(hasStabilized(cValues, 3, 2), `C values should stabilize, got: ${cValues.join(', ')}`)

		// Check final values are consistent with update rules
		assert.strictEqual($signalB.value, $signalA.value * 2, 'Final B should be A * 2')
		assert.strictEqual($signalC.value, $signalB.value + 5, 'Final C should be B + 5')
	})

	it('should handle diamond dependencies correctly (A → B, A → C, B+C → D)', (): void => {
		// Create a diamond structure
		const $parent = state({
			value: 10,
		})

		// Children depend on parent
		const $childB = derive((): number => $parent.value * 2)
		const $childC = derive((): number => $parent.value / 2)

		// D depends on both B and C
		const $childD = derive((): number => ($childB.value as number) + ($childC.value as number))

		// Track updates
		let updateCount = 0
		const dValues: number[] = []

		effect((): void => {
			dValues.push($childD.value as number)
			updateCount++
		})

		// Reset counters after initial setup
		updateCount = 0
		dValues.length = 0

		// Verify initial state
		assert.strictEqual($parent.value, 10)
		assert.strictEqual($childB.value, 20)
		assert.strictEqual($childC.value, 5)
		assert.strictEqual($childD.value, 25)

		// Trigger update cascade
		$parent.value = 20

		// Verify D received exactly one update
		assert.strictEqual(updateCount, 1, 'D should update exactly once when parent changes')
		assert.strictEqual(dValues.length, 1, 'D should have exactly one new value')
		assert.strictEqual(dValues[0], 50, 'D should equal 20*2 + 20/2 = 50')

		// Verify final values
		assert.strictEqual($childB.value, 40)
		assert.strictEqual($childC.value, 10)
		assert.strictEqual($childD.value, 50)
	})

	it('should handle cycle with convergent behavior (diminishing changes)', (): void => {
		// Create a cycle where updates get smaller each time
		// This should naturally converge
		const $a = state({
			value: 10,
		})

		// Track updates and values
		const aValues: number[] = []
		const bValues: number[] = []

		// B will be 90% of A (0.9 factor)
		const $b = derive((): number => $a.value * 0.9)

		// Create cycle: A depends on B
		effect((): void => {
			const bVal = $b.value as number
			bValues.push(bVal)

			// A becomes new B value
			// This should converge since each cycle reduces value by 10%
			$a.value = bVal
			aValues.push($a.value)
		})

		// Reset for test
		aValues.length = 0
		bValues.length = 0

		// Trigger convergent cycle
		$a.value = 100

		// Assert cycle converged to a very small number
		assert.ok($a.value < 1, `A should converge near zero, got ${$a.value}`)
		// assert.ok(updateCount < 50, `Should converge within 50 iterations, took ${updateCount}`)

		// Verify that values eventually stabilized (convergence)
		const errorMargin = 0.001 // Allow small floating point differences
		const lastValues = aValues.slice(-3)

		// Check if the last few values are very close (within error margin)
		if (lastValues.length >= 2) {
			for (let i = 1; i < lastValues.length; i++) {
				assert.ok(
					Math.abs((lastValues[i] as number) - (lastValues[i - 1] as number)) < errorMargin,
					'Values should converge with small differences near the end'
				)
			}
		}
	})

	it('should handle cycle with divergent behavior but break before overflow', (): void => {
		// Create a cycle where updates get larger each time
		// This would diverge to infinity without a breaker
		const $a = state({
			value: 1,
		})

		// Track updates and values
		let updateCount = 0
		const aValues: number[] = []
		const bValues: number[] = []

		// B will be double A (2.0 factor) - this would diverge to infinity
		const $b = derive((): number => $a.value * 2)

		// Create cycle: A depends on B
		effect((): void => {
			const bVal = $b.value
			if (bVal) {
				bValues.push(bVal)

				// Safety breaker: only update A if B is below a threshold
				// This prevents infinite growth while letting the cycle run
				if (bVal < 1000) {
					$a.value = bVal
					aValues.push($a.value)
				}
				updateCount++
			}
		})

		// Reset for test
		updateCount = 0
		aValues.length = 0
		bValues.length = 0

		// Trigger divergent cycle
		$a.value = 1

		// Assert cycle stopped before Infinity
		assert.ok(Number.isFinite($a.value), `A should remain finite, got ${$a.value}`)
		assert.ok(updateCount < 20, `Cycle should break in reasonable time, took ${updateCount} updates`)

		// Verify the safety breaker kicked in
		assert.ok(
			$a.value < 1000 && ($b.value as number) >= 1000,
			'Safety breaker should have stopped updates at the threshold'
		)
	})

	it('should allow manual cycle detection and breaking', (): void => {
		// This test demonstrates how cycles can be manually detected and broken
		const $a = state({
			generation: 0,
			value: 5,
		})
		const $b = state({
			generation: 0,
			value: 10,
		})

		// Track update counts for cycle detection
		let aUpdateCount = 0
		let bUpdateCount = 0

		// Track values for testing
		const aValues: Array<{
			value: number
			generation: number
		}> = []
		const bValues: Array<{
			value: number
			generation: number
		}> = []

		// Create cycle with generation tracking for cycle detection
		effect((): void => {
			const currentA = $a
			aValues.push({
				...currentA,
			})

			// Update B, incrementing generation
			$b.value = currentA.value * 2
			$b.generation = currentA.generation + 1
			aUpdateCount++
		})

		effect((): void => {
			const currentB = $b
			bValues.push({
				...currentB,
			})

			// Only update A if we haven't exceeded generation limit (cycle breaker)
			// This demonstrates a manual cycle detection mechanism
			if (currentB.generation < 5) {
				$a.value = currentB.value / 2
				$a.generation = currentB.generation + 1
			}
			bUpdateCount++
		})

		// Reset counters
		aUpdateCount = 0
		bUpdateCount = 0
		aValues.length = 0
		bValues.length = 0

		// Trigger the cycle
		$a.value = 20
		$a.generation = 0

		// Check that values stabilized due to the generation limit
		assert.ok(aUpdateCount < 10, `A updates should be limited, got ${aUpdateCount}`)
		assert.ok(bUpdateCount < 10, `B updates should be limited, got ${bUpdateCount}`)

		// Check that generation tracking worked
		assert.ok(aValues.length > 0 && bValues.length > 0, 'Values should be tracked for A and B')

		// Verify the cycle was broken at the right generation
		if (bValues.length > 0) {
			const lastB = bValues.at(-1)
			assert.ok(lastB && lastB.generation <= 5, `Last B generation should not exceed limit, got ${lastB?.generation}`)
		}
	})

	it('should remain responsive after cycles are broken', (): void => {
		// Verify system remains responsive after a cycle is broken
		const $a = state({
			value: 5,
		})
		const $b = state({
			value: 10,
		})

		// Value trackers
		const aResponses: number[] = []
		const bResponses: number[] = []

		// Create a cycle with a breaker
		let cycleIterations = 0

		// A affects B
		effect((): void => {
			const aVal = $a.value
			$b.value = aVal * 2
			cycleIterations++
		})

		// B affects A - but only for 5 iterations
		effect((): void => {
			const bVal = $b.value
			if (cycleIterations < 5) {
				$a.value = bVal / 2
			}
		})

		// Monitor values
		effect((): void => {
			aResponses.push($a.value)
		})
		effect((): void => {
			bResponses.push($b.value)
		})

		// Reset for test
		aResponses.length = 0
		bResponses.length = 0

		// Trigger the cycle
		$a.value = 20

		// Verify the cycle was broken
		assert.ok(cycleIterations <= 6, 'Cycle should be limited to 5-6 iterations')

		// Check system responsiveness after cycle
		$a.value = 30

		// Verify the system still responds to new inputs
		assert.strictEqual($a.value, 30, 'A should update to new value after cycle')
		assert.strictEqual($b.value, 60, 'B should respond to A changes after cycle')

		// Check that both signals recorded responses after the cycle
		assert.ok(aResponses.includes(30), 'A should record changes after cycle is broken')
		assert.ok(bResponses.includes(60), 'B should record changes after cycle is broken')
	})

	it('should handle multiple independent cycles simultaneously', (): void => {
		// Test multiple independent cycles running simultaneously
		const $a1 = state({
			value: 5,
		})
		const $b1 = state({
			value: 10,
		})
		const $a2 = state({
			value: 15,
		})
		const $b2 = state({
			value: 30,
		})

		// Cycle counters
		let cycle1Count = 0
		let cycle2Count = 0

		// Setup first cycle
		effect((): void => {
			$a1.value = $b1.value / 2
			cycle1Count++
		})

		effect((): void => {
			// Break after 5 iterations
			if (cycle1Count < 5) {
				$b1.value = $a1.value * 2
			}
		})

		// Setup second cycle
		effect((): void => {
			$a2.value = $b2.value / 3
			cycle2Count++
		})

		effect((): void => {
			// Break after 8 iterations
			if (cycle2Count < 8) {
				$b2.value = $a2.value * 3
			}
		})

		// Reset counters
		cycle1Count = 0
		cycle2Count = 0

		// Trigger both cycles
		batch((): void => {
			$a1.value = 6
			$a2.value = 20
		})

		// Verify both cycles ran and stabilized independently
		assert.ok(cycle1Count <= 6, 'First cycle should be limited to ~5-6 iterations')
		assert.ok(cycle2Count <= 9, 'Second cycle should be limited to ~8-9 iterations')

		// Cycles should be independent
		assert.strictEqual($a1.value * 2, $b1.value, 'First cycle values should be consistent')
		assert.strictEqual($a2.value * 3, $b2.value, 'Second cycle values should be consistent')
	})
})

/**
 * Helper function to detect if a system has stabilized
 * Stabilization is defined as no significant value changes for a specified number of iterations
 *
 * @param values Array of values to check for stabilization
 * @param minLength Minimum number of values required before checking stabilization
 * @param stableCount Number of consecutive values that must be stable
 * @returns boolean indicating whether the system has stabilized
 */
function hasStabilized<T>(values: T[], minLength: number, stableCount: number): boolean {
	// Ensure we have enough values to check
	if (values.length < minLength) {
		return false
	}

	// Get the last "stableCount" values to analyze
	const lastValues = values.slice(-stableCount)
	const firstValue = lastValues[0]

	// Consistent epsilon for all number comparisons
	const Epsilon = 0.001

	// Case 1: All values are numbers - check for bounded oscillation
	if (lastValues.every((val) => typeof val === 'number')) {
		const numValues = lastValues as number[]
		const min = Math.min(...numValues)
		const max = Math.max(...numValues)

		// If the oscillation is within a small range, consider it stable
		return max - min < Epsilon
	}

	// Case 2: Mixed types or non-numbers - compare each value with the first
	return lastValues.every((val) => {
		// Special handling for number comparisons to handle floating point issues
		if (typeof val === 'number' && typeof firstValue === 'number') {
			return Math.abs(val - firstValue) < Epsilon
		}

		// For all other types, use reference equality
		return Object.is(val, firstValue)
	})
}
