import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { state, effect, derive, batch } from '../src/index.ts'

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
describe('Infinite Loop Detection', { concurrency: true, timeout: 1000 }, (): void => {
	it('should detect direct infinite loops in effects (read + write to same state)', (): void => {
		const count = state(0)
		let errorThrown = false

		try {
			effect((): void => {
				const currentCount = count()
				count.set(currentCount + 1)
			})

			// Trigger another update to cause the error
			count.set(10)
		} catch (error) {
			errorThrown = true
			assert.ok(
				error instanceof Error && error.message.includes('Infinite loop detected'),
				`Expected infinite loop error, but got: ${error}`
			)
		}

		assert.strictEqual(errorThrown, true, 'An infinite loop error should have been thrown')
	})

	it('should allow a single read-write cycle but prevent infinite loops', (): void => {
		const counter = state(5)
		const values: number[] = []
		let errorThrown = false
		let effectRanCount = 0

		try {
			effect((): void => {
				effectRanCount++
				const current = counter()
				values.push(current)
				counter.set(current + 1)
			})

			// Trigger the effect again with a new value
			counter.set(10)
		} catch (error) {
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
		const source = state(0)
		const target = state(0)
		let effectRunCount = 0

		// This pattern is safe: source → target (different states)
		const dispose = effect((): void => {
			effectRunCount++
			// Read from source, write to target
			target.set(source() * 2)
		})

		// Reset counter after initial effect run
		effectRunCount = 0

		// Update source several times
		source.set(1)
		source.set(2)
		source.set(3)

		// Check final values
		assert.strictEqual(source(), 3)
		assert.strictEqual(target(), 6)
		assert.strictEqual(effectRunCount, 3, 'Effect should run once per update')

		dispose()
	})

	it('should not catch infinite loop error in safe complex update patterns', (): void => {
		// Setup multiple states in a chain
		const a = state(1)
		const b = state(2)
		const c = state(3)
		let errorThrown = false

		try {
			// First effect creates a safe dependency: a → b
			effect((): void => {
				b.set(a() * 2)
			})

			// Second effect creates another safe chain: b → c
			effect((): void => {
				c.set(b() + 1)
			})

			// This effect creates the dangerous cycle: c → a
			// This completes a cycle: a → b → c → a
			effect((): void => {
				const cValue = c()
				a.set(cValue)
			})

			// Trigger the cycle
			a.set(5)
		} catch (error) {
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
		const baseState = state(5)
		let errorThrown = false

		try {
			// Create a derived state that depends on the base state
			const derivedResult = derive((): number => {
				return baseState() * 2
			})

			// This effect creates a cycle: derivedResult → baseState
			effect((): void => {
				const value = derivedResult()
				baseState.set(value)
			})

			// Trigger the cycle
			baseState.set(10)
		} catch (error) {
			errorThrown = true
			assert.ok(
				error instanceof Error && error.message.includes('Infinite loop detected'),
				`Expected infinite loop error, but got: ${error}`
			)
		}

		assert.strictEqual(errorThrown, false, 'No infinite loop error should have been thrown')
	})

	it('should detect infinite loops even with conditional logic', (): void => {
		const counter = state(2)
		let errorThrown = false

		try {
			effect((): void => {
				const current = counter()
				// Only write back for even values
				if (current % 2 === 0) {
					counter.set(current + 1)
				}
			})
		} catch (error) {
			errorThrown = true
			assert.ok(
				error instanceof Error && error.message.includes('Infinite loop detected'),
				`Expected infinite loop error, but got: ${error}`
			)
		}

		assert.strictEqual(errorThrown, true, 'An infinite loop error should have been thrown')
	})

	it('should detect infinite loops in effects created inside batches', (): void => {
		const value = state(10)
		let errorThrown = false

		try {
			// Batch operation that creates an effect with a potential infinite loop
			batch((): void => {
				// Set initial value
				value.set(20)

				// Create effect inside batch that creates an infinite loop
				effect((): void => {
					const _currentValue = value()
					value.set(42)
				})

				// Another update inside the batch
				value.set(30)
			})
		} catch (error) {
			errorThrown = true
			assert.ok(
				error instanceof Error && error.message.includes('Infinite loop detected'),
				`Expected infinite loop error, but got: ${error}`
			)
		}

		assert.strictEqual(errorThrown, true, 'An infinite loop error should have been thrown')
	})

	it('should detect infinite loops in oscillating patterns', (): void => {
		const a = state(5)
		let errorThrown = false

		try {
			// Create an effect that reads and writes to the same state
			effect((): void => {
				const currentValue = a()
				// Negate the value - would cause oscillation
				a.set(-currentValue)
			})

			// Trigger the effect
			a.set(10)
		} catch (error) {
			errorThrown = true
			assert.ok(
				error instanceof Error && error.message.includes('Infinite loop detected'),
				`Expected infinite loop error, but got: ${error}`
			)
		}

		assert.strictEqual(errorThrown, true, 'An infinite loop error should have been thrown')
	})
})
