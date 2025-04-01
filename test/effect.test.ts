import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { state, effect } from '../src/index.ts'

/**
 * Unit tests for the effect functionality.
 *
 * This file contains unit tests for the effect primitive, testing:
 * - Immediate execution
 * - Dependency tracking and updates
 * - Cleanup and disposal
 * - Dynamic dependency handling
 * - Dependency cleanup
 */
describe('Effect', { concurrency: true }, (): void => {
	it('should run immediately', (): void => {
		const results: number[] = []
		const count = state(0)

		effect((): void => {
			results.push(count())
		})

		assert.deepStrictEqual(results, [0])
	})

	it('should run when dependencies change', async (): Promise<void> => {
		const results: number[] = []
		const count = state(0)

		effect((): void => {
			results.push(count())
		})

		count.set(1)

		assert.deepStrictEqual(results, [0, 1])
	})

	it('should cleanup when disposed', async (): Promise<void> => {
		const results: number[] = []
		const count = state(0)

		const dispose = effect((): void => {
			results.push(count())
		})

		count.set(1)

		dispose()
		count.set(2)

		// Wait for asynchronous updates
		await new Promise((resolve: (value: unknown) => void): NodeJS.Timeout => setTimeout(resolve, 50))

		assert.deepStrictEqual(results, [0, 1])
	})

	it('should handle dynamic dependencies', async (): Promise<void> => {
		const results: string[] = []
		const condition = state(true)
		const a = state('A')
		const b = state('B')

		effect((): void => {
			results.push(condition() ? a() : b())
		})

		assert.deepStrictEqual(results, ['A'])

		a.set('A2')

		assert.deepStrictEqual(results, ['A', 'A2'])

		condition.set(false)

		// Wait for asynchronous updates
		await new Promise((resolve: (value: unknown) => void): NodeJS.Timeout => setTimeout(resolve, 50))

		assert.deepStrictEqual(results, ['A', 'A2', 'B'])

		// Should not react to a anymore, only b
		a.set('A3')

		assert.deepStrictEqual(results, ['A', 'A2', 'B'])

		b.set('B2')

		// Wait for asynchronous updates
		await new Promise((resolve: (value: unknown) => void): NodeJS.Timeout => setTimeout(resolve, 50))

		assert.deepStrictEqual(results, ['A', 'A2', 'B', 'B2'])
	})

	it('should cleanup old dependencies properly', async (): Promise<void> => {
		const results: number[] = []
		const a = state(1)
		const b = state(10)
		const showB = state(false)

		effect((): void => {
			results.push(a())
			if (showB()) {
				results.push(b())
			}
		})

		assert.deepStrictEqual(results, [1])

		showB.set(true)

		assert.deepStrictEqual(results, [1, 1, 10])

		b.set(20)

		// Wait for asynchronous updates
		await new Promise((resolve: (value: unknown) => void): NodeJS.Timeout => setTimeout(resolve, 50))

		assert.deepStrictEqual(results, [1, 1, 10, 1, 20])

		showB.set(false)

		assert.deepStrictEqual(results, [1, 1, 10, 1, 20, 1])

		// Should not react to b anymore
		b.set(30)

		assert.deepStrictEqual(results, [1, 1, 10, 1, 20, 1])
	})
})
