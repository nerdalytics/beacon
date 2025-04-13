import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { state } from '../src/index.ts'

/**
 * Unit tests for the state functionality.
 *
 * This file contains unit tests for the state primitive, testing:
 * - Creation and initialization
 * - Value updates
 * - Value equality checks
 * - Complex object handling
 */
describe('State', { concurrency: true, timeout: 1000 }, (): void => {
	it('should return the initial value', (): void => {
		const count = state(0)
		assert.strictEqual(count(), 0)
	})

	it('should update the value when set is called', (): void => {
		const count = state(0)
		count.set(1)
		assert.strictEqual(count(), 1)
	})

	it('should update the value when update is called', (): void => {
		const count = state(0)
		count.update((n) => n + 1)
		assert.strictEqual(count(), 1)
	})

	it('should maintain reference equality when setting identical values', (): void => {
		const count = state(0)
		const initialReference = count()

		count.set(0)
		assert.strictEqual(count(), initialReference, 'Setting the same value should preserve reference equality')

		count.set(1)
		assert.notStrictEqual(count(), initialReference, 'Setting a different value should change the reference')
	})

	it('should handle complex object values', (): void => {
		const userAlice = { name: 'Alice', age: 30 }
		const userBob25 = { name: 'Bob', age: 25 }
		const userBob26 = { name: 'Bob', age: 26 }

		const user = state(userAlice)
		assert.deepStrictEqual(user(), userAlice)

		user.set(userBob25)
		assert.deepStrictEqual(user(), userBob25)

		user.update((current) => ({
			...current,
			age: current.age + 1,
		}))
		assert.deepStrictEqual(user(), userBob26)
	})

	it('should handle NaN values', (): void => {
		const value = state(Number.NaN)
		assert.strictEqual(Number.isNaN(value()), true)

		value.set(Number.NaN)
		assert.strictEqual(Number.isNaN(value()), true)

		value.set(0)
		assert.strictEqual(value(), 0)
	})

	it('should handle undefined values', (): void => {
		const value = state<number | undefined>(undefined)
		assert.strictEqual(value(), undefined)

		value.set(42)
		assert.strictEqual(value(), 42)

		value.set(undefined)
		assert.strictEqual(value(), undefined)
	})

	it('should handle null values', (): void => {
		const value = state<string | null>(null)
		assert.strictEqual(value(), null)

		value.set('hello')
		assert.strictEqual(value(), 'hello')

		value.set(null)
		assert.strictEqual(value(), null)
	})

	it('should handle boolean values', (): void => {
		const value = state(false)
		assert.strictEqual(value(), false)

		value.set(true)
		assert.strictEqual(value(), true)

		value.update((current) => !current)
		assert.strictEqual(value(), false)
	})

	it('should preserve reference equality when unchanged', (): void => {
		const obj = { nested: { value: 42 } }
		const value = state(obj)

		assert.strictEqual(value(), obj)

		const newObj = { nested: { value: 42 } }
		value.set(newObj)
		assert.strictEqual(value(), newObj)
		assert.notStrictEqual(value(), obj)
	})

	it('should maintain separate identities for different state objects with the same value', (): void => {
		const count1 = state(42)
		const count2 = state(42)

		assert.strictEqual(count1(), count2(), 'Values should be equal')
		assert.notStrictEqual(count1, count2, 'State objects should be different')

		count1.set(100)
		assert.strictEqual(count1(), 100)
		assert.strictEqual(count2(), 42)

		count2.update((n) => n + 1)
		assert.strictEqual(count1(), 100)
		assert.strictEqual(count2(), 43)
	})

	it('should update value using a function', (): void => {
		const counter = state(5)
		counter.update((current) => current + 10)
		assert.strictEqual(counter(), 15)
	})

	it('should handle multiple updates', (): void => {
		const counter = state(1)
		counter.update((current) => current * 2) // 1 * 2 = 2
		counter.update((current) => current + 3) // 2 + 3 = 5
		counter.update((current) => current * current) // 5 * 5 = 25
		assert.strictEqual(counter(), 25)
	})
})
