import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { batch, effect, state } from '../src/index.ts'

/**
 * Unit tests for the batch functionality.
 */
describe('Batch', { concurrency: true, timeout: 1000 }, (): void => {
	it('should batch updates', (): void => {
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

	it('should handle nested batches', (): void => {
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

	it('should batch updates for multiple signals', (): void => {
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

	it('should return the value from the callback function', (): void => {
		const result = batch((): string => {
			return 'test-result'
		})

		assert.strictEqual(result, 'test-result')
	})

	it('should handle batch with no updates', (): void => {
		const results: number[] = []
		const count = state(0)

		effect((): void => {
			results.push(count())
		})

		batch((): void => {
			// No updates to any state
			const _value = count() // Just reading
		})

		// Effect should not re-run since no state was changed
		assert.deepStrictEqual(results, [0])
	})

	it('should handle multiple separate batches', (): void => {
		const results: number[] = []
		const count = state(0)

		effect((): void => {
			results.push(count())
		})

		batch((): void => {
			count.set(1)
		})

		assert.deepStrictEqual(results, [0, 1])

		batch((): void => {
			count.set(2)
			count.set(3)
		})

		assert.deepStrictEqual(results, [0, 1, 3])
	})

	it('should maintain order of effects when batching', (): void => {
		const log: string[] = []
		const a = state(0)
		const b = state(0)

		// First effect
		effect((): void => {
			log.push(`A: ${a()}`)
		})

		// Second effect
		effect((): void => {
			log.push(`B: ${b()}`)
		})

		// Both signals in one batch
		batch((): void => {
			a.set(1)
			b.set(1)
		})

		// Effects should run in creation order
		assert.deepStrictEqual(log, ['A: 0', 'B: 0', 'A: 1', 'B: 1'])
	})

	it('should maintain proper batching with shared dependencies', (): void => {
		const log: string[] = []
		const a = state(0)
		const b = state(0)

		// First effect depends on a only
		effect((): void => {
			log.push(`A: ${a()}`)
		})

		// Second effect depends on both a and b
		effect((): void => {
			log.push(`A+B: ${a() + b()}`)
		})

		// Both signals in one batch
		batch((): void => {
			a.set(1)
			b.set(1)
		})

		// Both effects run once after batch completes
		assert.deepStrictEqual(log, ['A: 0', 'A+B: 0', 'A: 1', 'A+B: 2'])
	})

	it('should define clear behavior for effects created inside batches', (): void => {
		const immediateResults: number[] = []
		const batchResults: number[] = []
		const count = state(0)

		// Create an effect outside batch
		effect((): void => {
			immediateResults.push(count())
		})

		assert.deepStrictEqual(immediateResults, [0], 'Effects outside batch should run immediately')

		batch((): void => {
			// Create an effect inside batch
			effect((): void => {
				batchResults.push(count())
			})

			count.set(1)
		})

		// Verify the effect created inside batch runs with final state value
		assert.deepStrictEqual(batchResults, [1], 'Effects inside batch should run after batch with final values')
	})

	it('should propagate errors from batch callbacks and prevent effects', (): void => {
		const results: number[] = []
		const count = state(0)

		effect((): void => {
			results.push(count())
		})

		assert.throws(
			(): void => {
				batch((): never => {
					count.set(1)
					throw new Error('Batch error')
				})
			},
			{
				name: 'Error',
				message: 'Batch error',
			}
		)

		// Verify effects didn't run when batch failed
		assert.deepStrictEqual(results, [0])

		// Verify system still works after error
		count.set(2)
		assert.deepStrictEqual(results, [0, 2])
	})

	it('should handle errors in effects created during a batch', (): void => {
		const results: number[] = []
		const count = state(0)

		// Setup initial effect and state
		effect((): void => {
			results.push(count())
		})

		assert.deepStrictEqual(results, [0])

		// Error in an effect created inside a batch
		assert.throws(
			() => {
				batch((): void => {
					count.set(1)

					// Effect that throws on initial run
					effect((): void => {
						throw new Error('Effect error')
					})
				})
			},
			{
				name: 'Error',
				message: 'Effect error',
			}
		)

		// Original effect didn't run because the error interrupted processing
		assert.deepStrictEqual(results, [0])

		// System still works after error recovery
		count.set(2)
		assert.deepStrictEqual(results, [0, 2])
	})

	it('should maintain reactivity after recovering from errors', (): void => {
		const results: number[] = []
		const count = state(0)

		effect((): void => {
			results.push(count())
		})

		// First batch with error
		try {
			batch((): void => {
				count.set(1)
				throw new Error('First batch error')
			})
		} catch {
			// Ignore error
		}

		// Second batch should work normally
		batch((): void => {
			count.set(2)
			count.set(3)
		})

		// Verify system still works after error recovery
		assert.deepStrictEqual(results, [0, 3])
	})

	it('should correctly apply a sequence of update transformations in a batch', (): void => {
		// Arrange
		const counter = state(0)
		const values: number[] = []

		effect((): void => {
			values.push(counter())
		})

		values.length = 0 // Reset after initial run

		// Act - multiple updates in a batch should only trigger effects once
		batch((): void => {
			counter.update((c): number => c + 1)
			counter.update((c): number => c * 2)
			counter.update((c): number => c + 10)
		})

		// Assert
		assert.strictEqual(counter(), 12) // (0+1)*2+10 = 12
		assert.deepStrictEqual(values, [12]) // Effect should run only once with final value
	})
})
