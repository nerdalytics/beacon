import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { effect, protectedState } from '../src/index.ts'

/**
 * Unit tests for protected state function.
 */
describe('Protected State', { concurrency: true, timeout: 1000 }, (): void => {
	it('should separate read and write capabilities', (): void => {
		const [getState, setState] = protectedState(10)

		// Reader should work as a function
		assert.strictEqual(getState(), 10, 'Reader should return the current state value')

		// Writer should have mutation methods
		assert.strictEqual(typeof setState.set, 'function', 'Writer should have set method')
		assert.strictEqual(typeof setState.update, 'function', 'Writer should have update method')
	})

	it('should update state through the writer', (): void => {
		const [getState, setState] = protectedState({ count: 0 })

		// Initial check
		assert.deepStrictEqual(getState(), { count: 0 })

		setState.set({ count: 5 })

		assert.deepStrictEqual(getState(), { count: 5 })

		setState.update((current) => ({ count: current.count + 1 }))

		// Assert: should reflect update
		assert.deepStrictEqual(getState(), { count: 6 })
	})

	it('should allow effects to track the reader', (): void => {
		const [getState, setState] = protectedState(0)
		const values: number[] = []

		// Setup effect with reader
		const unsubscribe = effect((): void => {
			values.push(getState())
		})

		// Initial execution
		assert.deepStrictEqual(values, [0])

		setState.set(1)
		setState.set(2)

		// Effect should have tracked the reader as a dependency
		assert.deepStrictEqual(values, [0, 1, 2])

		unsubscribe()
	})
})
