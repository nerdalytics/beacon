import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { batch, effect, state } from '../src/index.ts'
import type { StateHooks } from '../src/types.ts'

// A hook call without its target argument; every call's target is checked to be the raw array as it is recorded
type HookCall =
	| ['onDelete', PropertyKey, boolean]
	| ['onRead', PropertyKey, unknown]
	| ['onWrite', PropertyKey, unknown, unknown]

// The reference (Q59 a): a plain Proxy over the same array reports each trap the native method runs. A set of a
// value equal to that of an existing property is neither reported nor written, because that is what the set trap
// does with it; a set of undefined to an absent property is a change (Q65 a)
function referenceCalls(initial: unknown[], call: (list: unknown[]) => unknown): HookCall[] {
	const calls: HookCall[] = []
	const proxy = new Proxy([...initial], {
		deleteProperty: (target: unknown[], prop: PropertyKey): boolean => {
			calls.push(['onDelete', prop, Object.hasOwn(target, prop)])
			return Reflect.deleteProperty(target, prop)
		},
		get: (target: unknown[], prop: PropertyKey): unknown => {
			const value = Reflect.get(target, prop)
			calls.push(['onRead', prop, value])
			return value
		},
		set: (target: unknown[], prop: PropertyKey, value: unknown): boolean => {
			const oldValue = Reflect.get(target, prop)
			if (Object.is(oldValue, value) && Object.hasOwn(target, prop)) return true
			calls.push(['onWrite', prop, oldValue, value])
			return Reflect.set(target, prop, value)
		},
	})
	call(proxy)
	return calls
}

function recordingHooks(calls: HookCall[], raw: unknown[]): StateHooks<unknown[]> {
	return {
		onDelete: (prop: PropertyKey, had: boolean, target: unknown[]): void => {
			assert.strictEqual(target, raw)
			calls.push(['onDelete', prop, had])
		},
		onRead: (prop: PropertyKey, value: unknown, target: unknown[]): void => {
			assert.strictEqual(target, raw)
			calls.push(['onRead', prop, value])
		},
		onWrite: (prop: PropertyKey, oldValue: unknown, newValue: unknown, target: unknown[]): void => {
			assert.strictEqual(target, raw)
			calls.push(['onWrite', prop, oldValue, newValue])
		},
	}
}

function recordedCalls(initial: unknown[], call: (list: unknown[]) => unknown): HookCall[] {
	const calls: HookCall[] = []
	const raw = [...initial]
	call(state(raw, recordingHooks(calls, raw)))
	return calls
}

const observingHooks: StateHooks<unknown[]> = {
	onDelete: (): void => {},
	onRead: (): void => {},
	onWrite: (): void => {},
}

// Both kinds of state: hooks only observe, so every wake assertion runs against each
function bothKinds(initial: unknown[]): [string, unknown[]][] {
	return [
		['hookless', state([...initial])],
		['hooked', state([...initial], observingHooks)],
	]
}

type Subscription = {
	dispose: () => void
	// Names of the effects re-run since the last call, sorted
	woken: () => string[]
}

// One effect per way of reading a three-element array, plus one on an unrelated state
function subscribe($list: unknown[]): Subscription {
	const $other = state({ x: 0 })
	const runs: string[] = []
	const disposers: (() => void)[] = []
	const reads: [string, () => unknown][] = [
		['first', (): unknown => $list[0]],
		['last', (): unknown => $list[2]],
		['length', (): unknown => $list.length],
		['other', (): unknown => $other.x],
	]
	for (const [name, read] of reads) {
		disposers.push(
			effect((): void => {
				read()
				runs.push(name)
			})
		)
	}
	runs.length = 0
	return {
		dispose: (): void => {
			for (const dispose of disposers) dispose()
		},
		woken: (): string[] => runs.splice(0).sort(),
	}
}

const pushCalls: [string, (list: unknown[]) => unknown][] = [
	['push(3)', (list: unknown[]): unknown => list.push(3)],
	['push(3, 4)', (list: unknown[]): unknown => list.push(3, 4)],
	['push()', (list: unknown[]): unknown => list.push()],
	['push(undefined)', (list: unknown[]): unknown => list.push(undefined)],
	['batch push', (list: unknown[]): unknown => batch((): unknown => list.push(3))],
]

