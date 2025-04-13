import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { batch, effect, select, state } from '../src/index.ts'

type LargeState = {
	criticalValue: string
	items: Item[]
	metadata: {
		created: string
		version: string
	}
}

type Settings = {
	theme: string
	notifications: boolean
}

type Profile = {
	name: string
	settings: Settings
}

type AppState = {
	user: {
		profile: Profile
		posts: number[]
	}
}

type Item = {
	id: number
	name: string
}

describe('Select', { concurrency: true }, (): void => {
	// Common type definitions
	type User = {
		name: string
		age: number
		email: string
	}

	it('should select a subset of state', (): void => {
		const user = state<User>({
			name: 'Alice',
			age: 30,
			email: 'alice@example.com',
		})

		const nameSelect = select(user, (u: User): string => u.name)
		assert.strictEqual(nameSelect(), 'Alice')
	})

	it('should update selected value when source changes', (): void => {
		const user = state<User>({
			name: 'Alice',
			age: 30,
			email: 'alice@example.com',
		})
		const nameSelect = select(user, (u: User): string => u.name)

		user.set({
			name: 'Bob',
			age: 30,
			email: 'alice@example.com',
		})
		assert.strictEqual(nameSelect(), 'Bob')
	})

	it('should not notify subscribers when unrelated parts change', (): void => {
		const user = state<User>({
			name: 'Alice',
			age: 30,
			email: 'alice@example.com',
		})
		const nameSelect = select(user, (u: User): string => u.name)
		let updateCount = 0

		effect((): void => {
			nameSelect() // Subscribe to name only
			updateCount++
		})

		// Verify initial effect execution
		assert.strictEqual(updateCount, 1, 'Effect should run on initialization')
		updateCount = 0 // Reset counter

		// Update an unrelated property
		user.set({
			name: 'Alice', // Name unchanged
			age: 31, // Age changed
			email: 'alice@example.com',
		})
		assert.strictEqual(updateCount, 0, 'Effect should not run when unrelated state changes')

		// Update with same value but new reference
		user.set({
			name: 'Alice', // Same name with new string reference
			age: 31,
			email: 'alice@example.com',
		})
		assert.strictEqual(updateCount, 0, 'Effect should not run when value changes to deeply equal value')
	})

	it('should support default Object.is equality comparison', (): void => {
		const items = state([1, 2, 3])

		// Using default Object.is equality
		const arraySelect = select(items, (arr: number[]): number[] => arr.filter((n: number): boolean => n > 1))

		let updateCount = 0
		effect((): void => {
			arraySelect()
			updateCount++
		})

		assert.strictEqual(updateCount, 1, 'Effect should run on initialization')
		updateCount = 0

		// Update with structurally equal but different array reference
		items.set([1, 2, 3])

		// With Object.is, different array references are considered different
		// even if contents are the same
		assert.strictEqual(updateCount, 1, 'With default equality, new array reference should trigger update')
	})

	it('should support custom equality functions', (): void => {
		const items = state([1, 2, 3, 4, 5])

		// Custom equality function that compares arrays by values
		const arrayEqual = (a: number[], b: number[]): boolean =>
			a.length === b.length && a.every((val: number, idx: number): boolean => val === b[idx])

		// Select even numbers with custom equality
		const evenSelect = select(
			items,
			(nums: number[]): number[] => nums.filter((n: number): boolean => n % 2 === 0),
			arrayEqual
		)

		let updateCount = 0
		effect((): void => {
			evenSelect()
			updateCount++
		})

		assert.strictEqual(updateCount, 1, 'Effect should run on initialization')
		updateCount = 0

		// Add an odd number, even numbers stay the same
		items.set([1, 2, 3, 4, 5, 7])
		assert.strictEqual(updateCount, 0, 'Should not update when selected value is equal')
		assert.deepStrictEqual(evenSelect(), [2, 4])

		// Add an even number, even numbers change
		items.set([1, 2, 3, 4, 5, 6])
		assert.strictEqual(updateCount, 1, 'Should update when selected value changes')
		assert.deepStrictEqual(evenSelect(), [2, 4, 6])

		// Test error in equality function
		const errorEqualitySelect = select(
			items,
			(nums: number[]): number[] => nums.filter((n: number): boolean => n % 2 === 0),
			(): never => {
				throw new Error('Equality error')
			}
		)

		// Initial call works because equality function isn't called on first run
		errorEqualitySelect()

		// UPDATED: Now expect an error when equality function is used
		assert.throws(
			(): void => {
				items.set([1, 2, 3, 4])
				errorEqualitySelect() // This should throw when equality function is called
			},
			{ message: 'Equality error' },
			'Equality function errors should propagate'
		)
	})

	it('should handle nested selections and update only relevant paths', (): void => {
		const data = state<AppState>({
			user: {
				profile: {
					name: 'Alice',
					settings: {
						theme: 'dark',
						notifications: true,
					},
				},
				posts: [1, 2, 3],
			},
		})

		// Create nested selectors
		const profileSelect = select(data, (d: AppState): Profile => d.user.profile)
		const themeSelect = select(profileSelect, (p: Profile): string => p.settings.theme)
		const postsSelect = select(data, (d: AppState): number[] => d.user.posts)

		// Track update counts
		let profileUpdates = 0
		let themeUpdates = 0
		let postsUpdates = 0

		effect((): void => {
			profileSelect()
			profileUpdates++
		})
		effect((): void => {
			themeSelect()
			themeUpdates++
		})
		effect((): void => {
			postsSelect()
			postsUpdates++
		})

		// Verify initial runs
		assert.strictEqual(profileUpdates, 1)
		assert.strictEqual(themeUpdates, 1)
		assert.strictEqual(postsUpdates, 1)

		// Reset counters
		profileUpdates = themeUpdates = postsUpdates = 0

		// Update just the theme
		data.update(
			(d: AppState): AppState => ({
				...d,
				user: {
					...d.user,
					profile: {
						...d.user.profile,
						settings: {
							...d.user.profile.settings,
							theme: 'light',
						},
					},
				},
			})
		)

		// Verify only relevant selectors updated
		assert.strictEqual(profileUpdates, 1, 'Profile should update when nested field changes')
		assert.strictEqual(themeSelect(), 'light')
		assert.strictEqual(themeUpdates, 1, 'Theme should update when it changes')
		assert.strictEqual(postsUpdates, 0, 'Posts should not update when unrelated fields change')
	})

	it('should efficiently handle large state objects with selective updates', (): void => {
		// Create a large state object
		const largeState = state(createLargeState())
		let criticalUpdates = 0
		let itemsUpdates = 0

		// Select specific parts of the large state
		const criticalSelect = select(largeState, (s: LargeState): string => s.criticalValue)
		const itemsSelect = select(largeState, (s: LargeState): Item[] => s.items)

		// Subscribe to updates
		effect((): void => {
			criticalSelect()
			criticalUpdates++
		})
		effect((): void => {
			itemsSelect()
			itemsUpdates++
		})

		// Verify initial run
		assert.strictEqual(criticalUpdates, 1)
		assert.strictEqual(itemsUpdates, 1)

		// Reset counters
		criticalUpdates = itemsUpdates = 0

		// Update only the items (non-critical part)
		largeState.update(
			(s: LargeState): LargeState => ({
				...s,
				items: [...s.items, { id: 1001, name: 'New Item' }],
			})
		)

		// Critical value effect shouldn't run
		assert.strictEqual(criticalUpdates, 0, 'Unrelated selector should not update')
		assert.strictEqual(itemsUpdates, 1, 'Items selector should update')

		// Update the critical value
		largeState.update((s: LargeState): LargeState => ({ ...s, criticalValue: 'new-value' }))
		assert.strictEqual(criticalUpdates, 1, 'Critical selector should update')
		assert.strictEqual(criticalSelect(), 'new-value')
	})

	it('should work with batch operations', (): void => {
		type BaseState = {
			a: number
			b: number
		}

		const baseState = state({ a: 1, b: 2 })
		const aSelect = select(baseState, (s: BaseState): number => s.a)
		const bSelect = select(baseState, (s: BaseState): number => s.b)
		const sumSelect = select(baseState, (s: BaseState): number => s.a + s.b)

		let aUpdates = 0
		let bUpdates = 0
		let sumUpdates = 0

		effect((): void => {
			aSelect()
			aUpdates++
		})
		effect((): void => {
			bSelect()
			bUpdates++
		})
		effect((): void => {
			sumSelect()
			sumUpdates++
		})

		// Verify initial runs
		assert.strictEqual(aUpdates, 1)
		assert.strictEqual(bUpdates, 1)
		assert.strictEqual(sumUpdates, 1)

		// Reset counters
		aUpdates = bUpdates = sumUpdates = 0

		// In a batch, updates should only happen once at the end
		batch((): void => {
			baseState.update((s: BaseState): BaseState => ({ ...s, a: 3 }))
			baseState.update((s: BaseState): BaseState => ({ ...s, b: 4 }))
		})

		assert.strictEqual(aSelect(), 3)
		assert.strictEqual(bSelect(), 4)
		assert.strictEqual(sumSelect(), 7)

		// Each selector should update exactly once
		assert.strictEqual(aUpdates, 1, 'A selector should update once')
		assert.strictEqual(bUpdates, 1, 'B selector should update once')
		assert.strictEqual(sumUpdates, 1, 'Sum selector should update once')
	})

	it('should unsubscribe effects without breaking other subscribers', (): void => {
		type ValueSelect = {
			value: number
		}
		const baseState = state({ value: 1 })
		const valueSelect = select(baseState, (s: ValueSelect): number => s.value)
		let count1 = 0
		let count2 = 0

		// Create two effects
		const unsubscribe = effect((): void => {
			valueSelect()
			count1++
		})

		effect((): void => {
			valueSelect()
			count2++
		})

		// Verify initial runs
		assert.strictEqual(count1, 1)
		assert.strictEqual(count2, 1)

		// Reset counters
		count1 = 0
		count2 = 0

		// Update should trigger both effects
		baseState.set({ value: 2 })
		assert.strictEqual(count1, 1)
		assert.strictEqual(count2, 1)

		// Unsubscribe first effect
		unsubscribe()

		// Updates should only trigger second effect now, not the unsubscribed one
		baseState.set({ value: 3 })

		// If unsubscribe works correctly, count1 should still be 1 (not 2)
		// and count2 should now be 2
		assert.strictEqual(count1, 1, 'Unsubscribed effect should not run again')
		assert.strictEqual(count2, 2, 'Subscribed effect should still run')
		assert.strictEqual(valueSelect(), 3, 'Select should still work')
	})

	it('should propagate errors from selector creation', (): void => {
		// We can test the immediate creation case
		assert.throws(
			(): void => {
				const throwingState = state({ shouldThrow: true })
				const throwingSelector = select(throwingState, (): never => {
					throw new Error('Creation error')
				})
				throwingSelector() // This triggers the error
			},
			{ message: 'Creation error' },
			'Errors during selector creation should propagate'
		)
	})

	it('should preserve reference identity according to equality function', (): void => {
		const items = state([1, 2, 3])

		// Custom equality just compares array contents
		const customEqualitySelect = select(
			items,
			(nums: number[]): number[] => nums.filter((n: number): boolean => n % 2 === 0),
			(a: number[], b: number[]): boolean =>
				a.length === b.length && a.every((val: number, idx: number): boolean => val === b[idx])
		)

		// Get initial reference
		const result1 = customEqualitySelect()

		// Update source but keep even numbers the same
		items.set([1, 2, 3, 5])

		// Get the result after update
		const result2 = customEqualitySelect()

		// Values should be equal
		assert.deepStrictEqual(result2, [2])

		// With custom equality, the references should be the same
		// This is part of the API contract - preserving reference identity
		// when values are considered equal by the equality function
		assert.strictEqual(
			result1,
			result2,
			'Select should preserve reference identity when equality function returns true'
		)

		// Now with default Object.is equality for comparison
		const defaultEqualitySelect = select(items, (nums: number[]): number[] =>
			nums.filter((n: number): boolean => n % 2 === 0)
		)

		const defaultResult1 = defaultEqualitySelect()
		items.set([1, 2, 3, 7]) // Same even numbers but new source array
		const defaultResult2 = defaultEqualitySelect()

		// With Object.is, different array instances are never equal
		// even with same contents, so references should differ
		assert.notStrictEqual(
			defaultResult1,
			defaultResult2,
			'With Object.is equality, new array references should be different'
		)
	})
})

// Helper function
function createLargeState(): LargeState {
	return {
		criticalValue: 'important',
		items: Array.from(
			{ length: 100 },
			(_: unknown, i: number): Item => ({
				id: i,
				name: `Item ${i}`,
			})
		),
		metadata: {
			created: new Date().toISOString(),
			version: '1.0.0',
		},
	}
}
