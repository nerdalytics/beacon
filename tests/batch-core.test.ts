import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { batch, effect, state } from '../src/index.ts'

describe('Batch Core', {
	concurrency: true,
	timeout: 1000,
}, (): void => {
	it('executes function synchronously', (): void => {
		let executed = false

		batch((): void => {
			executed = true
		})

		assert.strictEqual(executed, true)
	})

	it('returns function result', (): void => {
		const result = batch((): number => {
			return 42
		})

		assert.strictEqual(result, 42)
	})

	it('handles empty batch', (): void => {
		assert.doesNotThrow((): void => {
			batch((): void => {})
		})
	})

	it('handles nested batches', (): void => {
		let outerRan = false
		let middleRan = false
		let innerRan = false

		batch((): void => {
			outerRan = true

			batch((): void => {
				middleRan = true

				batch((): void => {
					innerRan = true
				})
			})
		})

		assert.strictEqual(outerRan, true)
		assert.strictEqual(middleRan, true)
		assert.strictEqual(innerRan, true)
	})

	it('propagates errors', (): void => {
		assert.throws((): void => {
			batch((): void => {
				throw new Error('Test error')
			})
		}, /Test error/)
	})

	it('maintains error context in nested batches', (): void => {
		assert.throws((): void => {
			batch((): void => {
				batch((): void => {
					batch((): void => {
						throw new Error('Deep error')
					})
				})
			})
		}, /Deep error/)
	})

	it('returns nested batch results', (): void => {
		const result = batch((): string => {
			return batch((): string => {
				return batch((): string => {
					return 'nested result'
				})
			})
		})

		assert.strictEqual(result, 'nested result')
	})

	it('executes in order', (): void => {
		const order: number[] = []

		batch((): void => {
			order.push(1)
			batch((): void => {
				order.push(2)
			})
			order.push(3)
		})

		assert.deepStrictEqual(order, [1, 2, 3])
	})

	it('handles complex return types', (): void => {
		const obj = batch(
			(): {
				a: number
				b: number
			} => ({
				a: 1,
				b: 2,
			})
		)
		assert.deepStrictEqual(obj, {
			a: 1,
			b: 2,
		})

		const arr = batch((): number[] => [1, 2, 3])
		assert.deepStrictEqual(arr, [1, 2, 3])

		const fn = batch((): (() => string) => (): string => 'function result')
		assert.strictEqual(fn(), 'function result')
	})

	it('runs an effect once when two arrays it reads are both mutated in one batch', (): void => {
		const $lists = state({
			a: [1],
			b: [2],
		})
		let effectCount = 0

		const dispose = effect((): void => {
			effectCount++
			void $lists.a.length
			void $lists.b.length
		})
		effectCount = 0

		batch((): void => {
			$lists.a.push(3)
			$lists.b.push(4)
		})

		assert.strictEqual(effectCount, 1)
		dispose()
	})

	it('allows deep nesting', (): void => {
		let depth = 0
		const maxDepth = 50

		const nest = (n: number): number => {
			if (n <= 0) return depth
			return batch((): number => {
				depth++
				return nest(n - 1)
			})
		}

		const result = nest(maxDepth)
		assert.strictEqual(result, maxDepth)
		assert.strictEqual(depth, maxDepth)
	})
})
