import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { state, effect, batch } from '../src/index.ts'

/**
 * Unit tests for the batch functionality.
 *
 * This file contains unit tests for the batch primitive, testing:
 * - Batching multiple updates
 * - Nested batch handling
 * - Error handling within batches
 * - Multi-signal batch updates
 */
describe('Batch', { concurrency: true }, (): void => {
	it('should batch updates', async (): Promise<void> => {
		const results: number[] = []
		const count = state(0)

		effect((): void => {
			results.push(count())
		})

		batch((): void => {
			count.set(1)
			count.set(2)
			count.set(3)
			assert.strictEqual(count(), 3) // Value is updated synchronously
			assert.deepStrictEqual(results, [0]) // But effects are batched
		})

		assert.deepStrictEqual(results, [0, 3]) // Effect runs once after batch
	})

	it('should handle nested batches', async (): Promise<void> => {
		const results: number[] = []
		const count = state(0)

		effect((): void => {
			results.push(count())
		})

		batch((): void => {
			count.set(1)

			batch((): void => {
				count.set(2)
			})

			count.set(3)
			assert.strictEqual(count(), 3)
			assert.deepStrictEqual(results, [0]) // Still no effects run
		})

		assert.deepStrictEqual(results, [0, 3]) // Effect runs once at the end
	})

	it('should clear pending effects on error', async (): Promise<void> => {
		let effectCounter = 0
		const count = state(0)

		// Create an effect that just increments a counter when run
		effect((): void => {
			effectCounter++
			count() // Just read to establish dependency
		})

		// Reset counter after initial run
		effectCounter = 0

		// Trigger a batch with an error
		let errorWasThrown = false
		try {
			batch((): never => {
				count.set(1) // Should queue an effect
				throw new Error('Deliberate test error')
			})
		} catch {
			errorWasThrown = true
		}

		// Verify the error was thrown
		assert.strictEqual(errorWasThrown, true)

		// Verify no effects ran (they should have been cleared)
		assert.strictEqual(effectCounter, 0)

		// Verify normal updates still work
		count.set(2)

		// Wait for asynchronous updates
		await new Promise((resolve: (value: unknown) => void): NodeJS.Timeout => setTimeout(resolve, 50))

		assert.strictEqual(effectCounter, 1)
	})

	it('should batch updates for multiple signals', async (): Promise<void> => {
		const log: string[] = []
		const a = state(1)
		const b = state(2)

		effect((): void => {
			log.push(`a: ${a()}, b: ${b()}`)
		})

		assert.deepStrictEqual(log, ['a: 1, b: 2'])

		batch((): void => {
			a.set(10)
			b.set(20)
			a.set(100)
			b.set(200)
		})

		// Effect should run only once with final values
		assert.deepStrictEqual(log, ['a: 1, b: 2', 'a: 100, b: 200'])
	})
})
