import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { state, readonly, effect } from '../src/index.ts'

/**
 * Unit tests for readonly state function.
 */
describe('Readonly State', { concurrency: true, timeout: 1000 }, (): void => {
	it('should create a read-only view of a state', (): void => {
		const original = state(10)
		const readonlyView = readonly(original)

		assert.strictEqual(readonlyView(), 10, 'Readonly view should return the same value as original')

	})

	it('should reflect changes to the original state', (): void => {
		const original = state({ count: 0 })
		const readonlyView = readonly(original)

		// Initial check
		assert.deepStrictEqual(readonlyView(), { count: 0 })

		original.set({ count: 5 })

		assert.deepStrictEqual(readonlyView(), { count: 5 })
	})

	it('should work with effects for dependency tracking', (): void => {
		const original = state(0)
		const readonlyView = readonly(original)
		const values: number[] = []

		// Setup effect with readonly view
		const unsubscribe = effect((): void => {
			values.push(readonlyView())
		})

		// Initial execution
		assert.deepStrictEqual(values, [0])

		original.set(1)
		original.set(2)

		assert.deepStrictEqual(values, [0, 1, 2])

		unsubscribe()
	})
})
