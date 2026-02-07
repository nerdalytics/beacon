import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { derive, effect, state } from '../src/index.ts'

describe(
	'Cleanup',
	{
		concurrency: true,
		timeout: 1000,
	},
	(): void => {
		it('cleans up effect dependencies', (): void => {
			const $state = state({
				value: 0,
			})
			let effectCount = 0

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

		it('cleans up multiple dependencies', (): void => {
			const $a = state({
				value: 1,
			})
			const $b = state({
				value: 2,
			})
			const $c = state({
				value: 3,
			})
			let effectCount = 0

			const dispose = effect((): void => {
				effectCount++
				$a.value + $b.value + $c.value
			})

			assert.strictEqual(effectCount, 1)

			dispose()

			$a.value = 10
			$b.value = 20
			$c.value = 30

			assert.strictEqual(effectCount, 1)
		})

		it('cleans up nested effects', (): void => {
			const $state = state({
				value: 0,
			})
			let outerCount = 0
			let innerCount = 0

			const disposeOuter = effect((): void => {
				outerCount++
				$state.value

				const _disposeInner = effect((): void => {
					innerCount++
					$state.value
				})
			})

			assert.strictEqual(outerCount, 1)
			assert.strictEqual(innerCount, 1)

			$state.value = 1
			assert.strictEqual(outerCount, 2)
			assert.strictEqual(innerCount, 2)

			disposeOuter()

			$state.value = 2
			assert.strictEqual(outerCount, 2)
			assert.strictEqual(innerCount, 2)
		})

		it('handles multiple disposals safely', (): void => {
			const $state = state({
				value: 0,
			})
			let effectCount = 0

			const dispose = effect((): void => {
				effectCount++
				$state.value
			})

			assert.strictEqual(effectCount, 1)

			dispose()
			dispose()
			dispose()

			$state.value = 1
			assert.strictEqual(effectCount, 1)
		})

		it('cleans up complex dependency chains', (): void => {
			const $a = state({
				value: 1,
			})
			const $b = derive((): number => $a.value * 2)
			const $c = derive((): number => ($b.value as number) + 1)
			let effectCount = 0

			const dispose = effect((): void => {
				effectCount++
				$c.value
			})

			assert.strictEqual(effectCount, 1)
			assert.strictEqual($c.value, 3)

			dispose()

			$a.value = 10
			assert.strictEqual(effectCount, 1)
			assert.strictEqual($c.value, 21)
		})

		it('cleans up during state updates', (): void => {
			const $state = state({
				value: 0,
			})
			const disposals: (() => void)[] = []
			let createCount = 0

			const mainDispose = effect((): void => {
				createCount++

				while (disposals.length > 0) {
					const dispose = disposals.pop()
					if (dispose) dispose()
				}

				if ($state.value < 3) {
					disposals.push(
						effect((): void => {
							$state.value
						})
					)
				}
			})

			assert.strictEqual(createCount, 1)
			assert.strictEqual(disposals.length, 1)

			$state.value = 1
			assert.strictEqual(createCount, 2)
			assert.strictEqual(disposals.length, 1)

			$state.value = 2
			assert.strictEqual(createCount, 3)
			assert.strictEqual(disposals.length, 1)

			$state.value = 3
			assert.strictEqual(createCount, 4)
			assert.strictEqual(disposals.length, 0)

			mainDispose()
		})

		it('prevents disposed effects from creating new dependencies', (): void => {
			const $a = state({
				value: 1,
			})
			const $b = state({
				value: 2,
			})
			let value = 0

			const dispose = effect((): void => {
				value = $a.value
			})

			assert.strictEqual(value, 1)

			dispose()

			assert.doesNotThrow((): void => {
				$b.value = 10
			})

			$a.value = 5
			assert.strictEqual(value, 1)
		})

		it('cleans up interleaved effects', (): void => {
			const $state = state({
				value: 0,
			})
			const results: string[] = []

			const dispose1 = effect((): void => {
				results.push(`e1:${$state.value}`)
			})

			const dispose2 = effect((): void => {
				results.push(`e2:${$state.value}`)
			})

			const dispose3 = effect((): void => {
				results.push(`e3:${$state.value}`)
			})

			assert.deepStrictEqual(results, [
				'e1:0',
				'e2:0',
				'e3:0',
			])

			results.length = 0
			$state.value = 1
			assert.deepStrictEqual(results, [
				'e1:1',
				'e2:1',
				'e3:1',
			])

			dispose2()

			results.length = 0
			$state.value = 2
			assert.deepStrictEqual(results, [
				'e1:2',
				'e3:2',
			])

			dispose1()
			dispose3()

			results.length = 0
			$state.value = 3
			assert.deepStrictEqual(results, [])
		})
	}
)
