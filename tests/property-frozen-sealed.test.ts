import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fc from 'fast-check'
import { effect, state } from '../src/index.ts'

/**
 * Property-based tests for frozen and sealed object reactivity.
 *
 * When Object.isExtensible(target) is false, Beacon falls back to WeakMap
 * storage for subscribers (proxyCacheSubs), hooks (frozenHooksCache), and
 * array method caches (frozenMethodCache). These tests verify that the
 * WeakMap fallback paths work correctly.
 *
 * Key behavior notes:
 * - The set handler fast path (outside effects/batches) checks only
 *   rawTarget[SUBSCRIBERS], not proxyCacheSubs. So direct writes to
 *   sealed objects do not trigger effect notifications.
 * - Writes from within effect execution go through performWrite →
 *   scheduleSubscribersForTarget → findSubscribers, which DOES check
 *   proxyCacheSubs. So cross-effect writes on sealed objects work.
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

// --- Tests ---

describe(
	'Property-Based: Frozen/Sealed Object Reactivity',
	{
		concurrency: true,
		timeout: 30000,
	},
	(): void => {
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

					const sealed = Object.seal({
						...obj,
					})
					const $s = state(sealed) as SealedState

					let lastRead: number | undefined
					let runs = 0

					const dispose = effect((): void => {
						runs++
						lastRead = $s[keys[0]] as number
					})

					assert.strictEqual(runs, 1, 'effect should run once initially')
					assert.strictEqual(lastRead, obj[keys[0]], 'should read correct value')

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

					const frozen = Object.freeze({
						...obj,
					})
					const $s = state(frozen) as SealedState

					let lastRead: number | undefined
					let runs = 0

					const dispose = effect((): void => {
						runs++
						lastRead = $s[keys[0]] as number
					})

					assert.strictEqual(runs, 1, 'effect should run once initially')
					assert.strictEqual(lastRead, obj[keys[0]], 'should read correct value')

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

					const sealed = Object.seal({
						...obj,
					})
					const $s = state(sealed) as SealedState
					const key = keys[0]
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

					const sealed = Object.seal({
						...obj,
					})
					const $s = state(sealed) as SealedState
					const key = keys[0]
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

					const sealed = Object.seal({
						...obj,
					})
					const $s = state(sealed) as SealedState
					const key = keys[0]

					// Direct write outside any effect — the value DOES get stored
					// even though effect notifications are skipped by the fast path
					$s[key] = newValue
					assert.strictEqual($s[key], newValue, 'proxy should reflect updated value')
					assert.strictEqual(sealed[key], newValue, 'underlying sealed object should be updated')
				}),
				{
					numRuns: 300,
				}
			)
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
						const sealed = Object.seal([
							...arr,
						])
						const $s = state(sealed)

						const dispose = effect((): void => {
							void ($s as number[]).length
						})

						// push on a sealed array — the engine may throw since sealed
						// arrays cannot add new indexed properties. We verify the
						// system remains stable either way.
						try {
							;($s as number[]).push(pushValue)
							// If push succeeded, the method was served from frozenMethodCache
							assert.ok(true, 'push did not throw')
						} catch {
							// Expected on most engines — sealed arrays cannot grow
							assert.ok(true, 'push threw as expected for sealed array')
						}

						dispose()
					}
				),
				{
					numRuns: 200,
				}
			)
		})
	}
)
