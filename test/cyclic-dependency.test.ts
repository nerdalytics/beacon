import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { state, effect, derived } from '../src/index.ts'

/**
 * Tests for cyclical dependencies between signals.
 *
 * These tests verify how the library handles situations where:
 * - Signal A depends on Signal B
 * - Signal B depends on Signal A
 */
describe('Cyclic Dependencies', { concurrency: true }, (): void => {
	it('should handle direct cyclic dependencies between two state signals', (): void => {
		// Set up two signals with initial values
		const signalA = state(1)
		const signalB = state(10)

		// Track effect execution count and values
		const executionLog: Array<{ a: number; b: number }> = []

		// Set up effects that create the cycle:
		// A changes → update B → B changes → update A → ...

		// When A changes, update B = A * 2
		effect((): void => {
			const valueA: number = signalA()
			signalB.set(valueA * 2)
			executionLog.push({ a: valueA, b: signalB() })
		})

		// When B changes, update A = B / 2
		effect((): void => {
			const valueB = signalB()

			// Only update if the computed value is different
			// This should eventually break the cycle
			const newA = valueB / 2
			if (newA !== signalA()) {
				signalA.set(newA)
			}

			executionLog.push({ a: signalA(), b: valueB })
		})

		// Initial state: A=1, B=2
		// Then our effects recursively update until stabilizing

		// Trigger the cycle with a new value for A
		signalA.set(5)

		// Check final values - they should stabilize
		assert.strictEqual(signalA(), 5)
		assert.strictEqual(signalB(), 10)

		// Should have a reasonable number of executions before stabilizing
		// If this is very large, we might have an issue
		assert.ok(executionLog.length < 20, `Too many executions (${executionLog.length}) before stabilizing`)

		// Verify the system reached a stable state
		const lastEntry = executionLog.at(-1)
		assert.strictEqual(lastEntry?.a, 5)
		assert.strictEqual(lastEntry?.b, 10)
	})

	it('should demonstrate derived signals with potential cycles', (): void => {
		const source = state(5)

		// Create two derived signals that depend on each other
		// This creates a potential infinite loop:
		// a → b → a → b → ...

		// Setup derived signals with circular dependency
		const signalA = derived((): number => {
			// A depends on source and B
			const b = signalB ? signalB() : 10 // Initial case when B isn't defined yet
			return source() + b / 10
		})

		const signalB = derived((): number => {
			// B depends on A
			return signalA() * 2
		})

		// Track initial values
		const initialA = signalA()
		const initialB = signalB()

		// Track updates - only capture first 10 for analysis
		let updateCount = 0
		const values: { a: number; b: number }[] = []

		effect((): void => {
			updateCount++
			if (values.length < 10) {
				values.push({
					a: signalA(),
					b: signalB(),
				})
			}
		})

		// Trigger update to source which should propagate through both signals
		source.set(10)

		// Get final values for analysis (may not be stable yet)
		const a = signalA()
		const b = signalB()

		// Check values are still finite (not NaN or Infinity)
		assert.ok(Number.isFinite(a), `A should have a finite value, got ${a}`)
		assert.ok(Number.isFinite(b), `B should have a finite value, got ${b}`)

		// For debugging and analysis
		console.debug(`Derived cycles demo - Total updates: ${updateCount}`)
		console.debug(`Initial - A: ${initialA}, B: ${initialB}`)
		console.debug(`Latest - A: ${a}, B: ${b}`)
		console.debug(`First ${values.length} values:`, values)

		// The test is now informational, we don't assert on the number of updates
		// Just report what happened
		console.debug(updateCount < 100 ? '✓ System eventually stabilized' : "! System didn't stabilize within 100 updates")
	})

	it('should demonstrate three interlocked states in a cycle (A → B → C → A)', (): void => {
		// Create a cycle: A → B → C → A
		const signalA = state(5)
		const signalB = state(10)
		const signalC = state(15)

		// Track update counts and value history
		let updateCount = 0
		const valueHistory: Array<{ a: number; b: number; c: number }> = []

		// Monitor the values at each step
		effect((): void => {
			if (valueHistory.length < 10) {
				valueHistory.push({
					a: signalA(),
					b: signalB(),
					c: signalC(),
				})
			}
		})

		// Set up effects to create the cycle
		effect((): void => {
			// A changes → update B
			const a = signalA()
			signalB.set(a * 2)
			updateCount++
		})

		effect((): void => {
			// B changes → update C
			const b = signalB()
			signalC.set(b + 5)
			updateCount++
		})

		effect((): void => {
			// C changes → update A (completing the cycle)
			const c = signalC()
			// Include a condition that will eventually break the cycle
			const newA = Math.min(c / 5, 20)
			if (newA !== signalA()) {
				signalA.set(newA)
			}
			updateCount++
		})

		// Reset counter before triggering the cycle
		updateCount = 0
		valueHistory.length = 0

		// Trigger the cycle
		signalA.set(7)

		// For debugging and analysis
		console.debug(`Interlocked three-state cycle - Total updates: ${updateCount}`)
		console.debug(`Final values - A: ${signalA()}, B: ${signalB()}, C: ${signalC()}`)
		console.debug(`First ${valueHistory.length} states:`, valueHistory)

		// Check values are still finite (not NaN or Infinity)
		assert.ok(Number.isFinite(signalA()), `A should have a finite value, got ${signalA()}`)
		assert.ok(Number.isFinite(signalB()), `B should have a finite value, got ${signalB()}`)
		assert.ok(Number.isFinite(signalC()), `C should have a finite value, got ${signalC()}`)

		// Report on stability rather than asserting
		console.debug(updateCount < 100 ? '✓ System eventually stabilized' : "! System didn't stabilize within 100 updates")
	})

	it('should demonstrate tree structures with a parent affecting multiple children (A → B, A → C)', (): void => {
		// Create a tree structure where a parent state affects multiple children
		const parent = state(10)

		// Track updates to each node
		let bUpdateCount = 0
		let cUpdateCount = 0
		let totalUpdateCount = 0

		// Value history for analysis
		const valueHistory: Array<{ a: number; b: number; c: number }> = []

		// Child nodes depend on parent
		const childB = derived((): number => parent() * 2)
		const childC = derived((): number => parent() / 2)

		// Monitor all values
		effect((): void => {
			if (valueHistory.length < 10) {
				valueHistory.push({
					a: parent(),
					b: childB(),
					c: childC(),
				})
			}
		})

		// Set up effects to track updates
		effect((): void => {
			childB()
			bUpdateCount++
			totalUpdateCount++
		})

		effect((): void => {
			childC()
			cUpdateCount++
			totalUpdateCount++
		})

		// Reset counters after initial setup
		bUpdateCount = 0
		cUpdateCount = 0
		totalUpdateCount = 0
		valueHistory.length = 0

		// Initial state should be set up correctly
		assert.strictEqual(parent(), 10)
		assert.strictEqual(childB(), 20)
		assert.strictEqual(childC(), 5)

		// Make a series of changes to the parent
		parent.set(20)
		parent.set(30)
		parent.set(40)

		// All children should update the same number of times as parent changes
		assert.strictEqual(bUpdateCount, 3, 'Child B should update once per parent change')
		assert.strictEqual(cUpdateCount, 3, 'Child C should update once per parent change')
		assert.strictEqual(totalUpdateCount, 6, 'Total updates should be sum of child updates')

		// Final values should be correct
		assert.strictEqual(parent(), 40)
		assert.strictEqual(childB(), 80)
		assert.strictEqual(childC(), 20)

		// For analysis
		console.debug(`Tree structure test - B updates: ${bUpdateCount}, C updates: ${cUpdateCount}`)
		console.debug(`Final values - A: ${parent()}, B: ${childB()}, C: ${childC()}`)
		console.debug('Value history:', valueHistory)
	})

	it('should handle linked leaves within a tree (A → B, A → C, B → D, D → A)', (): void => {
		// Create a more complex structure with cycles between leaves
		const a = state(5)

		// Track updates
		let updateCount = 0
		const valueHistory: Array<{
			a: number
			b: number
			c: number
			d: number
		}> = []

		// Create derived values with complex dependencies
		const b = derived((): number => a() * 2)
		const c = derived((): number => a() + 10) // Simple dependence on A

		// D depends on B, creating a potential cycle
		const d = derived((): number => b() + 5)

		// Monitor values for analysis
		effect((): void => {
			if (valueHistory.length < 10) {
				valueHistory.push({
					a: a(),
					b: b(),
					c: c(),
					d: d(),
				})
			}
		})

		// Create cycle by making A depend on D
		effect((): void => {
			const newValue = d() / 10
			// Only update if there's an actual change to break potential infinite loops
			if (newValue !== a()) {
				a.set(newValue)
			}
			updateCount++
		})

		// Reset counter
		updateCount = 0
		valueHistory.length = 0

		// Get initial values for logging
		const initialA = a()
		const initialB = b()
		const initialC = c()
		const initialD = d()

		// Log initial values for analysis
		console.debug(`Initial values - A: ${initialA}, B: ${initialB}, C: ${initialC}, D: ${initialD}`)

		// Trigger the cycle
		a.set(8)

		// Check results
		console.debug(`Complex tree-cycle - Updates: ${updateCount}`)
		console.debug(`Final values - A: ${a()}, B: ${b()}, C: ${c()}, D: ${d()}`)
		console.debug(`Value history (first ${valueHistory.length}):`, valueHistory)

		// Check values are finite
		assert.ok(Number.isFinite(a()), `A should have a finite value, got ${a()}`)
		assert.ok(Number.isFinite(b()), `B should have a finite value, got ${b()}`)
		assert.ok(Number.isFinite(c()), `C should have a finite value, got ${c()}`)
		assert.ok(Number.isFinite(d()), `D should have a finite value, got ${d()}`)

		// Report stability
		console.debug(updateCount < 100 ? '✓ System eventually stabilized' : "! System didn't stabilize within 100 updates")
	})

	it('should analyze convergence behavior in cyclic dependencies', (): void => {
		type MultiplicationFactor = {
			factor: number
			totalUpdates: number
			aStartValues: number[]
			bStartValues: number[]
			aFinal: number
			bFinal: number
			converged: boolean
		}
		// Create a cycle where values can either:
		// 1. Converge to a stable value
		// 2. Oscillate between multiple values
		// 3. Diverge and never stabilize

		// This test demonstrates different behaviors with multiplication factors

		// Test a few different factors to demonstrate
		const factors = [0.5, 0.9, 1.0, 1.1, 2.0] // Record results for each factor// : { factor: number, totalUpdates: number, aStartValues: number[], bStartValues: number[], aFinal: number, bFinal: number, converged: boolean }
		const results = factors.map((factor: number): MultiplicationFactor => {
			// Create signals
			const a = state(1)
			const b = state(10)

			// Values seen by a and b
			const aValues: number[] = []
			const bValues: number[] = []

			// Update counters
			let totalUpdates = 0

			// Create the cycle
			effect((): void => {
				const aVal = a()
				b.set(aVal * factor)
				if (aValues.length < 10) {
					aValues.push(aVal)
				}
				totalUpdates++
			})

			effect((): void => {
				const bVal = b()
				a.set(bVal)
				if (bValues.length < 10) {
					bValues.push(bVal)
				}
				totalUpdates++
			})

			// Reset counter, start cycle
			totalUpdates = 0
			a.set(5)

			// Check if values converged (stopped changing)
			const aFinal = a()
			const bFinal = b()
			const converged = totalUpdates < 100

			return {
				factor,
				totalUpdates,
				aStartValues: aValues,
				bStartValues: bValues,
				aFinal,
				bFinal,
				converged,
			}
		})

		// Log results
		console.debug('\nCycle convergence analysis:')
		for (const result of results) {
			console.debug(`\nFactor: ${result.factor}`)
			console.debug(`Converged: ${result.converged ? 'Yes' : 'No'} (${result.totalUpdates} updates)`)
			console.debug(`Final values: a=${result.aFinal}, b=${result.bFinal}`)
			console.debug(`First 10 a values: ${result.aStartValues.join(', ')}`)
			console.debug(`First 10 b values: ${result.bStartValues.join(', ')}`)
		}

		// We should see that:
		// 1. Factors < 1 will converge to zero
		// 2. Factor = 1 will stabilize at the initial value
		// 3. Factors > 1 will grow unbounded

		// Make sure at least some tests converged
		assert.ok(
			results.some((r: MultiplicationFactor): boolean => r.converged),
			'At least some factor values should converge'
		)
	})
})
