import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { effect, state } from '../src/index.ts'

/**
 * Unit tests for the state with custom equality function.
 *
 * This file tests the custom equality function feature by demonstrating:
 * - Default behavior with Object.is
 * - Custom equality function that always returns false (always triggers updates)
 * - Custom equality function for specific use cases (like logging)
 */
describe('Equality', { concurrency: true, timeout: 1000 }, (): void => {
	// Default behavior (Object.is)
	it('should use Object.is by default for equality checking', (): void => {
		const count = state(0)
		let effectCallCount = 0

		const unsubscribe = effect(() => {
			count() // Subscribe to count
			effectCallCount++
		})

		assert.strictEqual(effectCallCount, 1, 'Effect should run once initially')

		// Set to same value - should not trigger effect
		count.set(0)
		assert.strictEqual(effectCallCount, 1, 'Effect should not run when setting same value')

		// Set to different value - should trigger effect
		count.set(1)
		assert.strictEqual(effectCallCount, 2, 'Effect should run when value changes')

		unsubscribe()
	})

	// Custom equality function that always reports differences
	it('should always update when using custom equality function that returns false', (): void => {
		// Create state with equality function that always returns false
		const alwaysUpdateLog = state('First log', () => false)
		let effectCallCount = 0

		const unsubscribe = effect(() => {
			alwaysUpdateLog() // Subscribe to log
			effectCallCount++
		})

		assert.strictEqual(effectCallCount, 1, 'Effect should run once initially')

		// Set to same value - should still trigger effect with our custom equality function
		alwaysUpdateLog.set('First log')
		assert.strictEqual(effectCallCount, 2, 'Effect should run even when setting same value')

		// Set to same value again - should trigger effect again
		alwaysUpdateLog.set('First log')
		assert.strictEqual(effectCallCount, 3, 'Effect should run again when setting same value')

		unsubscribe()
	})

	// Logging use case demonstration
	it('should support logging use case with reference equality check', (): void => {
		// Create a log state that uses reference equality instead of value equality
		const logState = state<string[]>([], (prev, next) => prev === next) // Reference equality
		let effectCallCount = 0

		const unsubscribe = effect(() => {
			logState() // Subscribe to logs
			effectCallCount++
		})

		assert.strictEqual(effectCallCount, 1, 'Effect should run once initially')

		// Add identical log messages but as new array references
		logState.set(['System started'])
		assert.strictEqual(effectCallCount, 2, 'Effect should run with new array reference')

		// Add same message content but as new array reference
		logState.set(['System started'])
		assert.strictEqual(effectCallCount, 3, 'Effect should run again with another new reference')

		// Demonstrate value equality wouldn't have worked for this use case
		const valueEqualityLog = state<string[]>([])
		let valueEffectCallCount = 0

		const valueUnsubscribe = effect(() => {
			valueEqualityLog() // Subscribe to logs
			valueEffectCallCount++
		})

		valueEqualityLog.set([])
		assert.strictEqual(valueEffectCallCount, 2, 'First empty array change triggers effect')

		// This update might not trigger the effect if arrays with same content are considered equal
		// The behavior depends on how deep the equality check goes (Object.is is shallow)
		valueEqualityLog.set([])
		assert.strictEqual(valueEffectCallCount, 3, 'Second empty array should trigger with Object.is')

		unsubscribe()
		valueUnsubscribe()
	})

	// Custom deep equality function
	it('should support deep equality comparisons', (): void => {
		// Simplified equality function specific to our test case
		// This avoids the complexity warning while still testing the functionality
		const deepEqual = (a: unknown, b: unknown): boolean => {
			// For this test we only need to compare { name: string, details: { age: number } }
			if (a === b) {
				return true
			}

			// If either is not an object, use simple comparison
			if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
				return a === b
			}

			// Safely cast to unknown record types
			const objA = a as Record<string, unknown>
			const objB = b as Record<string, unknown>

			// Check name property
			if (objA.name !== objB.name) {
				return false
			}

			// Check details - we know the specific structure for this test
			if (
				typeof objA.details === 'object' &&
				objA.details !== null &&
				typeof objB.details === 'object' &&
				objB.details !== null
			) {
				const detailsA = objA.details as Record<string, unknown>
				const detailsB = objB.details as Record<string, unknown>
				return detailsA.age === detailsB.age
			}

			return false
		}

		// Create state with deep equality
		const userData = state({ name: 'Alice', details: { age: 30 } }, deepEqual)
		let effectCallCount = 0

		const unsubscribe = effect((): void => {
			userData() // Subscribe to userData
			effectCallCount++
		})

		assert.strictEqual(effectCallCount, 1, 'Effect should run once initially')

		// Set to structurally identical but different reference - should not trigger with deep equality
		userData.set({ name: 'Alice', details: { age: 30 } })
		assert.strictEqual(effectCallCount, 1, 'Effect should not run when setting structurally identical object')

		// Set to different value - should trigger effect
		userData.set({ name: 'Alice', details: { age: 31 } })
		assert.strictEqual(effectCallCount, 2, 'Effect should run when value changes')

		unsubscribe()
	})
})
