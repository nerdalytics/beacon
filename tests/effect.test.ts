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
describe('Effect', { concurrency: true, timeout: 1000 }, (): void => {
	it('should run immediately', (): void => {
		const results: number[] = []
		const count = state(0)

		effect((): void => {
			results.push(count())
		})

		assert.deepStrictEqual(results, [0], 'Effect should run immediately when created')
	})

	it('should run when dependencies change', (): void => {
		const results: number[] = []
		const count = state(0)

		effect((): void => {
			results.push(count())
		})

		count.set(1)
		assert.deepStrictEqual(results, [0, 1], 'Effect should run when its dependencies change')
	})

	it('should cleanup when disposed', (): void => {
		const results: number[] = []
		const count = state(0)

		const dispose = effect((): void => {
			results.push(count())
		})

		count.set(1)
		dispose()
		count.set(2)

		assert.deepStrictEqual(results, [0, 1], 'Effect should not run after being disposed')
	})

	it('should handle dynamic dependencies', (): void => {
		const results: string[] = []
		const condition = state(true)
		const a = state('A')
		const b = state('B')

		effect((): void => {
			results.push(condition() ? a() : b())
		})

		assert.deepStrictEqual(results, ['A'], 'Initial execution should use a')

		a.set('A2')
		assert.deepStrictEqual(results, ['A', 'A2'], 'Should react to a changes when condition is true')

		condition.set(false)
		assert.deepStrictEqual(results, ['A', 'A2', 'B'], 'Should switch to b when condition is false')

		a.set('A3')
		assert.deepStrictEqual(results, ['A', 'A2', 'B'], 'Should not react to a changes when condition is false')

		b.set('B2')
		assert.deepStrictEqual(results, ['A', 'A2', 'B', 'B2'], 'Should react to b changes when condition is false')
	})

	it('should cleanup old dependencies properly', (): void => {
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

		assert.deepStrictEqual(results, [1], 'Initially only depends on a')

		showB.set(true)
		assert.deepStrictEqual(results, [1, 1, 10], 'Now depends on both a and b')

		b.set(20)
		assert.deepStrictEqual(results, [1, 1, 10, 1, 20], 'Reacts to b changes')

		showB.set(false)
		assert.deepStrictEqual(results, [1, 1, 10, 1, 20, 1], 'No longer depends on b')

		b.set(30)
		assert.deepStrictEqual(results, [1, 1, 10, 1, 20, 1], 'No longer reacts to b changes')
	})

	it('should handle nested effects correctly', (): void => {
		const results: string[] = []
		const outer = state('outer')
		const inner = state('inner')

		let innerUnsubscribe: (() => void) | null = null

		effect((): void => {
			results.push(`Outer: ${outer()}`)

			if (innerUnsubscribe) {
				innerUnsubscribe()
				innerUnsubscribe = null
			}

			innerUnsubscribe = effect((): void => {
				results.push(`Inner: ${inner()}`)
			})
		})

		outer.set('outer updated')
		inner.set('inner updated')

		assert.deepStrictEqual(
			results,
			['Outer: outer', 'Inner: inner', 'Outer: outer updated', 'Inner: inner', 'Inner: inner updated'],
			'Nested effects should update correctly'
		)
	})

	it('should only track direct dependencies, not intermediate values', (): void => {
		const results: number[] = []
		const a = state(1)
		const b = state(2)

		effect((): void => {
			const _unused = a() * 10
			results.push(b())
		})

		b.set(3)
		assert.deepStrictEqual(results, [2, 3], 'Effect should update when b changes')

		a.set(5)
		assert.deepStrictEqual(results, [2, 3, 3], 'Effect should update when a changes, even when not used in output')
	})

	it('should handle effects that read the same signal multiple times', (): void => {
		const result: number[] = []
		const count = state(1)

		effect((): void => {
			const double = count() * 2
			const triple = count() * 3
			result.push(double + triple)
		})

		count.set(2)

		assert.deepStrictEqual(result, [5, 10], 'Effect should handle multiple reads correctly')
	})

	it('should handle rapid consecutive updates efficiently', (): void => {
		const results: number[] = []
		const count = state(0)

		effect((): void => {
			results.push(count())
		})

		count.set(1)
		count.set(2)
		count.set(3)

		assert.deepStrictEqual(results, [0, 1, 2, 3], 'Effect should run after each update')
	})

	it('should execute effects in predictable order (registration order)', (): void => {
		const executionOrder: number[] = []
		const counter = state(0)

		effect((): void => {
			counter()
			executionOrder.push(1)
		})

		effect((): void => {
			counter()
			executionOrder.push(2)
		})

		effect((): void => {
			counter()
			executionOrder.push(3)
		})

		executionOrder.length = 0
		counter.set(1)

		assert.deepStrictEqual(executionOrder, [1, 2, 3], 'Effects should execute in registration order')
	})

	it('should not trigger effects when setting identical values', (): void => {
		const count = state(0)
		const effectCalls: number[] = []

		effect((): void => {
			effectCalls.push(count())
		})

		assert.deepStrictEqual(effectCalls, [0], 'Effect should run initially')

		count.set(0)
		assert.deepStrictEqual(effectCalls, [0], 'Effect should not re-run when value is unchanged')

		count.set(1)
		assert.deepStrictEqual(effectCalls, [0, 1], 'Effect should run when value changes')
	})
})
