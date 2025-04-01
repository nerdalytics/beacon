import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { state, effect, batch } from '../src/index.ts'

describe('Update', { concurrency: true }, (): void => {
	it('should update value using a function', (): void => {
		// Arrange
		const counter = state(5)

		// Act
		counter.update((current) => current + 10)

		// Assert
		assert.strictEqual(counter(), 15)
	})

	it('should handle multiple updates', (): void => {
		// Arrange
		const counter = state(1)

		// Act
		counter.update((current) => current * 2) // 2
		counter.update((current) => current + 3) // 5
		counter.update((current) => current * current) // 25

		// Assert
		assert.strictEqual(counter(), 25)
	})

	it('should work with batched updates', (): void => {
		// Arrange
		const counter = state(0)
		const values: number[] = []

		effect(() => {
			values.push(counter())
		})

		values.length = 0 // Reset after initial run

		// Act - multiple updates in a batch should only trigger effects once
		batch(() => {
			counter.update((c) => c + 1)
			counter.update((c) => c * 2)
			counter.update((c) => c + 10)
		})

		// Assert
		assert.strictEqual(counter(), 12) // (0+1)*2+10 = 12
		assert.deepStrictEqual(values, [12]) // Effect should run only once with final value
	})
})
