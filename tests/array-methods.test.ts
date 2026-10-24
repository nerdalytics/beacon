import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { batch, effect, state } from '../src/index.ts'
import type { StateHooks } from '../src/types.ts'

// Both kinds of state: hooks only observe, so every assertion runs against each
const observingHooks: StateHooks<number[]> = {
	onRead: (): void => {},
	onWrite: (): void => {},
}

function bothKinds(initial: number[]): number[][] {
	return [state([...initial]), state([...initial], observingHooks)]
}

describe('Array Mutating Methods', {
	concurrency: true,
	timeout: 1000,
}, (): void => {
	it('wakes an effect reading index 0 and length once after push on an empty array', (): void => {
		for (const $list of bothKinds([])) {
			const seen: [number | undefined, number][] = []
			const dispose = effect((): void => {
				seen.push([$list[0], $list.length])
			})

			$list.push(1)

			assert.deepStrictEqual(seen, [
				[undefined, 0],
				[1, 1],
			])
			dispose()
		}
	})

	it('wakes an effect reading only index 1 once after push', (): void => {
		for (const $list of bothKinds([0, 1, 2])) {
			let runs = 0
			const dispose = effect((): void => {
				runs++
				void $list[1]
			})

			$list.push(3)

			assert.strictEqual(runs, 2)
			dispose()
		}
	})

	it('does not wake an effect when sort or reverse leaves every element as it was', (): void => {
		for (const $sorted of bothKinds([1, 2, 3])) {
			let runs = 0
			const dispose = effect((): void => {
				runs++
				for (let i = 0; i < 3; i++) void $sorted[i]
			})

			$sorted.sort()

			assert.strictEqual(runs, 1)
			dispose()
		}

		for (const $palindrome of bothKinds([1, 2, 1])) {
			let runs = 0
			const dispose = effect((): void => {
				runs++
				for (let i = 0; i < 3; i++) void $palindrome[i]
			})

			$palindrome.reverse()

			assert.strictEqual(runs, 1)
			dispose()
		}
	})

	it('defers wakes from push and pop to the end of a user batch', (): void => {
		for (const $list of bothKinds([])) {
			let runs = 0
			const dispose = effect((): void => {
				runs++
				void $list.length
			})

			batch((): void => {
				$list.push(1)
				$list.pop()
				assert.strictEqual(runs, 1)
			})

			assert.strictEqual(runs, 2)
			assert.strictEqual($list.length, 0)
			dispose()
		}
	})

	it('returns what the native method returns and leaves the same contents', (): void => {
		const descending = (a: number, b: number): number => b - a
		const cases: [string, (list: number[]) => unknown][] = [
			['push', (list: number[]): unknown => list.push(4, 5)],
			['pop', (list: number[]): unknown => list.pop()],
			['shift', (list: number[]): unknown => list.shift()],
			['unshift', (list: number[]): unknown => list.unshift(8, 9)],
			['splice', (list: number[]): unknown => list.splice(1, 2, 9)],
			['sort', (list: number[]): unknown => list.sort(descending)],
			['reverse', (list: number[]): unknown => list.reverse()],
		]
		for (const [name, call] of cases) {
			const plain = [0, 1, 2, 3]
			const expected = call(plain)
			for (const $list of bothKinds([0, 1, 2, 3])) {
				const result = call($list)
				assert.deepStrictEqual(
					result === $list ? '<receiver>' : result,
					expected === plain ? '<receiver>' : expected,
					name
				)
				assert.deepStrictEqual([...$list], plain, name)
			}
		}
	})

	it('propagates the TypeError from push on a sealed array and stays usable', (): void => {
		for (const $list of [state(Object.seal([1])), state(Object.seal([1]), observingHooks)]) {
			let runs = 0
			const dispose = effect((): void => {
				runs++
				void $list[0]
			})

			assert.throws((): void => {
				$list.push(2)
			}, TypeError)

			assert.deepStrictEqual([...$list], [1])
			$list[0] = 7
			assert.strictEqual(runs, 2)
			batch((): void => {
				$list[0] = 8
			})
			assert.strictEqual($list[0], 8)
			assert.strictEqual(runs, 3)
			dispose()
		}
	})
})
