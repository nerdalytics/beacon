import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { batch, derive, effect, state } from '../src/index.ts'

describe('Derive', { concurrency: true, timeout: 1000 }, (): void => {
	it('should compute derived value', (): void => {
		const count = state(0)
		const doubled = derive((): number => count() * 2)
		assert.strictEqual(doubled(), 0)
	})

	it('should update when dependencies change', (): void => {
		const count = state(0)
		const doubled = derive((): number => count() * 2)
		count.set(1)
		assert.strictEqual(doubled(), 2)
	})

	it('should work with multiple dependencies', (): void => {
		const a = state(1)
		const b = state(2)
		const sum = derive((): number => a() + b())

		assert.strictEqual(sum(), 3)

		a.set(2)
		assert.strictEqual(sum(), 4)

		b.set(3)
		assert.strictEqual(sum(), 5)
	})

	it('should handle nested computations', (): void => {
		const count = state(0)
		const doubled = derive((): number => count() * 2)
		const quadrupled = derive((): number => doubled() * 2)

		assert.strictEqual(quadrupled(), 0)

		count.set(1)
		assert.strictEqual(doubled(), 2)
		assert.strictEqual(quadrupled(), 4)
	})

	it('should only recompute when necessary', (): void => {
		let computeCount = 0

		const a = state(1)
		const b = state(2)

		const sum = derive((): number => {
			computeCount++
			return a() + b()
		})

		// Verify initial computation occurs once
		assert.strictEqual(sum(), 3)
		assert.strictEqual(computeCount, 1)

		// Verify value is memoized for subsequent reads
		assert.strictEqual(sum(), 3)
		assert.strictEqual(sum(), 3)
		assert.strictEqual(computeCount, 1)

		// Verify dependency change triggers recomputation
		a.set(2)
		assert.strictEqual(sum(), 4)
		assert.strictEqual(computeCount, 2)

		// Verify memoization after dependency update
		assert.strictEqual(sum(), 4)
		assert.strictEqual(sum(), 4)
		assert.strictEqual(computeCount, 2)
	})

	it('should handle different data types', (): void => {
		const name = state('John')
		const greeting = derive((): string => `Hello, ${name()}!`)

		assert.strictEqual(greeting(), 'Hello, John!')

		name.set('Jane')
		assert.strictEqual(greeting(), 'Hello, Jane!')
	})

	it('should handle same-value updates', (): void => {
		let computeCount = 0
		const count = state(5)

		const doubled = derive((): number => {
			computeCount++
			return count() * 2
		})

		assert.strictEqual(doubled(), 10)
		assert.strictEqual(computeCount, 1)

		// Update state with the same value
		count.set(5)

		// Read the value again
		doubled()

		// Verify the derived value is correct
		assert.strictEqual(doubled(), 10)
	})

	it('should dynamically track dependencies based on execution path', (): void => {
		const condition = state(true)
		const a = state(5)
		const b = state(10)

		let aReadCount = 0
		let bReadCount = 0

		// Functions to track when each state is read
		const trackA = (): number => {
			aReadCount++
			return a()
		}
		const trackB = (): number => {
			bReadCount++
			return b()
		}

		const value = derive((): number => {
			return condition() ? trackA() : trackB()
		})

		// Verify first branch works with a dependency
		assert.strictEqual(value(), 5)
		assert.strictEqual(aReadCount, 1)

		// Verify switching condition changes the active dependency
		condition.set(false)
		assert.strictEqual(value(), 10)
		assert.strictEqual(bReadCount >= 1, true)
	})

	it('should work with batch updates correctly', (): void => {
		let computeCount = 0
		const a = state(1)
		const b = state(2)

		const sum = derive((): number => {
			computeCount++
			return a() + b()
		})

		assert.strictEqual(sum(), 3)
		assert.strictEqual(computeCount, 1)

		// Update multiple dependencies in a batch
		batch((): void => {
			a.set(10)
			b.set(20)
		})

		// Verify final value after batch completes
		assert.strictEqual(sum(), 30)
	})

	it('should propagate errors from computation function', (): void => {
		const toggle = state(false)

		const problematic = derive((): string => {
			if (toggle()) {
				throw new Error('Computation error')
			}
			return 'OK'
		})

		// Initially fine
		assert.strictEqual(problematic(), 'OK')

		// Should throw when the dependency changes
		assert.throws(
			(): void => {
				toggle.set(true) // This will trigger the effect and throw
			},
			{
				name: 'Error',
				message: 'Computation error',
			}
		)

		// After error, setting back should allow recovery
		toggle.set(false)
		assert.strictEqual(problematic(), 'OK')
	})

	it('should update derived values used in effects', (): void => {
		let computeCount = 0
		const count = state(0)

		const doubled = derive((): number => {
			computeCount++
			return count() * 2
		})

		// Create an effect that uses the derived value
		const unsubscribe = effect((): void => {
			doubled() // access derived value
		})

		// Initial computation + effect access
		assert.strictEqual(computeCount > 0, true)

		// Modify the state, should trigger derived recomputation
		count.set(1)
		assert.strictEqual(doubled(), 2)

		// Unsubscribe the effect
		unsubscribe()

		// After unsubscribe, the derived is still valid and can be used
		count.set(2)
		assert.strictEqual(doubled(), 4)
	})

	it('should handle potential circular dependencies', (): void => {
		const a = state(1)
		// biome-ignore lint/style/useConst: purposefully using let
		let derived2: () => number // Declare first to avoid reference error

		const derived1 = derive((): number => {
			const val = a()
			// Now we can safely call derived2 if it exists
			if (derived2) {
				try {
					console.debug('Derived2 value:', derived2())
				} catch (e: unknown) {
					console.debug('Error accessing derived2:', (e as Error).message)
				}
			}
			return val * 2
		})

		// Now initialize derived2
		derived2 = derive((): number => {
			return derived1() + 1
		})

		// This should work without infinite recursion
		assert.strictEqual(derived1(), 2)
		assert.strictEqual(derived2(), 3)

		// System should remain stable
		a.set(2)
		assert.strictEqual(derived1(), 4)
	})
})
