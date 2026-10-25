import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fc from 'fast-check'
import { batch, derive, effect, state } from '../src/index.ts'

/**
 * Property-based tests for frozen and sealed object reactivity.
 *
 * When Object.isExtensible(target) is false, Beacon falls back to WeakMap
 * storage for subscribers (proxyCacheSubs). Array method wrappers always
 * live in arrayMethodCache, and hooks fire through the handler closure, so
 * a non-extensible target stores nothing else. These tests verify that the
 * subscriber fallback path works correctly.
 *
 * Key behavior notes:
 * - Every write path resolves subscribers by checking rawTarget[SUBSCRIBERS]
 *   first and proxyCacheSubs second. So direct writes, batched writes and
 *   cross-effect writes to sealed objects all notify the effects that read
 *   the written property.
 * - Frozen objects cannot be written to (properties are non-writable).
 *
 * @see tests/PROPERTY_BASED_TESTING.md — Opportunity #11
 */

// --- Types ---

type SealedState = Record<string, number>

// --- Arbitraries ---

const intArb: fc.Arbitrary<number> = fc.integer({
	max: 1000,
	min: -1000,
})

// Generate a non-empty object with 1-6 string keys and integer values
const shallowObjArb: fc.Arbitrary<SealedState> = fc.dictionary(
	fc.string({
		maxLength: 8,
		minLength: 1,
	}),
	intArb,
	{
		maxKeys: 6,
		minKeys: 1,
	}
)

// --- Helpers ---

function firstKey(keys: string[]): string {
	const k = keys[0]
	if (k === undefined) throw new Error('unreachable: fc.pre guarantees keys.length > 0')
	return k
}

// --- Tests ---

