import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { type State, batch, effect, lens, state } from '../src/index.ts'

// Common type definitions
type User = {
	name: string
	age: number
	email: string
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

describe('Lens', { concurrency: true }, (): void => {
	it('should read and update a simple property', (): void => {
		const user = state<User>({
			name: 'Alice',
			age: 30,
			email: 'alice@example.com',
		})

		const nameLens = lens(user, (u: User): string => u.name)

		// Verify reading works
		assert.strictEqual(nameLens(), 'Alice')

		// Verify updating works
		nameLens.set('Bob')
		assert.strictEqual(nameLens(), 'Bob')

		// Original state should be updated
		assert.deepStrictEqual(user(), {
			name: 'Bob',
			age: 30,
			email: 'alice@example.com',
		})
	})

	it('should read and update a deeply nested property', (): void => {
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

		const themeLens = lens(data, (d: AppState): string => d.user.profile.settings.theme)

		// Verify reading works for deeply nested property
		assert.strictEqual(themeLens(), 'dark')

		// Verify updating works
		themeLens.set('light')
		assert.strictEqual(themeLens(), 'light')

		// Check that the original state was updated correctly
		const updatedData = data()
		assert.strictEqual(updatedData.user.profile.settings.theme, 'light')

		// Other properties should be unchanged
		assert.strictEqual(updatedData.user.profile.settings.notifications, true)
		assert.strictEqual(updatedData.user.profile.name, 'Alice')
		assert.deepStrictEqual(updatedData.user.posts, [1, 2, 3])
	})

	it('should maintain referential integrity when updating', (): void => {
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

		// Keep references to original objects
		const originalState = data()
		const originalUser = originalState.user
		const originalProfile = originalUser.profile
		const originalSettings = originalProfile.settings
		const originalPosts = originalUser.posts

		// Create a lens to the theme property
		const themeLens = lens(data, (d: AppState): string => d.user.profile.settings.theme)

		// Update the theme
		themeLens.set('light')

		// Get updated state
		const newState = data()

		// The whole state reference should be different
		assert.notStrictEqual(newState, originalState, 'Root state reference should change')

		// User object reference should be different
		assert.notStrictEqual(newState.user, originalUser, 'User object reference should change')

		// Profile object reference should be different
		assert.notStrictEqual(newState.user.profile, originalProfile, 'Profile object reference should change')

		// Settings object reference should be different
		assert.notStrictEqual(newState.user.profile.settings, originalSettings, 'Settings object reference should change')

		// Posts array should maintain the same reference (not in the update path)
		assert.strictEqual(newState.user.posts, originalPosts, 'Posts array reference should be preserved')
	})

	it('should update nested arrays correctly', (): void => {
		type ArrayState = {
			items: Item[]
			meta: { count: number }
		}

		const arrayState = state<ArrayState>({
			items: [
				{ id: 1, name: 'Item 1' },
				{ id: 2, name: 'Item 2' },
				{ id: 3, name: 'Item 3' },
			],
			meta: { count: 3 },
		})

		// Create a lens to the second item's name
		const item2NameLens = lens(arrayState, (s: ArrayState): string => s.items[1]?.name ?? '')

		// Verify initial value
		assert.strictEqual(item2NameLens(), 'Item 2')

		// Store original array and item references
		const originalState = arrayState()
		const originalArray = originalState.items
		const originalItem = originalArray[1]

		// Update the item name
		item2NameLens.set('Updated Item 2')

		// Verify the update
		const updatedState = arrayState()
		assert.strictEqual(updatedState.items[1]?.name, 'Updated Item 2')

		// Other items should be unchanged
		assert.strictEqual(updatedState.items[0]?.name, 'Item 1')
		assert.strictEqual(updatedState.items[2]?.name, 'Item 3')

		// The array reference should change
		assert.notStrictEqual(updatedState.items, originalArray, 'Array reference should change')

		// The item object reference should change
		assert.notStrictEqual(updatedState.items[1], originalItem, 'Item reference should change')
	})

	it('should notify effects when lens value changes', (): void => {
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

		const themeLens = lens(data, (d: AppState): string => d.user.profile.settings.theme)
		const notificationsLens = lens(data, (d: AppState): boolean => d.user.profile.settings.notifications)

		let themeUpdateCount = 0
		let notificationsUpdateCount = 0

		// Subscribe to theme changes
		effect((): void => {
			themeLens() // Track theme changes
			themeUpdateCount++
		})

		// Subscribe to notifications changes
		effect((): void => {
			notificationsLens() // Track notifications changes
			notificationsUpdateCount++
		})

		// Verify initial effect execution
		assert.strictEqual(themeUpdateCount, 1)
		assert.strictEqual(notificationsUpdateCount, 1)

		// Reset counters
		themeUpdateCount = 0
		notificationsUpdateCount = 0

		// Update theme
		themeLens.set('light')

		// Only theme effect should run
		assert.strictEqual(themeUpdateCount, 1, 'Theme effect should run')
		assert.strictEqual(notificationsUpdateCount, 0, 'Notifications effect should not run')

		// Reset counters
		themeUpdateCount = 0
		notificationsUpdateCount = 0

		// Update notifications
		notificationsLens.set(false)

		// Only notifications effect should run
		assert.strictEqual(themeUpdateCount, 0, 'Theme effect should not run')
		assert.strictEqual(notificationsUpdateCount, 1, 'Notifications effect should run')
	})

	it('should work with the update method', (): void => {
		const user = state<User>({
			name: 'Alice',
			age: 30,
			email: 'alice@example.com',
		})

		const ageLens = lens(user, (u: User): number => u.age)

		// Verify initial value
		assert.strictEqual(ageLens(), 30)

		// Use update method to increment age
		ageLens.update((age: number): number => age + 1)

		// Verify the update
		assert.strictEqual(ageLens(), 31)
		assert.strictEqual(user().age, 31)
	})

	it('should work within batch operations', (): void => {
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

		const themeLens = lens(data, (d: AppState): string => d.user.profile.settings.theme)
		const notificationsLens = lens(data, (d: AppState): boolean => d.user.profile.settings.notifications)

		let updateCount = 0

		// Subscribe to any changes in the state
		effect((): void => {
			data() // Track all state changes
			updateCount++
		})

		// Verify initial effect execution
		assert.strictEqual(updateCount, 1)

		// Reset counter
		updateCount = 0

		// Perform multiple lens updates in a batch
		batch((): void => {
			themeLens.set('light')
			notificationsLens.set(false)
		})

		// Effect should run exactly once after the batch
		assert.strictEqual(updateCount, 1, 'Effect should run exactly once after batch')

		// Verify both updates were applied
		assert.strictEqual(themeLens(), 'light')
		assert.strictEqual(notificationsLens(), false)
	})

	it('should handle null/undefined values in the path', (): void => {
		type NullableState = {
			user: {
				profile: Profile | null
			} | null
		}

		// Initialize with null values
		const nullableState = state<NullableState>({
			user: null,
		})

		// Create a lens to a deeply nested property that might be null
		const themeLens = lens(nullableState, (s: NullableState): string | undefined => s.user?.profile?.settings?.theme)

		// Initial value should be undefined
		assert.strictEqual(themeLens(), undefined)

		// Update should create the necessary objects
		themeLens.set('light')

		// Verify the update created all the necessary objects
		const updatedState = nullableState()
		assert.notStrictEqual(updatedState.user, null, 'User should not be null after update')
		assert.notStrictEqual(updatedState.user?.profile, null, 'Profile should not be null after update')
		assert.strictEqual(updatedState.user?.profile?.settings?.theme, 'light', 'Theme should be updated')
	})

	it('should work with multiple nested lenses', (): void => {
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

		// Create a lens to the profile
		const profileLens = lens(data, (d: AppState): Profile => d.user.profile)

		// Create a lens to the settings from the profile lens
		const settingsLens = lens(profileLens, (p: Profile): Settings => p.settings)

		// Create a lens to the theme from the settings lens
		const themeLens = lens(settingsLens, (s: Settings): string => s.theme)

		// Verify initial values
		assert.strictEqual(themeLens(), 'dark')

		// Update through the nested lens
		themeLens.set('light')

		// Verify the update
		assert.strictEqual(themeLens(), 'light')
		assert.strictEqual(data().user.profile.settings.theme, 'light')
	})

	it('should handle arrays with arbitrary indices', (): void => {
		type ArrayState = {
			items: { value: number }[]
		}

		const arrayState = state<ArrayState>({
			items: [{ value: 10 }, { value: 20 }, { value: 30 }],
		})

		// Create a dynamic index accessor function
		const createIndexLens = (index: number): State<number> =>
			lens(arrayState, (s: ArrayState): number => s.items[index]?.value ?? 0)

		const lens0 = createIndexLens(0)
		const lens1 = createIndexLens(1)
		const lens2 = createIndexLens(2)

		// Verify initial values
		assert.strictEqual(lens0(), 10)
		assert.strictEqual(lens1(), 20)
		assert.strictEqual(lens2(), 30)

		// Update through the lenses
		lens0.set(100)
		lens2.set(300)

		// Verify the updates
		assert.strictEqual(lens0(), 100)
		assert.strictEqual(lens1(), 20)
		assert.strictEqual(lens2(), 300)
		assert.deepStrictEqual(
			arrayState().items.map((item) => item.value),
			[100, 20, 300]
		)
	})
})
