import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { state } from '../src/index.ts'

interface DynamicObject {
	a?: number
	b?: number
	c?: number
}

interface AppState {
	user?: {
		name: string
		email?: string
	}
	settings?: {
		theme: string
	}
	data?: number[]
}

describe('State Core', {
	concurrency: true,
	timeout: 1000,
}, (): void => {
	it('creates reactive state for primitives wrapped in objects', () => {
		const $count = state({
			value: 0,
		})

		assert.strictEqual($count.value, 0)

		$count.value = 5
		assert.strictEqual($count.value, 5)
	})

	it('creates reactive state for objects', () => {
		const $user = state({
			age: 30,
			name: 'Alice',
		})

		assert.strictEqual($user.name, 'Alice')
		assert.strictEqual($user.age, 30)

		$user.name = 'Bob'
		$user.age = 31

		assert.strictEqual($user.name, 'Bob')
		assert.strictEqual($user.age, 31)
	})

	it('creates reactive state for arrays', () => {
		const $items = state([
			1,
			2,
			3,
		])

		assert.strictEqual($items.length, 3)
		assert.strictEqual($items[0], 1)

		$items.push(4)
		assert.strictEqual($items.length, 4)
		assert.strictEqual($items[3], 4)

		$items[0] = 10
		assert.strictEqual($items[0], 10)

		$items.pop()
		assert.strictEqual($items.length, 3)
	})

	it('handles nested objects', () => {
		const $parent = state({
			child: {
				value: 0,
			},
		})

		assert.strictEqual($parent.child.value, 0)

		$parent.child.value = 10
		assert.strictEqual($parent.child.value, 10)

		$parent.child = {
			value: 20,
		}
		assert.strictEqual($parent.child.value, 20)
	})

	it('supports property deletion', () => {
		const $obj = state<DynamicObject>({
			a: 1,
			b: 2,
			c: 3,
		})

		assert.strictEqual($obj.a, 1)
		assert.strictEqual($obj.b, 2)
		assert.strictEqual($obj.c, 3)

		delete $obj.b
		assert.strictEqual($obj.b, undefined)
		assert.strictEqual('b' in $obj, false)
	})

	it('handles array mutations', () => {
		const $list = state([
			1,
			2,
			3,
			4,
			5,
		])

		$list.splice(1, 2)
		assert.deepStrictEqual(
			[
				...$list,
			],
			[
				1,
				4,
				5,
			]
		)

		$list.reverse()
		assert.deepStrictEqual(
			[
				...$list,
			],
			[
				5,
				4,
				1,
			]
		)

		$list.sort()
		assert.deepStrictEqual(
			[
				...$list,
			],
			[
				1,
				4,
				5,
			]
		)

		$list.length = 2
		assert.deepStrictEqual(
			[
				...$list,
			],
			[
				1,
				4,
			]
		)
	})

	it('builds objects dynamically', () => {
		const $app = state<AppState>({})

		assert.strictEqual(Object.keys($app).length, 0)

		$app.user = {
			name: 'Alice',
		}
		$app.settings = {
			theme: 'dark',
		}
		$app.data = []

		assert.strictEqual($app.user.name, 'Alice')
		assert.strictEqual($app.settings.theme, 'dark')
		assert.strictEqual($app.data.length, 0)

		$app.user.email = 'alice@example.com'
		assert.strictEqual($app.user.email, 'alice@example.com')

		$app.data.push(1, 2, 3)
		assert.strictEqual($app.data.length, 3)
	})

	it('maintains object identity', () => {
		const $state = state({
			value: 1,
		})
		const $same = state($state)

		assert.strictEqual($state, $same)
	})

	it('returns cached proxy for same object', () => {
		const initialObj = {
			value: 0,
		}
		const $signal = state(initialObj)
		const $cached = state(initialObj)

		assert.strictEqual($cached, $signal)
	})

	it('ignores null and undefined', () => {
		// Testing edge cases where non-object values are passed
		// The type system prevents this, but runtime handles it gracefully
		// @ts-expect-error - Testing runtime behavior with invalid types
		const $null = state(null)
		// @ts-expect-error - Testing runtime behavior with invalid types
		const $undefined = state(undefined)

		assert.strictEqual($null, null)
		assert.strictEqual($undefined, undefined)
	})

	it('maintains referential equality for unchanged values', () => {
		const $state = state({
			value: 5,
		})

		$state.value = 5
		assert.strictEqual($state.value, 5)

		$state.value = 5
		assert.strictEqual($state.value, 5)
	})
})
