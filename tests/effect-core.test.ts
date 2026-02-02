import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { effect, state } from '../src/index.ts'

describe(
	'Effect Core',
	{
		concurrency: true,
		timeout: 1000,
	},
	(): void => {
		it('runs immediately on creation', (): void => {
			let executed = false

			const dispose = effect((): void => {
				executed = true
			})

			assert.strictEqual(executed, true)
			dispose()
		})

		it('returns disposal function', (): void => {
			let effectCount = 0
			const $state = state({
				value: 0,
			})

			const dispose = effect((): void => {
				effectCount++
				$state.value
			})

			assert.strictEqual(effectCount, 1)
			assert.strictEqual(typeof dispose, 'function')

			dispose()

			$state.value = 10
			assert.strictEqual(effectCount, 1)
		})

		it('accepts optional name parameter', (): void => {
			const dispose = effect((): void => {}, 'myEffect')
			assert.strictEqual(typeof dispose, 'function')
			dispose()
		})

		it('executes in order of creation', (): void => {
			const results: string[] = []
			const $state = state({
				value: 0,
			})

			const dispose1 = effect((): void => {
				$state.value
				results.push('first')
			})

			const dispose2 = effect((): void => {
				$state.value
				results.push('second')
			})

			const dispose3 = effect((): void => {
				$state.value
				results.push('third')
			})

			assert.deepStrictEqual(results, [
				'first',
				'second',
				'third',
			])

			results.length = 0
			$state.value = 1

			assert.deepStrictEqual(results, [
				'first',
				'second',
				'third',
			])

			dispose1()
			dispose2()
			dispose3()
		})

		it('can be disposed multiple times safely', (): void => {
			const dispose = effect((): void => {})

			assert.doesNotThrow((): void => {
				dispose()
				dispose()
				dispose()
			})
		})

		it('stops running after disposal', (): void => {
			let effectCount = 0
			const $state = state({
				value: 0,
			})

			const dispose = effect((): void => {
				effectCount++
				$state.value
			})

			assert.strictEqual(effectCount, 1)

			dispose()

			$state.value = 1
			$state.value = 2
			$state.value = 3

			assert.strictEqual(effectCount, 1)
		})

		it('runs synchronously', (): void => {
			let order = 0
			let effectOrder = 0

			const $state = state({
				value: 0,
			})

			order = 1
			const dispose = effect((): void => {
				effectOrder = order
				$state.value
			})
			order = 2

			assert.strictEqual(effectOrder, 1)

			dispose()
		})
	}
)
