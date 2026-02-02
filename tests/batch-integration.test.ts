import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { batch, derive, effect, state } from '../src/index.ts'

interface Item {
	name: string
	price: number
}

describe(
	'Batch Integration',
	{
		concurrency: true,
		timeout: 1000,
	},
	(): void => {
		it('batches state updates for effects', (): void => {
			const $a = state({
				value: 0,
			})
			const $b = state({
				value: 0,
			})
			const $c = state({
				value: 0,
			})
			let effectCount = 0

			const dispose = effect((): void => {
				effectCount++
				$a.value + $b.value + $c.value
			})

			assert.strictEqual(effectCount, 1)

			batch((): void => {
				$a.value = 1
				$b.value = 2
				$c.value = 3
			})

			assert.strictEqual(effectCount, 2)
			assert.strictEqual($a.value, 1)
			assert.strictEqual($b.value, 2)
			assert.strictEqual($c.value, 3)

			dispose()
		})

		it('batches updates for derived values', (): void => {
			const $a = state({
				value: 1,
			})
			const $b = state({
				value: 2,
			})
			const $c = state({
				value: 3,
			})
			let computeCount = 0

			const $sum = derive((): number => {
				computeCount++
				return $a.value + $b.value + $c.value
			})

			assert.strictEqual($sum.value, 6)
			assert.strictEqual(computeCount, 1)

			$a.value = 10
			assert.strictEqual(computeCount, 2)

			$b.value = 20
			assert.strictEqual(computeCount, 3)

			computeCount = 0

			batch((): void => {
				$a.value = 100
				$b.value = 200
				$c.value = 300
			})

			assert.strictEqual(computeCount, 1)
			assert.strictEqual($sum.value, 600)
		})

		it('handles nested batches correctly', (): void => {
			const $state = state({
				value: 0,
			})
			const results: number[] = []

			const dispose = effect((): void => {
				results.push($state.value)
			})

			assert.deepStrictEqual(
				results,
				[
					0,
				]
			)

			batch((): void => {
				$state.value = 1

				batch((): void => {
					$state.value = 2

					batch((): void => {
						$state.value = 3
					})

					$state.value = 4
				})

				$state.value = 5
			})

			assert.deepStrictEqual(
				results,
				[
					0,
					5,
				]
			)

			dispose()
		})

		it('batches array operations', (): void => {
			const $items = state({
				list: [
					1,
					2,
					3,
				],
			})
			let effectCount = 0

			const dispose = effect((): void => {
				effectCount++
				$items.list.length
			})

			assert.strictEqual(effectCount, 1)

			batch((): void => {
				$items.list.push(4)
				$items.list.push(5)
				$items.list.push(6)
				$items.list.pop()
			})

			assert.strictEqual(effectCount, 2)
			assert.deepStrictEqual(
				$items.list,
				[
					1,
					2,
					3,
					4,
					5,
				]
			)

			dispose()
		})

		it('creates effects inside batch', (): void => {
			const $state = state({
				value: 0,
			})
			const results: number[] = []

			batch((): void => {
				$state.value = 1

				const dispose = effect((): void => {
					results.push($state.value)
				})

				$state.value = 2

				dispose()
			})

			assert.deepStrictEqual(
				results,
				[
					2,
				]
			)
		})

		it('batches multiple state objects', (): void => {
			const $user = state({
				age: 30,
				name: 'Alice',
			})
			const $settings = state({
				lang: 'en',
				theme: 'dark',
			})
			const $app = state({
				loaded: false,
				version: '1.0',
			})
			const results: string[] = []

			const dispose = effect((): void => {
				results.push(`${$user.name}/${$settings.theme}/${$app.version}`)
			})

			assert.deepStrictEqual(results, [
				'Alice/dark/1.0',
			])

			batch((): void => {
				$user.name = 'Bob'
				$user.age = 25
				$settings.theme = 'light'
				$settings.lang = 'fr'
				$app.version = '2.0'
				$app.loaded = true
			})

			assert.deepStrictEqual(results, [
				'Alice/dark/1.0',
				'Bob/light/2.0',
			])

			dispose()
		})

		it('optimizes filtering and sorting with batch', (): void => {
			const $list = state<{
				filter: string
				items: Item[]
				sort: string
			}>({
				filter: '',
				items: [
					{
						name: 'apple',
						price: 2,
					},
					{
						name: 'banana',
						price: 1,
					},
					{
						name: 'cherry',
						price: 3,
					},
				],
				sort: 'name',
			})

			let computeCount = 0
			const $filtered = derive((): Item[] => {
				computeCount++
				return $list.items
					.filter((item: Item): boolean => item.name.includes($list.filter))
					.sort((a: Item, b: Item): number => {
						if ($list.sort === 'name') {
							return a.name.localeCompare(b.name)
						} else {
							return a.price - b.price
						}
					})
			})

			assert.strictEqual($filtered.value?.length, 3)
			assert.strictEqual(computeCount, 1)

			$list.filter = 'a'
			assert.strictEqual(computeCount, 2)

			$list.sort = 'price'
			assert.strictEqual(computeCount, 3)

			computeCount = 0

			batch((): void => {
				$list.filter = 'e'
				$list.sort = 'name'
			})

			assert.strictEqual(computeCount, 1)
			assert.strictEqual($filtered.value?.length, 2)
		})
	}
)
