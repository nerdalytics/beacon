import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { effect, state } from '../src/index.ts'

interface DynamicObject {
	[key: string]: number | undefined
}

describe(
	'State-Effect Integration',
	{
		concurrency: true,
		timeout: 1000,
	},
	(): void => {
		it('triggers effect when state changes', (): void => {
			const $count = state({
				value: 0,
			})
			let effectCount = 0

			const dispose = effect((): void => {
				effectCount++
				$count.value
			})

			assert.strictEqual(effectCount, 1)

			$count.value = 1
			assert.strictEqual(effectCount, 2)

			$count.value = 2
			assert.strictEqual(effectCount, 3)

			dispose()
		})

		it('tracks multiple state dependencies', (): void => {
			const $a = state({
				value: 1,
			})
			const $b = state({
				value: 2,
			})
			let sum = 0

			const dispose = effect((): void => {
				sum = $a.value + $b.value
			})

			assert.strictEqual(sum, 3)

			$a.value = 10
			assert.strictEqual(sum, 12)

			$b.value = 20
			assert.strictEqual(sum, 30)

			dispose()
		})

		it('handles dynamic dependencies', (): void => {
			const $condition = state({
				value: true,
			})
			const $a = state({
				value: 1,
			})
			const $b = state({
				value: 2,
			})
			let result = 0
			let aReads = 0
			let bReads = 0

			const dispose = effect((): void => {
				if ($condition.value) {
					aReads++
					result = $a.value
				} else {
					bReads++
					result = $b.value
				}
			})

			assert.strictEqual(result, 1)
			assert.strictEqual(aReads, 1)
			assert.strictEqual(bReads, 0)

			$a.value = 10
			assert.strictEqual(result, 10)
			assert.strictEqual(aReads, 2)
			assert.strictEqual(bReads, 0)

			$b.value = 20
			assert.strictEqual(result, 10)
			assert.strictEqual(aReads, 2)
			assert.strictEqual(bReads, 0)

			$condition.value = false
			assert.strictEqual(result, 20)
			assert.strictEqual(aReads, 2)
			assert.strictEqual(bReads, 1)

			$a.value = 100
			assert.strictEqual(result, 20)
			assert.strictEqual(aReads, 2)
			assert.strictEqual(bReads, 1)

			$b.value = 200
			assert.strictEqual(result, 200)
			assert.strictEqual(aReads, 2)
			assert.strictEqual(bReads, 2)

			dispose()
		})

		it('does not trigger on same-value updates', (): void => {
			const $state = state({
				value: 5,
			})
			let effectCount = 0

			const dispose = effect((): void => {
				effectCount++
				$state.value
			})

			assert.strictEqual(effectCount, 1)

			$state.value = 5
			assert.strictEqual(effectCount, 1)

			$state.value = 10
			assert.strictEqual(effectCount, 2)

			$state.value = 10
			assert.strictEqual(effectCount, 2)

			dispose()
		})

		it('tracks nested object changes', (): void => {
			const $state = state({
				user: {
					age: 30,
					name: 'Alice',
				},
			})
			const results: string[] = []

			const dispose = effect((): void => {
				results.push(`${$state.user.name} is ${$state.user.age}`)
			})

			assert.deepStrictEqual(results, [
				'Alice is 30',
			])

			$state.user.name = 'Bob'
			assert.deepStrictEqual(results, [
				'Alice is 30',
				'Bob is 30',
			])

			$state.user.age = 31
			assert.deepStrictEqual(results, [
				'Alice is 30',
				'Bob is 30',
				'Bob is 31',
			])

			$state.user = {
				age: 25,
				name: 'Charlie',
			}
			assert.deepStrictEqual(results, [
				'Alice is 30',
				'Bob is 30',
				'Bob is 31',
				'Charlie is 25',
			])

			dispose()
		})

		it('tracks array changes', (): void => {
			const $items = state({
				list: [
					1,
					2,
					3,
				],
			})
			const results: number[] = []

			const dispose = effect((): void => {
				results.push($items.list.length)
			})

			assert.deepStrictEqual(
				results,
				[
					3,
				]
			)

			$items.list.push(4)
			assert.deepStrictEqual(
				results,
				[
					3,
					4,
				]
			)

			$items.list.pop()
			$items.list.pop()
			assert.deepStrictEqual(
				results,
				[
					3,
					4,
					3,
					2,
				]
			)

			$items.list = [
				10,
				20,
				30,
				40,
				50,
			]
			assert.deepStrictEqual(
				results,
				[
					3,
					4,
					3,
					2,
					5,
				]
			)

			dispose()
		})

		it('tracks specific array indices', (): void => {
			const $list = state({
				items: [
					1,
					2,
					3,
				],
			})
			let index0Count = 0
			let index1Count = 0

			const dispose0 = effect((): void => {
				index0Count++
				$list.items[0]
			})

			const dispose1 = effect((): void => {
				index1Count++
				$list.items[1]
			})

			assert.strictEqual(index0Count, 1)
			assert.strictEqual(index1Count, 1)

			$list.items[0] = 10
			assert.strictEqual(index0Count, 2)
			assert.strictEqual(index1Count, 1)

			$list.items[1] = 20
			assert.strictEqual(index0Count, 2)
			assert.strictEqual(index1Count, 2)

			$list.items[2] = 30
			assert.strictEqual(index0Count, 2)
			assert.strictEqual(index1Count, 2)

			dispose0()
			dispose1()
		})

		it('tracks object property deletion', (): void => {
			const $obj = state<DynamicObject>({
				a: 1,
				b: 2,
				c: 3,
			})
			const keys: string[] = []

			const dispose = effect((): void => {
				keys.push(Object.keys($obj).join(','))
			})

			assert.deepStrictEqual(keys, [
				'a,b,c',
			])

			delete $obj.b
			assert.deepStrictEqual(keys, [
				'a,b,c',
				'a,c',
			])

			$obj.d = 4
			assert.deepStrictEqual(keys, [
				'a,b,c',
				'a,c',
				'a,c,d',
			])

			delete $obj.a
			delete $obj.c
			assert.deepStrictEqual(keys, [
				'a,b,c',
				'a,c',
				'a,c,d',
				'c,d',
				'd',
			])

			dispose()
		})

		it('handles rapid consecutive updates', (): void => {
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

			for (let i = 1; i <= 10; i++) {
				$state.value = i
			}

			assert.deepStrictEqual(
				results,
				[
					0,
					1,
					2,
					3,
					4,
					5,
					6,
					7,
					8,
					9,
					10,
				]
			)

			dispose()
		})

		it('handles multiple effects on same state', (): void => {
			const $state = state({
				value: 0,
			})
			let effect1Count = 0
			let effect2Count = 0
			let effect3Count = 0

			const dispose1 = effect((): void => {
				effect1Count++
				$state.value
			})

			const dispose2 = effect((): void => {
				effect2Count++
				$state.value * 2
			})

			const dispose3 = effect((): void => {
				effect3Count++
				$state.value * 3
			})

			assert.strictEqual(effect1Count, 1)
			assert.strictEqual(effect2Count, 1)
			assert.strictEqual(effect3Count, 1)

			$state.value = 10

			assert.strictEqual(effect1Count, 2)
			assert.strictEqual(effect2Count, 2)
			assert.strictEqual(effect3Count, 2)

			dispose1()
			dispose2()
			dispose3()
		})
	}
)
