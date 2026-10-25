import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { batch, effect, state } from '../src/index.ts'

describe('State Hooks', {
	concurrency: true,
	timeout: 1000,
}, () => {
	it('works without hooks (backward compat)', () => {
		const $s = state({
			count: 0,
		})
		$s.count = 1
		assert.strictEqual($s.count, 1)
	})

	it('fires onRead with correct arguments', () => {
		const calls: unknown[][] = []
		const $s = state(
			{
				name: 'Alice',
			},
			{
				onRead: (
					prop: PropertyKey,
					value: unknown,
					target: {
						name: string
					}
				) => {
					calls.push([prop, value, target])
				},
			}
		)
		const _v = $s.name
		assert.strictEqual(calls.length, 1)
		assert.strictEqual(calls[0]?.[0], 'name')
		assert.strictEqual(calls[0]?.[1], 'Alice')
	})

	it('fires onWrite with correct arguments', () => {
		const calls: unknown[][] = []
		const $s = state(
			{
				count: 0,
			},
			{
				onWrite: (
					prop: PropertyKey,
					oldValue: unknown,
					newValue: unknown,
					target: {
						count: number
					}
				) => {
					calls.push([prop, oldValue, newValue, target])
				},
			}
		)
		$s.count = 5
		assert.strictEqual(calls.length, 1)
		assert.strictEqual(calls[0]?.[0], 'count')
		assert.strictEqual(calls[0]?.[1], 0)
		assert.strictEqual(calls[0]?.[2], 5)
	})

	it('does not fire onWrite for same-value writes', () => {
		let callCount = 0
		const $s = state(
			{
				count: 0,
			},
			{
				onWrite: () => {
					callCount++
				},
			}
		)
		$s.count = 0
		assert.strictEqual(callCount, 0)
	})

	it('fires onWrite once for a batched write and not for a batched same-value write', () => {
		const calls: unknown[][] = []
		const raw = { a: 1 }
		const $s = state(raw, {
			onWrite: (prop: PropertyKey, oldValue: unknown, newValue: unknown, target: { a: number }) => {
				calls.push([prop, oldValue, newValue, target])
			},
		})
		let effectCount = 0
		const dispose = effect(() => {
			effectCount++
			$s.a
		})

		batch(() => {
			$s.a = 2
		})
		assert.deepStrictEqual(calls, [['a', 1, 2, raw]])
		assert.strictEqual(calls[0]?.[3], raw)
		assert.strictEqual(effectCount, 2)

		batch(() => {
			$s.a = 2
		})
		assert.strictEqual(calls.length, 1)

		$s.a = 3
		assert.deepStrictEqual(calls[1], ['a', 2, 3, raw])
		assert.strictEqual(effectCount, 3)
		dispose()
	})

	it('fires onDelete with correct arguments', () => {
		const calls: unknown[][] = []
		const $s = state(
			{
				temp: 'value',
			} as Record<string, unknown>,
			{
				onDelete: (prop: PropertyKey, hadProperty: boolean, target: Record<string, unknown>) => {
					calls.push([prop, hadProperty, target])
				},
			}
		)
		delete $s.temp
		assert.strictEqual(calls.length, 1)
		assert.strictEqual(calls[0]?.[0], 'temp')
		assert.strictEqual(calls[0]?.[1], true)
	})

	it('fires onHas with correct arguments', () => {
		const calls: unknown[][] = []
		const $s = state(
			{
				name: 'Alice',
			},
			{
				onHas: (
					prop: PropertyKey,
					exists: boolean,
					target: {
						name: string
					}
				) => {
					calls.push([prop, exists, target])
				},
			}
		)
		const _has = 'name' in $s
		const _hasNot = 'age' in $s
		assert.strictEqual(calls.length, 2)
		assert.strictEqual(calls[0]?.[1], true)
		assert.strictEqual(calls[1]?.[1], false)
	})

	it('fires onOwnKeys with correct arguments', () => {
		const calls: unknown[][] = []
		const $s = state(
			{
				a: 1,
				b: 2,
			},
			{
				onOwnKeys: (
					keys: PropertyKey[],
					target: {
						a: number
						b: number
					}
				) => {
					calls.push([keys, target])
				},
			}
		)
		Object.keys($s)
		assert.strictEqual(calls.length, 1)
		assert.ok(Array.isArray(calls[0]?.[0]))
	})

	it('propagates hooks to nested objects', () => {
		const writes: string[] = []
		const $s = state(
			{
				user: {
					name: 'Alice',
					settings: {
						theme: 'dark',
					},
				},
			},
			{
				onWrite: (prop: PropertyKey) => {
					writes.push(String(prop))
				},
			}
		)
		$s.user.name = 'Bob'
		$s.user.settings.theme = 'light'
		assert.deepStrictEqual(writes, ['name', 'theme'])
	})

	it('returns reactive nested proxies and passes primitives through when hooked', () => {
		const reads: string[] = []
		const raw = {
			count: 1,
			empty: null,
			label: 'a',
			user: {
				name: 'Alice',
			},
		}
		const $s = state(raw, {
			onRead: (prop: PropertyKey) => {
				reads.push(String(prop))
			},
		})

		assert.strictEqual($s.count, 1)
		assert.strictEqual($s.label, 'a')
		assert.strictEqual($s.empty, null)
		assert.notStrictEqual($s.user, raw.user)
		assert.strictEqual($s.user, $s.user)

		const names: string[] = []
		const dispose = effect(() => {
			names.push($s.user.name)
		})
		$s.user.name = 'Bob'
		dispose()

		assert.deepStrictEqual(names, ['Alice', 'Bob'])
		assert.ok(reads.includes('name'))
	})

	it('fires onRead when array mutating methods are accessed', () => {
		const reads: string[] = []
		const $s = state(
			{
				items: [1, 2, 3],
			},
			{
				onRead: (prop: PropertyKey) => {
					reads.push(String(prop))
				},
			}
		)
		$s.items.push(4)
		assert.ok(reads.some((r) => r === 'push'))
	})

	it('fires onWrite for each property push writes with the arguments a direct write produces', () => {
		const calls: unknown[][] = []
		const raw: number[] = []
		const $list = state(raw, {
			onWrite: (prop: PropertyKey, oldValue: unknown, newValue: unknown, target: number[]) => {
				calls.push([prop, oldValue, newValue, target])
			},
		})

		$list.push(1)

		// push sets length to the value it already holds after the index write, so length is not reported
		assert.deepStrictEqual(calls, [['0', undefined, 1, raw]])
	})

	it('fires onRead with the method name and length for push', () => {
		const reads: PropertyKey[] = []
		const $list = state([] as number[], {
			onRead: (prop: PropertyKey) => {
				reads.push(prop)
			},
		})

		$list.push(1)

		assert.ok(reads.includes('push'))
		assert.ok(reads.includes('length'))
	})

	it('fires onWrite for direct array index assignment', () => {
		const writes: string[] = []
		const $s = state(
			{
				items: [1, 2, 3],
			},
			{
				onWrite: (prop: PropertyKey) => {
					writes.push(String(prop))
				},
			}
		)
		$s.items[0] = 99
		assert.ok(writes.some((r) => r === '0'))
	})

	it('isolates hook errors from core functionality', () => {
		const $s = state(
			{
				count: 0,
			},
			{
				onWrite: () => {
					throw new Error('hook error')
				},
			}
		)
		$s.count = 1
		assert.strictEqual($s.count, 1)
	})

	it('executes array hooks in order', () => {
		const calls: number[] = []
		const $s = state(
			{
				count: 0,
			},
			{
				onWrite: [
					() => {
						calls.push(1)
					},
					() => {
						calls.push(2)
					},
					() => {
						calls.push(3)
					},
				],
			}
		)
		$s.count = 1
		assert.deepStrictEqual(calls, [1, 2, 3])
	})

	it('maintains object identity when hooked', () => {
		const reads: PropertyKey[] = []
		const $s = state(
			{
				value: 1,
			},
			{
				onRead: (prop: PropertyKey) => {
					reads.push(prop)
				},
			}
		)
		const $same = state($s)

		assert.strictEqual($same, $s)
		assert.deepStrictEqual(reads, [])
	})

	it('fires onRead for a frozen object', () => {
		const reads: PropertyKey[] = []
		const $frozen = state(
			Object.freeze({
				limit: 10,
			}),
			{
				onRead: (prop: PropertyKey) => {
					reads.push(prop)
				},
			}
		)

		assert.strictEqual($frozen.limit, 10)
		assert.deepStrictEqual(reads, ['limit'])
	})

	it('defines the hooks symbol on an array target only', () => {
		// Counted before any read or subscription: the subscribers symbol is added lazily on first subscription
		const hooks = { onRead: (): void => {} }
		const hookedObject = { count: 0 }
		const hookedArray = [0]
		const hooklessObject = { count: 0 }
		state(hookedObject, hooks)
		state(hookedArray, hooks)
		state(hooklessObject)

		assert.strictEqual(Object.getOwnPropertySymbols(hookedObject).length, 1)
		assert.strictEqual(Object.getOwnPropertySymbols(hookedArray).length, 2)
		assert.strictEqual(Object.getOwnPropertySymbols(hooklessObject).length, 1)
	})
})