const popInitials: [string, unknown[]][] = [
	['three elements', [0, 1, 2]],
	['empty', []],
	// biome-ignore lint/suspicious/noSparseArray: a trailing hole is the case where pop deletes nothing
	['trailing hole', [0, ,]],
	// an own undefined is deleted and reported, unlike the hole
	['trailing undefined', [0, undefined]],
]

describe('Array push and pop', { concurrency: true, timeout: 1000 }, (): void => {
	it('reports to the hooks the sequence a plain Proxy reports for push', (): void => {
		for (const [name, call] of pushCalls) {
			assert.deepStrictEqual(recordedCalls([0, 1, 2], call), referenceCalls([0, 1, 2], call), name)
		}
	})

	it('reports to the hooks the sequence a plain Proxy reports for pop', (): void => {
		const pop = (list: unknown[]): unknown => list.pop()
		for (const [name, initial] of popInitials) {
			assert.deepStrictEqual(recordedCalls(initial, pop), referenceCalls(initial, pop), name)
		}
		const batchedPop = (list: unknown[]): unknown => batch((): unknown => list.pop())
		assert.deepStrictEqual(recordedCalls([0, 1, 2], batchedPop), referenceCalls([0, 1, 2], batchedPop))
	})

	it('wakes every subscriber of the array once per push or pop from outside any effect', (): void => {
		for (const [kind, $list] of bothKinds([0, 1, 2])) {
			const subscription = subscribe($list)

			$list.push(3)
			assert.deepStrictEqual(subscription.woken(), ['first', 'last', 'length'], `${kind} push`)

			$list.pop()
			assert.deepStrictEqual(subscription.woken(), ['first', 'last', 'length'], `${kind} pop`)

			batch((): void => {
				$list.push(3)
				$list.pop()
				assert.deepStrictEqual(subscription.woken(), [], `${kind} inside batch`)
			})
			assert.deepStrictEqual(subscription.woken(), ['first', 'last', 'length'], `${kind} after batch`)

			$list.push()
			assert.deepStrictEqual(subscription.woken(), [], `${kind} push()`)

			subscription.dispose()
		}
	})

	it('wakes only the readers of the written properties from inside a child effect', (): void => {
		// Each case gets a fresh array and disposes its child before the next: two live children whose writes
		// wake each other through length would cycle without end, as the loop check exempts them
		const cases: [unknown[], (list: unknown[]) => unknown, string[]][] = [
			[[0, 1, 2], (list: unknown[]): unknown => list.push(3), ['length']],
			[[0, 1, 2], (list: unknown[]): unknown => list.pop(), ['last', 'length']],
			[[], (list: unknown[]): unknown => list.pop(), []],
		]
		for (const [initial, call, expected] of cases) {
			for (const [kind, $list] of bothKinds(initial)) {
				const subscription = subscribe($list)

				const dispose = effect((): void => {
					effect((): void => {
						call($list)
					})
				})
				assert.deepStrictEqual(subscription.woken(), expected, `${kind} ${initial.length}`)

				dispose()
				subscription.dispose()
			}
		}
	})

	it('raises the loop error for pop on an empty array inside a sync effect that read length', (): void => {
		for (const [kind, $list] of bothKinds([])) {
			assert.throws(
				(): void => {
					effect((): void => {
						$list.pop()
					}, 'popper')
				},
				/Infinite loop detected: effect "popper" cannot update property "length"/,
				kind
			)
		}
	})

	it('returns the reactive wrapper of a nested object from pop', (): void => {
		const calls: HookCall[] = []
		const hookless = [{ x: 1 }]
		const hooked = [{ x: 1 }]
		const kinds: [string, { x: number }[]][] = [
			['hookless', state(hookless)],
			[
				'hooked',
				state(hooked, {
					onRead: (prop: PropertyKey, value: unknown): void => {
						calls.push(['onRead', prop, value])
					},
				}),
			],
		]
		for (const [kind, $list] of kinds) {
			const inner = (kind === 'hookless' ? hookless : hooked)[0] as { x: number }
			const popped = $list.pop() as { x: number }

			assert.strictEqual(popped, state(inner), kind)
			calls.length = 0
			void popped.x
			// The wrapper from hooked state carries the parent's hooks, as the get trap's wrapper does
			assert.deepStrictEqual(calls, kind === 'hooked' ? [['onRead', 'x', 1]] : [], kind)
		}
	})

	it('propagates the TypeError from pop on a sealed array and stays usable', (): void => {
		for (const $list of [state(Object.seal([1])), state(Object.seal([1]), observingHooks)]) {
			let runs = 0
			const dispose = effect((): void => {
				runs++
				void $list[0]
			})

			assert.throws((): void => {
				$list.pop()
			}, TypeError)

			assert.deepStrictEqual([...$list], [1])
			$list[0] = 7
			assert.strictEqual(runs, 2)
			batch((): void => {
				$list[0] = 8
			})
			assert.strictEqual(runs, 3)
			dispose()
		}
	})

	it('propagates the TypeError from push and pop on an array sealed after state() and stays usable', (): void => {
		// Sealed after state(), the array still carries its slots, so the direct path runs and the native call on
		// the raw target throws; the batch depth has to come back to 0, or the next write would wait for a batch end
		const hookless: unknown[] = [1]
		const hooked: unknown[] = [1]
		const kinds: [string, unknown[], unknown[]][] = [
			['hookless', hookless, state(hookless)],
			['hooked', hooked, state(hooked, observingHooks)],
		]
		for (const [kind, raw, $list] of kinds) {
			Object.seal(raw)
			let runs = 0
			const dispose = effect((): void => {
				runs++
				void $list[0]
				void $list.length
			})

			assert.throws(
				(): void => {
					$list.push(2)
				},
				TypeError,
				`${kind} push`
			)
			assert.throws(
				(): void => {
					$list.pop()
				},
				TypeError,
				`${kind} pop`
			)

			assert.deepStrictEqual([...$list], [1], kind)
			// a synchronous wake proves the batch depth is back to 0
			$list[0] = 7
			assert.strictEqual(runs, 2, kind)
			batch((): void => {
				$list[0] = 8
			})
			assert.strictEqual(runs, 3, kind)
			dispose()
		}
	})

	it('reports to the hooks the sequence a plain Proxy reports from inside a child effect', (): void => {
		const cases: [string, unknown[], (list: unknown[]) => unknown][] = [
			['push', [0, 1, 2], (list: unknown[]): unknown => list.push(3)],
			['pop', [0, 1, 2], (list: unknown[]): unknown => list.pop()],
		]
		for (const [name, initial, call] of cases) {
			const plain = [...initial]
			const expected = call(plain)
			const inChildEffect = (list: unknown[]): unknown => {
				let result: unknown
				effect((): void => {
					effect((): void => {
						result = call(list)
					})
				})()
				return result
			}
			assert.deepStrictEqual(recordedCalls(initial, inChildEffect), referenceCalls(initial, call), name)
			for (const [kind, $list] of bothKinds(initial)) {
				assert.strictEqual(inChildEffect($list), expected, `${name} ${kind}`)
				assert.deepStrictEqual([...$list], plain, `${name} ${kind}`)
			}
		}
	})

	it('stores an own element for push(undefined), as a plain array does, and reports the index write', (): void => {
		// A write of undefined to an absent index is a change (Q65 a): the element exists afterwards, the readers
		// of the array wake, and the hooks see the index write; the length write is equal, as the index write grew it
		for (const [kind, $list] of bothKinds([0, 1, 2])) {
			const subscription = subscribe($list)

			$list.push(undefined)

			assert.strictEqual($list.length, 4, kind)
			assert.strictEqual(Object.hasOwn($list, 3), true, kind)
			assert.deepStrictEqual(subscription.woken(), ['first', 'last', 'length'], kind)
			subscription.dispose()
		}
		const calls: HookCall[] = []
		const raw: unknown[] = [0, 1, 2]
		state(raw, recordingHooks(calls, raw)).push(undefined)
		assert.deepStrictEqual(calls, [
			['onRead', 'push', Array.prototype.push],
			['onRead', 'length', 3],
			['onWrite', '3', undefined, undefined],
		])
	})

	it('stores a write of undefined to an absent index on the Proxy path as a plain array does', (): void => {
		// The set trap is shared by every write that is not a direct push or pop: unshift, splice and an index
		// assignment that grows the array all create the element and report it
		const writes: [string, (list: unknown[]) => unknown][] = [
			['unshift(undefined)', (list: unknown[]): unknown => list.unshift(undefined)],
			['splice(3, 0, undefined)', (list: unknown[]): unknown => list.splice(3, 0, undefined)],
			['list[3] = undefined', (list: unknown[]): unknown => (list[3] = undefined)],
		]
		for (const [name, write] of writes) {
			assert.deepStrictEqual(recordedCalls([0, 1, 2], write), referenceCalls([0, 1, 2], write), name)
			for (const [kind, $list] of bothKinds([0, 1, 2])) {
				const plain: unknown[] = [0, 1, 2]
				write(plain)
				write($list)
				assert.deepStrictEqual(Object.keys($list), Object.keys(plain), `${name} ${kind}`)
				assert.deepStrictEqual([...$list], plain, `${name} ${kind}`)
			}
		}
	})

	it('propagates the native TypeError for push and pop called on a nullish receiver', (): void => {
		// The other five wrappers hand a nullish receiver to the native method; the direct path reads its slot first
		const nativeMessage = (call: () => unknown): string => {
			try {
				call()
			} catch (err) {
				return (err as Error).message
			}
			throw new Error('native method did not throw')
		}
		for (const [kind, $list] of bothKinds([0])) {
			for (const receiver of [null, undefined]) {
				assert.throws(
					(): void => {
						$list.push.call(receiver, 1)
					},
					{ message: nativeMessage((): unknown => Array.prototype.push.call(receiver, 1)), name: 'TypeError' },
					`${kind} push on ${receiver}`
				)
				assert.throws(
					(): void => {
						$list.pop.call(receiver)
					},
					{ message: nativeMessage((): unknown => Array.prototype.pop.call(receiver)), name: 'TypeError' },
					`${kind} pop on ${receiver}`
				)
			}
			assert.deepStrictEqual([...$list], [0], kind)
		}
	})

	it('takes the direct path for push and pop called with the raw target as receiver', (): void => {
		// The raw array carries the context in its slot, so a call on it does what a call on the Proxy does
		const cases: [string, (list: unknown[], receiver: unknown[]) => unknown, unknown][] = [
			['push', (list: unknown[], receiver: unknown[]): unknown => list.push.call(receiver, 3), 4],
			['pop', (list: unknown[], receiver: unknown[]): unknown => list.pop.call(receiver), 2],
		]
		for (const [name, call, result] of cases) {
			const calls: HookCall[] = []
			const raw: unknown[] = [0, 1, 2]
			call(state(raw, recordingHooks(calls, raw)), raw)
			assert.deepStrictEqual(
				calls,
				referenceCalls([0, 1, 2], (list: unknown[]): unknown => call(list, list)),
				name
			)

			const hookless: unknown[] = [0, 1, 2]
			const hooked: unknown[] = [0, 1, 2]
			const kinds: [string, unknown[], unknown[]][] = [
				['hookless', hookless, state(hookless)],
				['hooked', hooked, state(hooked, observingHooks)],
			]
			for (const [kind, rawList, $list] of kinds) {
				const subscription = subscribe($list)
				assert.strictEqual(call($list, rawList), result, `${name} ${kind}`)
				assert.deepStrictEqual(subscription.woken(), ['first', 'last', 'length'], `${name} ${kind}`)
				subscription.dispose()
			}
		}
	})

	it('runs push and pop called with another receiver on that receiver', (): void => {
		// A hooked object state is the receiver that carries hooks where an array carries its direct context
		const calls: HookCall[] = []
		const rawObject: Record<string, unknown> = { length: 0 }
		const $object = state(rawObject, recordingHooks(calls, rawObject as unknown as unknown[]))
		for (const [kind, $list] of bothKinds([0])) {
			const subscription = subscribe($list)
			const plain = [9]

			assert.strictEqual($list.push.call(plain, 1), 2, kind)
			assert.strictEqual($list.pop.call(plain), 1, kind)
			assert.strictEqual($list.push.call($object, 1), 1, kind)
			assert.strictEqual($list.pop.call($object), 1, kind)

			assert.deepStrictEqual(plain, [9], kind)
			assert.deepStrictEqual(rawObject, { length: 0 }, kind)
			assert.deepStrictEqual([...$list], [0], kind)
			assert.deepStrictEqual(subscription.woken(), [], kind)
			subscription.dispose()
		}
		assert.deepStrictEqual(
			calls.filter((call: HookCall): boolean => call[0] === 'onWrite'),
			[
				['onWrite', '0', undefined, 1],
				['onWrite', 'length', 0, 1],
				['onWrite', 'length', 1, 0],
				['onWrite', '0', undefined, 1],
				['onWrite', 'length', 0, 1],
				['onWrite', 'length', 1, 0],
			]
		)
	})
})
