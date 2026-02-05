import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { batch } from '../src/index.ts'

describe(
	'Batch Hooks',
	{
		concurrency: true,
		timeout: 1000,
	},
	() => {
		it('works without hooks (backward compat)', () => {
			const result = batch(() => 42)
			assert.strictEqual(result, 42)
		})

		it('fires onBatchStart with correct depth', () => {
			const depths: number[] = []
			batch(() => {}, {
				onBatchStart: (depth: number) => {
					depths.push(depth)
				},
			})
			assert.deepStrictEqual(
				depths,
				[
					1,
				]
			)
		})

		it('fires onBatchEnd with correct depth', () => {
			const depths: number[] = []
			batch(() => {}, {
				onBatchEnd: (depth: number) => {
					depths.push(depth)
				},
			})
			assert.deepStrictEqual(
				depths,
				[
					1,
				]
			)
		})

		it('fires onBatchError with error and depth', () => {
			const errors: [
				Error,
				number,
			][] = []
			assert.throws(
				() => {
					batch(
						() => {
							throw new Error('batch fail')
						},
						{
							onBatchError: (err: Error, depth: number) => {
								errors.push([
									err,
									depth,
								])
							},
						}
					)
				},
				{
					message: 'batch fail',
				}
			)
			assert.strictEqual(errors.length, 1)
			assert.strictEqual(errors[0]?.[0].message, 'batch fail')
			assert.strictEqual(errors[0]?.[1], 1)
		})

		it('reports correct depths for nested batches', () => {
			const starts: number[] = []
			const ends: number[] = []
			const outerHooks = {
				onBatchEnd: (d: number): void => {
					ends.push(d)
				},
				onBatchStart: (d: number): void => {
					starts.push(d)
				},
			}
			const innerHooks = {
				onBatchEnd: (d: number): void => {
					ends.push(d)
				},
				onBatchStart: (d: number): void => {
					starts.push(d)
				},
			}
			batch(() => {
				batch(() => {}, innerHooks)
			}, outerHooks)
			assert.deepStrictEqual(
				starts,
				[
					1,
					2,
				]
			)
			assert.deepStrictEqual(
				ends,
				[
					2,
					1,
				]
			)
		})

		it('isolates hook errors from batch execution', () => {
			const result = batch(() => 99, {
				onBatchStart: () => {
					throw new Error('hook error')
				},
			})
			assert.strictEqual(result, 99)
		})
	}
)
