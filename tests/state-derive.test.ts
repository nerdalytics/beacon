import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { derive, state } from '../src/index.ts'

// Define interface for Item type
interface Item {
	id: number
	name: string
	price: number
}

describe(
	'State-Derive Integration',
	{
		concurrency: true,
		timeout: 1000,
	},
	(): void => {
		it('updates derived value when state changes', (): void => {
			const $count = state({
				value: 5,
			})
			const $doubled = derive((): number => $count.value * 2)

			assert.strictEqual($doubled.value, 10)

			$count.value = 10
			assert.strictEqual($doubled.value, 20)

			$count.value = 0
			assert.strictEqual($doubled.value, 0)
		})

		it('chains multiple derived values', (): void => {
			const $base = state({
				value: 2,
			})
			const $doubled = derive((): number => $base.value * 2)
			const $quadrupled = derive((): number => $doubled.value * 2)
			const $final = derive((): number => $quadrupled.value + 1)

			assert.strictEqual($base.value, 2)
			assert.strictEqual($doubled.value, 4)
			assert.strictEqual($quadrupled.value, 8)
			assert.strictEqual($final.value, 9)

			$base.value = 3
			assert.strictEqual($doubled.value, 6)
			assert.strictEqual($quadrupled.value, 12)
			assert.strictEqual($final.value, 13)
		})

		it('derives from multiple states', (): void => {
			const $firstName = state({
				value: 'John',
			})
			const $lastName = state({
				value: 'Doe',
			})
			const $age = state({
				value: 30,
			})

			const $fullName = derive((): string => `${$firstName.value} ${$lastName.value}`)
			const $description = derive((): string => `${$fullName.value}, age ${$age.value}`)

			assert.strictEqual($fullName.value, 'John Doe')
			assert.strictEqual($description.value, 'John Doe, age 30')

			$firstName.value = 'Jane'
			assert.strictEqual($fullName.value, 'Jane Doe')
			assert.strictEqual($description.value, 'Jane Doe, age 30')

			$age.value = 25
			assert.strictEqual($description.value, 'Jane Doe, age 25')
		})

		it('handles conditional dependencies', (): void => {
			const $useA = state({
				value: true,
			})
			const $a = state({
				value: 'A',
			})
			const $b = state({
				value: 'B',
			})

			const $result = derive((): string => ($useA.value ? $a.value : $b.value))

			assert.strictEqual($result.value, 'A')

			$a.value = 'AA'
			assert.strictEqual($result.value, 'AA')

			$b.value = 'BB'
			assert.strictEqual($result.value, 'AA')

			$useA.value = false
			assert.strictEqual($result.value, 'BB')

			$a.value = 'AAA'
			assert.strictEqual($result.value, 'BB')

			$b.value = 'BBB'
			assert.strictEqual($result.value, 'BBB')
		})

		it('derives from arrays', (): void => {
			const $items = state({
				list: [
					1,
					2,
					3,
					4,
					5,
				],
			})

			const $sum = derive((): number => $items.list.reduce((a: number, b: number): number => a + b, 0))
			const $count = derive((): number => $items.list.length)
			const $avg = derive((): number => ($count.value > 0 ? $sum.value / $count.value : 0))
			const $evens = derive((): number[] => $items.list.filter((x: number): boolean => x % 2 === 0))

			assert.strictEqual($sum.value, 15)
			assert.strictEqual($count.value, 5)
			assert.strictEqual($avg.value, 3)
			assert.deepStrictEqual(
				$evens.value,
				[
					2,
					4,
				]
			)

			$items.list.push(6)
			assert.strictEqual($sum.value, 21)
			assert.strictEqual($count.value, 6)
			assert.strictEqual($avg.value, 3.5)
			assert.deepStrictEqual(
				$evens.value,
				[
					2,
					4,
					6,
				]
			)

			$items.list = [
				10,
				20,
			]
			assert.strictEqual($sum.value, 30)
			assert.strictEqual($count.value, 2)
			assert.strictEqual($avg.value, 15)
			assert.deepStrictEqual(
				$evens.value,
				[
					10,
					20,
				]
			)
		})

		it('derives from nested objects', (): void => {
			const $app = state({
				settings: {
					fontSize: 14,
					theme: 'dark',
				},
				user: {
					name: 'Alice',
					role: 'admin',
				},
			})

			const $displayName = derive((): string => `${$app.user.name} (${$app.user.role})`)

			const $cssClass = derive((): string => `theme-${$app.settings.theme} font-${$app.settings.fontSize}`)

			assert.strictEqual($displayName.value, 'Alice (admin)')
			assert.strictEqual($cssClass.value, 'theme-dark font-14')

			$app.user.role = 'user'
			assert.strictEqual($displayName.value, 'Alice (user)')

			$app.settings.theme = 'light'
			$app.settings.fontSize = 16
			assert.strictEqual($cssClass.value, 'theme-light font-16')
		})

		it('handles complex filtering and sorting', (): void => {
			const $data = state({
				filter: '',
				items: [
					{
						id: 1,
						name: 'apple',
						price: 2,
					},
					{
						id: 2,
						name: 'banana',
						price: 1,
					},
					{
						id: 3,
						name: 'cherry',
						price: 3,
					},
					{
						id: 4,
						name: 'apricot',
						price: 2.5,
					},
				] as Item[],
				sortBy: 'name',
			})

			const $filtered = derive((): Item[] => {
				let items = $data.items

				if ($data.filter) {
					items = items.filter((item: Item): boolean => item.name.includes($data.filter))
				}

				const sorted = [
					...items,
				].sort((a: Item, b: Item): number => {
					if ($data.sortBy === 'name') {
						return a.name.localeCompare(b.name)
					} else {
						return a.price - b.price
					}
				})

				return sorted
			})

			assert.deepStrictEqual(
				$filtered.value.map((i: Item): string => i.name),
				[
					'apple',
					'apricot',
					'banana',
					'cherry',
				]
			)

			$data.filter = 'ap'
			assert.deepStrictEqual(
				$filtered.value.map((i: Item): string => i.name),
				[
					'apple',
					'apricot',
				]
			)

			$data.sortBy = 'price'
			assert.deepStrictEqual(
				$filtered.value.map((i: Item): string => i.name),
				[
					'apple',
					'apricot',
				]
			)

			$data.filter = ''
			assert.deepStrictEqual(
				$filtered.value.map((i: Item): string => i.name),
				[
					'banana',
					'apple',
					'apricot',
					'cherry',
				]
			)
		})

		it('only recomputes when relevant dependencies change', (): void => {
			let computeCount = 0
			const $state = state({
				a: 1,
				b: 2,
				c: 3,
			})

			const $derived = derive((): number => {
				computeCount++
				return $state.a + $state.b
			})

			assert.strictEqual($derived.value, 3)
			assert.strictEqual(computeCount, 1)

			$state.c = 10
			assert.strictEqual($derived.value, 3)
			assert.strictEqual(computeCount, 1)

			$state.a = 5
			assert.strictEqual($derived.value, 7)
			assert.strictEqual(computeCount, 2)

			$state.b = 10
			assert.strictEqual($derived.value, 15)
			assert.strictEqual(computeCount, 3)
		})
	}
)