describe('Property-Based: Frozen/Sealed Object Reactivity', {
	concurrency: true,
	timeout: 30000,
}, (): void => {
	it('sealed objects: proxy identity via proxyCache WeakMap', (): void => {
		fc.assert(
			fc.property(shallowObjArb, (obj: SealedState): void => {
				const sealed = Object.seal({
					...obj,
				})
				const $first = state(sealed)
				const $second = state(sealed)

				// proxyCache.get(sealed) returns the cached proxy on second call
				assert.strictEqual($first, $second, 'state(sealed) should return same proxy')
			}),
			{
				numRuns: 300,
			}
		)
	})

	it('frozen objects: proxy identity via proxyCache WeakMap', (): void => {
		fc.assert(
			fc.property(shallowObjArb, (obj: SealedState): void => {
				const frozen = Object.freeze({
					...obj,
				})
				const $first = state(frozen)
				const $second = state(frozen)

				// proxyCache.get(frozen) returns the cached proxy on second call
				assert.strictEqual($first, $second, 'state(frozen) should return same proxy')
			}),
			{
				numRuns: 300,
			}
		)
	})

	it('sealed objects: reads inside effects create subscriptions without throwing', (): void => {
		fc.assert(
			fc.property(shallowObjArb, (obj: SealedState): void => {
				const keys = Object.keys(obj)
				fc.pre(keys.length > 0)
				const key = firstKey(keys)

				const sealed = Object.seal({
					...obj,
				})
				const $s = state(sealed) as SealedState

				let lastRead: number | undefined
				let runs = 0

				const dispose = effect((): void => {
					runs++
					lastRead = $s[key] as number
				})

				assert.strictEqual(runs, 1, 'effect should run once initially')
				assert.strictEqual(lastRead, obj[key], 'should read correct value')

				dispose()
			}),
			{
				numRuns: 300,
			}
		)
	})

	it('frozen objects: reads inside effects create subscriptions without throwing', (): void => {
		fc.assert(
			fc.property(shallowObjArb, (obj: SealedState): void => {
				const keys = Object.keys(obj)
				fc.pre(keys.length > 0)
				const key = firstKey(keys)

				const frozen = Object.freeze({
					...obj,
				})
				const $s = state(frozen) as SealedState

				let lastRead: number | undefined
				let runs = 0

				const dispose = effect((): void => {
					runs++
					lastRead = $s[key] as number
				})

				assert.strictEqual(runs, 1, 'effect should run once initially')
				assert.strictEqual(lastRead, obj[key], 'should read correct value')

				dispose()
			}),
			{
				numRuns: 300,
			}
		)
	})

	it('sealed objects: cross-effect writes trigger notifications via proxyCacheSubs', (): void => {
		fc.assert(
			fc.property(shallowObjArb, intArb, (obj: SealedState, newValue: number): void => {
				const keys = Object.keys(obj)
				fc.pre(keys.length > 0)
				const key = firstKey(keys)

				const sealed = Object.seal({
					...obj,
				})
				const $s = state(sealed) as SealedState
				const oldValue = obj[key]
				fc.pre(!Object.is(oldValue, newValue))

				// A trigger state to control when the write happens
				const $trigger = state({
					fire: false,
				})

				// Observer effect: subscribes to the sealed object's property
				let observerRuns = 0
				const disposeObserver = effect((): void => {
					observerRuns++
					void $s[key]
				})

				// Writer effect: when triggered, writes to the sealed property
				const disposeWriter = effect((): void => {
					if ($trigger.fire) {
						$s[key] = newValue
					}
				})

				assert.strictEqual(observerRuns, 1, 'observer should run once initially')
				observerRuns = 0

				// Trigger the writer effect — the write happens inside
				// performWrite (currentEffect is set), which uses
				// findSubscribers → proxyCacheSubs
				$trigger.fire = true

				assert.strictEqual(observerRuns, 1, 'observer should fire via proxyCacheSubs path')
				assert.strictEqual($s[key], newValue, 'value should be updated')

				disposeObserver()
				disposeWriter()
			}),
			{
				numRuns: 300,
			}
		)
	})

	it('sealed objects: dispose correctly removes from proxyCacheSubs', (): void => {
		fc.assert(
			fc.property(shallowObjArb, intArb, (obj: SealedState, newValue: number): void => {
				const keys = Object.keys(obj)
				fc.pre(keys.length > 0)
				const key = firstKey(keys)

				const sealed = Object.seal({
					...obj,
				})
				const $s = state(sealed) as SealedState
				const oldValue = obj[key]
				fc.pre(!Object.is(oldValue, newValue))

				const $trigger = state({
					fire: false,
				})

				let observerRuns = 0
				const disposeObserver = effect((): void => {
					observerRuns++
					void $s[key]
				})

				const disposeWriter = effect((): void => {
					if ($trigger.fire) {
						$s[key] = newValue
					}
				})

				// Dispose the observer BEFORE triggering the write
				disposeObserver()
				observerRuns = 0

				$trigger.fire = true

				// Observer was disposed, so it should NOT run
				assert.strictEqual(observerRuns, 0, 'disposed observer should not fire')

				disposeWriter()
			}),
			{
				numRuns: 300,
			}
		)
	})

	it('sealed objects: direct writes update underlying value', (): void => {
		fc.assert(
			fc.property(shallowObjArb, intArb, (obj: SealedState, newValue: number): void => {
				const keys = Object.keys(obj)
				fc.pre(keys.length > 0)
				const key = firstKey(keys)

				const sealed = Object.seal({
					...obj,
				})
				const $s = state(sealed) as SealedState

				// Direct write outside any effect stores the value on the sealed target
				$s[key] = newValue
				assert.strictEqual($s[key], newValue, 'proxy should reflect updated value')
				assert.strictEqual(sealed[key], newValue, 'underlying sealed object should be updated')
			}),
			{
				numRuns: 300,
			}
		)
	})

	it('sealed objects: direct writes outside effects notify subscribers', (): void => {
		fc.assert(
			fc.property(shallowObjArb, intArb, (obj: SealedState, newValue: number): void => {
				const key = firstKey(Object.keys(obj))
				fc.pre(!Object.is(obj[key], newValue))
				const $s = state(Object.seal({ ...obj })) as SealedState

				let runs = 0
				const dispose = effect((): void => {
					runs++
					void $s[key]
				})
				runs = 0

				$s[key] = newValue

				assert.strictEqual(runs, 1, 'direct write should re-run the effect')
				dispose()
			}),
			{
				numRuns: 300,
			}
		)
	})

	it('sealed objects: writes inside batch notify subscribers once after the batch', (): void => {
		fc.assert(
			fc.property(shallowObjArb, intArb, (obj: SealedState, newValue: number): void => {
				const key = firstKey(Object.keys(obj))
				fc.pre(!Object.is(obj[key], newValue))
				const $s = state(Object.seal({ ...obj })) as SealedState

				let runs = 0
				const dispose = effect((): void => {
					runs++
					void $s[key]
				})
				runs = 0

				batch((): void => {
					$s[key] = newValue
					assert.strictEqual(runs, 0, 'effect should not run inside the batch')
				})

				assert.strictEqual(runs, 1, 'batched write should re-run the effect exactly once')
				dispose()
			}),
			{
				numRuns: 300,
			}
		)
	})

	it('sealed objects: writing an unchanged value does not notify', (): void => {
		fc.assert(
			fc.property(shallowObjArb, (obj: SealedState): void => {
				const key = firstKey(Object.keys(obj))
				const $s = state(Object.seal({ ...obj })) as SealedState

				let runs = 0
				const dispose = effect((): void => {
					runs++
					void $s[key]
				})
				runs = 0

				$s[key] = obj[key] as number
				batch((): void => {
					$s[key] = obj[key] as number
				})

				assert.strictEqual(runs, 0, 'unchanged value should not re-run the effect')
				dispose()
			}),
			{
				numRuns: 300,
			}
		)
	})

	it('extensible targets that reject symbol properties notify via proxyCacheSubs', (): void => {
		const target = new Proxy(
			{ a: 1 },
			{
				defineProperty: (t: { a: number }, key: PropertyKey, desc: PropertyDescriptor): boolean =>
					typeof key !== 'symbol' && Reflect.defineProperty(t, key, desc),
			}
		)
		const $s = state(target)

		let runs = 0
		const dispose = effect((): void => {
			runs++
			void $s.a
		})
		runs = 0

		$s.a = 2
		batch((): void => {
			$s.a = 3
		})

		assert.strictEqual(runs, 2, 'direct and batched writes should each re-run the effect')
		dispose()
	})

	it('targets frozen after state() can still be subscribed', (): void => {
		const raw = { a: 1 }
		const $s = state(raw)
		Object.freeze(raw)

		let runs = 0
		const dispose = effect((): void => {
			runs++
			void $s.a
		})

		assert.strictEqual(runs, 1)
		assert.strictEqual($s.a, 1)
		dispose()
	})

	it('targets sealed after state() notify on direct and batched writes', (): void => {
		const raw = { a: 1 }
		const $s = state(raw)
		Object.seal(raw)

		let runs = 0
		const dispose = effect((): void => {
			runs++
			void $s.a
		})
		runs = 0

		$s.a = 2
		assert.strictEqual(runs, 1, 'direct write should re-run the effect')

		batch((): void => {
			$s.a = 3
			$s.a = 4
		})
		assert.strictEqual(runs, 2, 'batched writes should re-run the effect once')
		assert.strictEqual(raw.a, 4)
		dispose()
	})

	it('sealed arrays: mutating methods work via WeakMap method cache', (): void => {
		fc.assert(
			fc.property(
				fc.array(intArb, {
					maxLength: 10,
					minLength: 1,
				}),
				intArb,
				(arr: number[], pushValue: number): void => {
					const sealed = Object.seal([...arr])
					const $s = state(sealed)

					let runs = 0
					const dispose = effect((): void => {
						runs++
						void ($s as number[])[0]
					})

					// A sealed array cannot grow: the native push throws through the wrapper's batch
					assert.throws((): void => {
						;($s as number[]).push(pushValue)
					}, TypeError)
					assert.deepStrictEqual([...($s as number[])], arr)

					// The failed call left no batch depth behind: the next write still notifies
					;($s as number[])[0] = (arr[0] ?? 0) + 1
					assert.strictEqual(runs, 2, 'write after the failed push should re-run the effect')

					dispose()
				}
			),
			{
				numRuns: 200,
			}
		)
	})
})

