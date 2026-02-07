import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { derive, state } from '../src/index.ts'

describe(
	'Derive Core',
	{
		concurrency: true,
		timeout: 1000,
	},
	(): void => {
		it('computes derived value', (): void => {
			const $count = state({
				value: 5,
			})
			const $doubled = derive((): number => $count.value * 2)

			assert.strictEqual($doubled.value, 10)
		})

		it('caches computed value', (): void => {
			let computeCount = 0
			const $count = state({
				value: 5,
			})

			const $doubled = derive((): number => {
				computeCount++
				return $count.value * 2
			})

			assert.strictEqual($doubled.value, 10)
			assert.strictEqual(computeCount, 1)

			assert.strictEqual($doubled.value, 10)
			assert.strictEqual($doubled.value, 10)
			assert.strictEqual(computeCount, 1)
		})

		it('updates when dependencies change', (): void => {
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

		it('handles multiple dependencies', (): void => {
			const $a = state({
				value: 2,
			})
			const $b = state({
				value: 3,
			})
			const $sum = derive((): number => $a.value + $b.value)

			assert.strictEqual($sum.value, 5)

			$a.value = 10
			assert.strictEqual($sum.value, 13)

			$b.value = 20
			assert.strictEqual($sum.value, 30)
		})

		it('chains derived values', (): void => {
			const $base = state({
				value: 2,
			})
			const $doubled = derive((): number => $base.value * 2)
			const $quadrupled = derive((): number => ($doubled.value as number) * 2)

			assert.strictEqual($base.value, 2)
			assert.strictEqual($doubled.value, 4)
			assert.strictEqual($quadrupled.value, 8)

			$base.value = 3
			assert.strictEqual($doubled.value, 6)
			assert.strictEqual($quadrupled.value, 12)
		})

		it('handles different data types', (): void => {
			const $name = state({
				value: 'Alice',
			})
			const $greeting = derive((): string => `Hello, ${$name.value}!`)

			assert.strictEqual($greeting.value, 'Hello, Alice!')

			$name.value = 'Bob'
			assert.strictEqual($greeting.value, 'Hello, Bob!')
		})

		it('computes complex transformations', (): void => {
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

			const $avg = derive((): number => ($items.list.length > 0 ? ($sum.value as number) / $items.list.length : 0))

			const $filtered = derive((): number[] => $items.list.filter((x: number): boolean => x > 2))

			assert.strictEqual($sum.value, 15)
			assert.strictEqual($avg.value, 3)
			assert.deepStrictEqual(
				$filtered.value,
				[
					3,
					4,
					5,
				]
			)

			$items.list.push(6)
			assert.strictEqual($sum.value, 21)
			assert.strictEqual($avg.value, 3.5)
			assert.deepStrictEqual(
				$filtered.value,
				[
					3,
					4,
					5,
					6,
				]
			)
		})

		it('handles same-value updates efficiently', (): void => {
			let computeCount = 0
			const $state = state({
				value: 5,
			})

			const $derived = derive((): number => {
				computeCount++
				return $state.value * 2
			})

			assert.strictEqual($derived.value, 10)
			assert.strictEqual(computeCount, 1)

			$state.value = 5
			assert.strictEqual($derived.value, 10)
			assert.strictEqual(computeCount, 1)

			$state.value = 10
			assert.strictEqual($derived.value, 20)
			assert.strictEqual(computeCount, 2)
		})

		it('pauses and resumes reactivity', (): void => {
			const $count = state({
				value: 5,
			})
			const $doubled = derive((): number => $count.value * 2)

			assert.strictEqual($doubled.reactive, true)
			assert.strictEqual($doubled.value, 10)

			$doubled.reactive = false
			assert.strictEqual($doubled.reactive, false)

			$count.value = 10
			assert.strictEqual($doubled.value, 10)

			$doubled.reactive = true
			assert.strictEqual($doubled.reactive, true)
			assert.strictEqual($doubled.value, 20)
		})

		it('propagates errors from computation', (): void => {
			const $toggle = state({
				value: false,
			})

			const $problematic = derive((): string => {
				if ($toggle.value) {
					throw new Error('Computation error')
				}
				return 'OK'
			})

			assert.strictEqual($problematic.value, 'OK')

			assert.throws((): void => {
				$toggle.value = true
			}, /Computation error/)

			assert.strictEqual($problematic.value, 'OK')

			$toggle.value = false
			assert.strictEqual($problematic.value, 'OK')
		})
	}
)
