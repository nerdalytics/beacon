import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { state, effect, selector } from '../src/index.ts'

/**
 * Unit tests for the selector functionality.
 *
 * This file contains unit tests for the selector primitive, testing:
 * - Basic selection from a state object
 * - Selection caching with equality checks
 * - Subscription behavior when selected values change
 * - Performance with large state objects
 */
describe('Selector', { concurrency: true }, (): void => {
	it('should select a subset of state', (): void => {
		// Arrange
		const user = state({ name: 'Alice', age: 30, email: 'alice@example.com' })
		
		// Act
		const nameSelector = selector(user, (u) => u.name)
		
		// Assert
		assert.strictEqual(nameSelector(), 'Alice')
	})

	it('should update selected value when source changes', (): void => {
		// Arrange
		const user = state({ name: 'Alice', age: 30, email: 'alice@example.com' })
		const nameSelector = selector(user, (u) => u.name)
		
		// Act
		user.set({ name: 'Bob', age: 30, email: 'alice@example.com' })
		
		// Assert
		assert.strictEqual(nameSelector(), 'Bob')
	})

	it('should not notify subscribers when unrelated parts change', (): void => {
		// Arrange
		const user = state({ name: 'Alice', age: 30, email: 'alice@example.com' })
		const nameSelector = selector(user, (u) => u.name)
		let updateCount = 0
		
		effect(() => {
			nameSelector() // Subscribe to name only
			updateCount++
		})
		
		updateCount = 0 // Reset after initial effect
		
		// Act - only change age, not name
		user.set({ name: 'Alice', age: 31, email: 'alice@example.com' })
		
		// Assert - effect shouldn't run since selected value didn't change
		assert.strictEqual(updateCount, 0, 'Effect should not run when unrelated state changes')
		assert.strictEqual(nameSelector(), 'Alice')
	})

	it('should support custom equality functions', (): void => {
		// Arrange
		const items = state([1, 2, 3, 4, 5])
		
		// Select even numbers
		const evenSelector = selector(
			items,
			(nums) => nums.filter((n) => n % 2 === 0),
			// Custom equality function that compares arrays by values
			(a, b) => a.length === b.length && a.every((val, idx) => val === b[idx])
		)
		
		let updateCount = 0
		effect(() => {
			evenSelector() // Subscribe to even numbers
			updateCount++
		})
		
		updateCount = 0 // Reset after initial effect
		
		// Act - add an odd number (shouldn't change even numbers result)
		items.set([1, 2, 3, 4, 5, 7])
		
		// Assert
		assert.strictEqual(updateCount, 0, 'Should not trigger effect when even numbers stay the same')
		assert.deepStrictEqual(evenSelector(), [2, 4])
		
		// Act - add an even number (should change result)
		items.set([1, 2, 3, 4, 5, 6])
		
		// Assert
		assert.strictEqual(updateCount, 1, 'Should trigger effect when even numbers change')
		assert.deepStrictEqual(evenSelector(), [2, 4, 6])
	})

	it('should handle nested selections', async (): Promise<void> => {
		// Arrange
		const data = state({
			user: {
				profile: {
					name: 'Alice',
					settings: {
						theme: 'dark',
						notifications: true
					}
				},
				posts: [1, 2, 3]
			}
		})
		
		// Create nested selectors
		const profileSelector = selector(data, (d) => d.user.profile)
		const themeSelector = selector(profileSelector, (p) => p.settings.theme)
		
		// Act
		assert.strictEqual(themeSelector(), 'dark')
		
		// Update a nested value
		data.update(d => ({
			...d,
			user: {
				...d.user,
				profile: {
					...d.user.profile,
					settings: {
						...d.user.profile.settings,
						theme: 'light'
					}
				}
			}
		}))
		
		// Assert
		assert.strictEqual(themeSelector(), 'light')
	})

	it('should perform well with large state objects', (): void => {
		// Arrange
		const largeState = state(createLargeState())
		let updateCount = 0
		
		// Select just one property from the large state
		const singlePropSelector = selector(largeState, (s) => s.criticalValue)
		
		effect(() => {
			singlePropSelector()
			updateCount++
		})
		
		updateCount = 0 // Reset after initial run
		
		// Act - update non-selected parts of state multiple times
		for (let i = 0; i < 5; i++) {
			largeState.update(s => ({ ...s, items: [...s.items, i] }))
		}
		
		// Assert - effect shouldn't have run since selected value didn't change
		assert.strictEqual(updateCount, 0)
		
		// Act - update the selected value
		largeState.update(s => ({ ...s, criticalValue: 'new-value' }))
		
		// Assert - effect should run exactly once
		assert.strictEqual(updateCount, 1)
		assert.strictEqual(singlePropSelector(), 'new-value')
	})
})

// Helper to create a large state object for performance testing
function createLargeState() {
	return {
		criticalValue: 'important',
		items: Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `Item ${i}` })),
		metadata: {
			created: new Date().toISOString(),
			version: '1.0.0',
			nested: {
				level1: {
					level2: {
						level3: {
							deep: 'value'
						}
					}
				}
			}
		}
	}
}