// --- Types for real-use-case tests ---

type FrozenChild = Readonly<Record<string, number>>

type ParentWithFrozenChild = {
	child: FrozenChild
	label: string
}

// --- Arbitraries for real-use-case tests ---

const frozenChildArb: fc.Arbitrary<FrozenChild> = fc
	.dictionary(
		fc.string({
			maxLength: 8,
			minLength: 1,
		}),
		intArb,
		{
			maxKeys: 6,
			minKeys: 1,
		}
	)
	.map(
		(obj: Record<string, number>): FrozenChild =>
			Object.freeze({
				...obj,
			})
	)

// --- Real-use-case tests: frozen/sealed children of extensible parents ---

describe('Property-Based: Frozen/Sealed Children of Reactive State', {
	concurrency: true,
	timeout: 30000,
}, (): void => {
	it('replacing a frozen child triggers effects', (): void => {
		fc.assert(
			fc.property(frozenChildArb, frozenChildArb, (childA: FrozenChild, childB: FrozenChild): void => {
				fc.pre(childA !== childB)

				const $s = state<ParentWithFrozenChild>({
					child: childA,
					label: 'test',
				})

				// $s.child returns a Proxy wrapping childA, not childA itself
				const proxyA = $s.child
				let runs = 0
				const dispose = effect((): void => {
					runs++
					void $s.child
				})

				assert.strictEqual(runs, 1)

				runs = 0
				$s.child = childB

				assert.strictEqual(runs, 1, 'effect should fire when frozen child is replaced')
				assert.notStrictEqual($s.child, proxyA, 'should return a different proxy after replacement')

				dispose()
			}),
			{
				numRuns: 300,
			}
		)
	})

	it('reading through frozen child proxies returns correct values', (): void => {
		fc.assert(
			fc.property(frozenChildArb, (child: FrozenChild): void => {
				const keys = Object.keys(child)
				fc.pre(keys.length > 0)

				const $s = state({
					child,
				})

				// Reading through the proxy should return the same values
				for (const key of keys) {
					assert.strictEqual(
						($s.child as Record<string, number>)[key],
						child[key],
						`reading key "${key}" through proxy should match original`
					)
				}
			}),
			{
				numRuns: 300,
			}
		)
	})

	it('frozen child proxy identity is stable across reads', (): void => {
		fc.assert(
			fc.property(frozenChildArb, (child: FrozenChild): void => {
				const $s = state({
					child,
				})

				// wrapNestedObject returns the same proxy via proxyCache
				const read1 = $s.child
				const read2 = $s.child
				assert.strictEqual(read1, read2, 'consecutive reads should return same proxy')

				// Also stable after an unrelated write
				$s.child = child // same reference, Object.is → no-op
				const read3 = $s.child
				assert.strictEqual(read1, read3, 'should be same proxy after same-ref write')
			}),
			{
				numRuns: 300,
			}
		)
	})

	it('derive updates when a frozen child is replaced', (): void => {
		fc.assert(
			fc.property(frozenChildArb, frozenChildArb, (childA: FrozenChild, childB: FrozenChild): void => {
				const keysA = Object.keys(childA)
				const keysB = Object.keys(childB)
				fc.pre(keysA.length > 0 && keysB.length > 0)
				fc.pre(childA !== childB)
				const keyA = firstKey(keysA)

				const $s = state({
					child: childA as Record<string, number>,
				})

				const $d = derive((): number => ($s.child as Record<string, number>)[keyA] as number)

				assert.strictEqual($d.value, childA[keyA])

				$s.child = childB as Record<string, number>

				// After replacement, derive re-evaluates and reads keyA
				// from the new child (may be undefined if key doesn't exist)
				assert.strictEqual(
					$d.value,
					(childB as Record<string, number>)[keyA],
					'derive should reflect the replaced child'
				)

				$d.reactive = false
			}),
			{
				numRuns: 300,
			}
		)
	})

	it('batch replacement of frozen children deduplicates', (): void => {
		fc.assert(
			fc.property(
				fc.array(frozenChildArb, {
					maxLength: 8,
					minLength: 2,
				}),
				(children: FrozenChild[]): void => {
					const firstChild = children[0]
					if (firstChild === undefined) throw new Error('unreachable: minLength is 2')

					const $s = state({
						child: firstChild,
					})

					let runs = 0
					const dispose = effect((): void => {
						runs++
						void $s.child
					})

					runs = 0

					batch((): void => {
						for (const c of children) {
							$s.child = c
						}
					})

					const last = children[children.length - 1]
					if (last === undefined) throw new Error('unreachable: minLength is 2')
					assert.ok(runs <= 1, `effect ran ${runs} times, expected at most 1`)
					// $s.child returns a proxy, not the raw frozen ref — verify a property value
					const lastKey = Object.keys(last)[0]
					if (lastKey !== undefined) {
						assert.strictEqual(
							($s.child as Record<string, number>)[lastKey],
							last[lastKey],
							'should reflect the last frozen child'
						)
					}

					dispose()
				}
			),
			{
				numRuns: 300,
			}
		)
	})

	it('all primitive properties of a frozen child are readable through proxy', (): void => {
		fc.assert(
			fc.property(frozenChildArb, (child: FrozenChild): void => {
				const keys = Object.keys(child)
				fc.pre(keys.length > 0)

				const $s = state({
					child,
				})

				// Every primitive-valued property on the frozen child should
				// be readable through the parent proxy without violating the
				// ES Proxy invariant (non-writable + non-configurable must
				// return the exact target value — only holds for primitives
				// since wrapNestedObject would return a different Proxy for objects)
				for (const key of keys) {
					assert.strictEqual(
						($s.child as Record<string, number>)[key],
						child[key],
						`frozen child key "${key}" should be readable through proxy`
					)
				}
			}),
			{
				numRuns: 300,
			}
		)
	})

	it('same frozen reference replacement is a no-op', (): void => {
		fc.assert(
			fc.property(frozenChildArb, (child: FrozenChild): void => {
				const $s = state({
					child,
				})

				let runs = 0
				const dispose = effect((): void => {
					runs++
					void $s.child
				})

				runs = 0

				// Replacing with the exact same reference — Object.is returns true
				$s.child = child

				assert.strictEqual(runs, 0, 'same frozen reference should not trigger effect')

				dispose()
			}),
			{
				numRuns: 300,
			}
		)
	})
})
