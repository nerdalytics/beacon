/**
 * Beacon — reactive dependency graph runtime for Node.js backends.
 *
 * Proxy-based per-property tracking. Reads are recorded automatically,
 * writes propagate through the dependency graph. Zero dependencies.
 *
 * @module
 */
import { composeHook } from './hooks/compose.ts'
import type { BatchHooks, DeriveHooks, EffectHooks, HookFunction, StateHooks } from './types.ts'

/** Disposal function returned by {@linkcode effect}. Calling it removes the effect and cleans up its dependencies. */
export type Unsubscribe = () => void
/** Function signature accepted by {@linkcode effect}. */
export type EffectCallback = () => void
/** Optional name for an effect, used in hook callbacks for identification. */
export type EffectName = string

/** Value returned by {@linkcode derive}. Set `reactive` to `false` to dispose. */
export type ComputedValue<T> = {
	readonly pending: boolean
	readonly value: T | undefined | null
	reactive: boolean
}

/** Scheduling strategy for {@linkcode effect}: run during the write, or on a later microtask. */
export type EffectSchedule = 'microtask' | 'sync'

/** Options for {@linkcode effect}. */
export interface EffectOptions {
	schedule?: EffectSchedule
}

/** Options for {@linkcode until}. */
export interface UntilOptions {
	signal?: AbortSignal
	timeout?: number
}

/** Callback for {@linkcode onSettled}, invoked when the graph reaches quiescence. */
export type SettledCallback = () => void

type ProxyTarget = Record<PropertyKey, unknown>

// Symbol definitions for internal tracking
const OWN_KEYS_SYMBOL: unique symbol = Symbol('[[ownKeysRead]]')
const SUBSCRIBERS: unique symbol = Symbol('[[beacon_subscribers]]')
const PROXY: unique symbol = Symbol('[[beacon_proxy]]')
const HOOKS: unique symbol = Symbol('[[beacon_hooks]]')

// Effect tracking state
let currentEffect: EffectFunction | null = null
let batchDepth = 0
let isNotifying = false
let isTrackingOnly = false
const pendingEffects: Set<EffectFunction> = new Set<EffectFunction>()
const pendingMicroEffects: Set<EffectFunction> = new Set<EffectFunction>()
const effectQueue: EffectFunction[] = []
const deferredEffectCreations: EffectFunction[] = []
let rerunTempDeps: Set<object> | null = null
let rerunTempReads: Map<object, Set<PropertyKey>> | null = null
let rerunReadList: (object | PropertyKey)[] | null = null
let rerunReadIndex = 0
let rerunStable = false
let buildingReadList: (object | PropertyKey)[] | null = null
const dirtyTargets: Map<object, Set<PropertyKey>> = new Map<object, Set<PropertyKey>>()
const settledCallbacks: Set<SettledCallback> = new Set<SettledCallback>()
let settleProcessed = false
let flushProcessed = false
let microtaskFlushArmed = false
let microtaskFlushing = false
// Consecutive microtask flushes each armed by the one before it, with no macrotask in between
let microtaskFlushChain = 0
let effectErrorHandled = false
let untilEvaluating = false
let untilSawPending = false

// Proxy caching
const proxyCache: WeakMap<object, object> = new WeakMap<object, object>()
const proxyCacheSubs: WeakMap<object, Set<EffectFunction>> = new WeakMap<object, Set<EffectFunction>>()
// Effects by the property they read, per subscriber Set. It may hold stale entries: scheduling re-checks __reads,
// so it only has to be a superset of the true readers. Kept off the Set: an own property there cost ~8% on
// single-subscriber writes in the benchmark suite
const subscribersByProp: WeakMap<Set<EffectFunction>, Map<PropertyKey, Set<EffectFunction>>> = new WeakMap<
	Set<EffectFunction>,
	Map<PropertyKey, Set<EffectFunction>>
>()

const MUTATING_ARRAY_METHODS: Set<string> = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'])

// Function type for cached methods
type CachedMethod = (...args: unknown[]) => unknown
const arrayMethodCache: WeakMap<object, Map<PropertyKey, CachedMethod>> = new WeakMap()
const frozenHooksCache: WeakMap<object, StateHooks> = new WeakMap()
const MAX_SETTLE_CYCLES = 100
const MAX_MICROTASK_FLUSH_CHAIN = 100
// Up to this many subscribers a scan is cheaper than the per-property index lookups
const INDEXED_SCHEDULE_MIN_SUBSCRIBERS = 4

// Hooks consulted on the hot path; stored on the effect only when at least one is set
type EffectInternalHooks = {
	onDependencyAdd?: HookFunction<[object, PropertyKey, string | undefined]> | undefined
	onDependencyChange?: HookFunction<[object, PropertyKey]> | undefined
	onSchedule?: HookFunction<[string | undefined]> | undefined
}

// Effect function type
type EffectFunction = {
	(): void
	__active?: boolean
	__children?: Set<EffectFunction> | undefined
	__deps?: Set<object> | undefined
	__hooks?: EffectInternalHooks
	__parent?: EffectFunction | undefined
	__prevDeps?: Set<object> | undefined
	__prevReads?: Map<object, Set<PropertyKey>> | undefined
	__readList?: (object | PropertyKey)[] | undefined
	__reads?: Map<object, Set<PropertyKey>> | undefined
	__schedule?: EffectSchedule | undefined
	effectName?: string
}

// Helper types for objects with internal symbols
type SubscribersObject = ProxyTarget & {
	[SUBSCRIBERS]?: Set<EffectFunction>
}

type ProxyObject = ProxyTarget & {
	[PROXY]?: object
}

function wrapArrayMethod(target: object, prop: PropertyKey, originalMethod: CachedMethod): CachedMethod {
	let cache = arrayMethodCache.get(target)
	if (!cache) {
		cache = new Map<PropertyKey, CachedMethod>()
		arrayMethodCache.set(target, cache)
	}

	let wrapped = cache.get(prop)
	if (!wrapped) {
		wrapped = (...args: unknown[]): unknown => {
			const result = originalMethod.apply(target, args)
			scheduleSubscribersForTarget(target)
			return result
		}
		cache.set(prop, wrapped)
	}
	return wrapped
}

function storeSubscriberSet(target: object, subscriberSet: Set<EffectFunction>): void {
	try {
		if (Object.isExtensible(target)) {
			Object.defineProperty(target, SUBSCRIBERS, {
				configurable: true,
				enumerable: false,
				value: subscriberSet,
				writable: false,
			})
		} else {
			proxyCacheSubs.set(target, subscriberSet)
		}
	} catch {
		proxyCacheSubs.set(target, subscriberSet)
	}
}

function getSubscribers(target: object): Set<EffectFunction> {
	const subs = (target as SubscribersObject)[SUBSCRIBERS]
	if (subs) return subs

	const fallbackSubs = proxyCacheSubs.get(target)
	if (fallbackSubs) return fallbackSubs

	const subscriberSet = new Set<EffectFunction>()
	subscribersByProp.set(subscriberSet, new Map<PropertyKey, Set<EffectFunction>>())
	storeSubscriberSet(target, subscriberSet)
	return subscriberSet
}

// Every subscriber Set comes from getSubscribers, which registers its index
function propIndexOf(subs: Set<EffectFunction>): Map<PropertyKey, Set<EffectFunction>> {
	return subscribersByProp.get(subs) as Map<PropertyKey, Set<EffectFunction>>
}

function indexRead(subs: Set<EffectFunction>, eff: EffectFunction, prop: PropertyKey): void {
	const byProp = propIndexOf(subs)
	let readers = byProp.get(prop)
	if (!readers) {
		readers = new Set<EffectFunction>()
		byProp.set(prop, readers)
	}
	readers.add(eff)
}

function unindexRead(subs: Set<EffectFunction>, eff: EffectFunction, prop: PropertyKey): void {
	const byProp = propIndexOf(subs)
	const readers = byProp.get(prop)
	if (!readers) return
	readers.delete(eff)
	if (readers.size === 0) byProp.delete(prop)
}

function replayReadListToTempCollections(list: (object | PropertyKey)[], endIndex: number): void {
	rerunTempDeps = new Set<object>()
	rerunTempReads = new Map<object, Set<PropertyKey>>()
	for (let j = 0; j < endIndex; j += 2) {
		const t = list[j] as object
		const p = list[j + 1] as PropertyKey
		rerunTempDeps.add(t)
		let s = rerunTempReads.get(t)
		if (!s) {
			s = new Set<PropertyKey>()
			rerunTempReads.set(t, s)
		}
		s.add(p)
	}
}

function readListMatchesRead(list: (object | PropertyKey)[], target: object, prop: PropertyKey): boolean {
	return rerunReadIndex < list.length && list[rerunReadIndex] === target && list[rerunReadIndex + 1] === prop
}

function recordSilentRead(target: object, prop: PropertyKey): void {
	if (rerunTempDeps && rerunTempReads) {
		rerunTempDeps.add(target)
		let set = rerunTempReads.get(target)
		if (!set) {
			set = new Set<PropertyKey>()
			rerunTempReads.set(target, set)
		}
		set.add(prop)
		if (buildingReadList) buildingReadList.push(target, prop)
	}
}

function recordEffectRead(eff: EffectFunction, target: object, prop: PropertyKey, silent: boolean): void {
	if (silent) {
		if (rerunStable && rerunReadList) {
			if (readListMatchesRead(rerunReadList, target, prop)) {
				rerunReadIndex += 2
				return
			}
			rerunStable = false
			replayReadListToTempCollections(rerunReadList, rerunReadIndex)
		}
		recordSilentRead(target, prop)
		return
	}

	let deps = eff.__deps
	if (!deps) {
		deps = new Set<object>()
		eff.__deps = deps
	}
	deps.add(target)

	let map = eff.__reads
	if (!map) {
		map = new Map<object, Set<PropertyKey>>()
		eff.__reads = map
	}
	let set = map.get(target)
	if (!set) {
		set = new Set<PropertyKey>()
		map.set(target, set)
	}

	const isNew = !set.has(prop)
	set.add(prop)
	if (isNew) {
		callHookSafe(eff.__hooks?.onDependencyAdd, target, prop, eff.effectName)
	}
}

function didEffectReadProp(effect: EffectFunction, target: object, prop: PropertyKey): boolean {
	if (rerunTempReads) {
		const set = rerunTempReads.get(target)
		return set?.has(prop) ?? false
	}
	if (rerunStable && rerunReadList) {
		for (let j = 0; j < rerunReadIndex; j += 2) {
			if (rerunReadList[j] === target && rerunReadList[j + 1] === prop) return true
		}
		return false
	}
	const map = effect.__reads
	if (!map) return false
	const set = map.get(target)
	return set?.has(prop) ?? false
}

function callHookSafe<Args extends unknown[]>(hook: HookFunction<Args> | undefined, ...args: Args): void {
	if (!hook) return
	try {
		hook(...args)
	} catch {}
}

function findSubscribers(target: object): Set<EffectFunction> | undefined {
	const t = target as SubscribersObject
	return t[SUBSCRIBERS] ?? proxyCacheSubs.get(target)
}

function armMicrotaskFlush(): void {
	if (microtaskFlushArmed) return
	microtaskFlushArmed = true
	microtaskFlushChain = microtaskFlushing ? microtaskFlushChain + 1 : 0
	queueMicrotask((): void => {
		microtaskFlushArmed = false
		if (microtaskFlushChain >= MAX_MICROTASK_FLUSH_CHAIN) {
			pendingMicroEffects.clear()
			console.error(
				new Error(
					`Infinite loop detected: microtask effects kept rescheduling themselves for ${MAX_MICROTASK_FLUSH_CHAIN} flushes`
				)
			)
			return
		}
		for (const eff of pendingMicroEffects) pendingEffects.add(eff)
		pendingMicroEffects.clear()
		microtaskFlushing = true
		try {
			flushEffects()
			notifySettledOutsideFlush()
		} finally {
			microtaskFlushing = false
		}
	})
}

function addPendingEffect(subscriber: EffectFunction): void {
	if (subscriber.__schedule === 'microtask') {
		const prevMicro = pendingMicroEffects.size
		pendingMicroEffects.add(subscriber)
		if (pendingMicroEffects.size === prevMicro) return
		callHookSafe(subscriber.__hooks?.onSchedule, subscriber.effectName)
		armMicrotaskFlush()
		return
	}
	const prevSize = pendingEffects.size
	pendingEffects.add(subscriber)
	if (pendingEffects.size === prevSize) return
	callHookSafe(subscriber.__hooks?.onSchedule, subscriber.effectName)
}

function scheduleSubscriberWithProp(subscriber: EffectFunction, target: object, prop: PropertyKey): void {
	const hooks = subscriber.__hooks
	// runs per subscriber on every write: the size check skips a lookup that only microtask effects can hit
	if (
		(pendingEffects.has(subscriber) || (pendingMicroEffects.size > 0 && pendingMicroEffects.has(subscriber))) &&
		!hooks?.onDependencyChange
	)
		return
	const set = subscriber.__reads?.get(target)
	if (!set?.has(prop) && !set?.has(OWN_KEYS_SYMBOL)) return
	addPendingEffect(subscriber)
	if (hooks?.onDependencyChange) callHookSafe(hooks.onDependencyChange, target, prop)
}

function scheduleSubscribersForTarget(target: object, prop?: PropertyKey): void {
	const subs = findSubscribers(target)
	if (!subs?.size) return

	if (prop === undefined) {
		for (const subscriber of subs) addPendingEffect(subscriber)
	} else if (subs.size <= INDEXED_SCHEDULE_MIN_SUBSCRIBERS) {
		for (const subscriber of subs) scheduleSubscriberWithProp(subscriber, target, prop)
	} else {
		schedulePropReaders(subs, target, prop)
	}
	if (batchDepth === 0 && !isNotifying) flushEffects()
}

// Only effects that read prop, or enumerated the keys, can match; every other subscriber is skipped
function schedulePropReaders(subs: Set<EffectFunction>, target: object, prop: PropertyKey): void {
	const byProp = propIndexOf(subs)
	const readers = byProp.get(prop)
	if (readers) {
		for (const subscriber of readers) scheduleSubscriberWithProp(subscriber, target, prop)
	}
	const keyReaders = byProp.get(OWN_KEYS_SYMBOL)
	if (!keyReaders) return
	for (const subscriber of keyReaders) {
		if (!readers?.has(subscriber)) scheduleSubscriberWithProp(subscriber, target, prop)
	}
}

// Flush all pending effects
function runEffectIfActive(effect: EffectFunction): void {
	if (effect.__deps !== undefined) {
		try {
			effect()
		} catch (err) {
			// A microtask flush has no caller to rethrow to: onError already ran, otherwise report it
			if (microtaskFlushing) {
				if (!effectErrorHandled) console.error(err)
				return
			}
			pendingEffects.clear()
			effectQueue.length = 0
			throw err
		}
	}
}

function runPendingEffectBatch(): void {
	if (pendingEffects.size === 1) {
		const eff = pendingEffects.values().next().value as EffectFunction
		pendingEffects.clear()
		runEffectIfActive(eff)
		return
	}
	for (const eff of pendingEffects) effectQueue.push(eff)
	pendingEffects.clear()

	for (let i = 0; i < effectQueue.length; i++) {
		const eff = effectQueue[i]
		if (eff) runEffectIfActive(eff)
	}
	effectQueue.length = 0
}

function flushEffects(): void {
	if (pendingEffects.size === 0) return
	if (isNotifying) return
	isNotifying = true

	try {
		// A cycle after the first drains effects scheduled by onSettled callbacks, then notifies again
		for (let cycle = 0; cycle < MAX_SETTLE_CYCLES; cycle++) {
			flushProcessed = true
			while (pendingEffects.size > 0) {
				runPendingEffectBatch()
			}
			notifySettledIfQuiet()
			if (pendingEffects.size === 0) return
		}
		pendingEffects.clear()
		const err = new Error(
			`Infinite loop detected: onSettled callbacks kept scheduling effects for ${MAX_SETTLE_CYCLES} notifications`
		)
		if (!microtaskFlushing) throw err
		console.error(err)
	} finally {
		isNotifying = false
	}
}

function resetEffectTracking(eff: EffectFunction): void {
	pendingEffects.delete(eff)
	pendingMicroEffects.delete(eff)
	eff.__deps = undefined
	eff.__readList = undefined
	eff.__reads = undefined
	eff.__prevDeps = undefined
	eff.__prevReads = undefined
}

function cleanupEffect(effect: EffectFunction): void {
	removeEffectFromSubscribers(effect, effect.__deps, effect.__reads)
	resetEffectTracking(effect)
}

function cleanupChildEffect(child: EffectFunction, toCleanup: EffectFunction[]): void {
	cleanupEffect(child)

	const grandchildren = child.__children
	if (grandchildren) {
		for (const gc of grandchildren) toCleanup.push(gc)
		grandchildren.clear()
		child.__children = undefined
	}

	child.__parent = undefined
	child.__active = false
}

function cleanupEffectCompletely(effect: EffectFunction): void {
	cleanupEffect(effect)

	const toCleanup: EffectFunction[] = []
	const children = effect.__children
	if (children) {
		for (const c of children) toCleanup.push(c)
		children.clear()
		effect.__children = undefined
	}

	while (toCleanup.length > 0) {
		cleanupChildEffect(toCleanup.pop() as EffectFunction, toCleanup)
	}

	// Clean up parent relationship
	const parent = effect.__parent
	if (parent) {
		const pchildren = parent.__children
		pchildren?.delete(effect)
	}

	// Final cleanup
	effect.__parent = undefined
	effect.__active = false
}

function setContainsAll(superset: Set<PropertyKey>, subset: Set<PropertyKey>): boolean {
	if (superset === subset) return true
	for (const prop of subset) {
		if (!superset.has(prop)) return false
	}
	return true
}

function propsMatch(
	prevReads: Map<object, Set<PropertyKey>>,
	newReads: Map<object, Set<PropertyKey>>,
	target: object
): boolean {
	const prevProps = prevReads.get(target)
	const newProps = newReads.get(target)
	if (!prevProps || !newProps) return false
	if (prevProps === newProps) return true
	if (prevProps.size !== newProps.size) return false
	return setContainsAll(prevProps, newProps)
}

function allDepsPropsMatch(
	prevDeps: Set<object>,
	newDeps: Set<object>,
	prevReads: Map<object, Set<PropertyKey>>,
	newReads: Map<object, Set<PropertyKey>>
): boolean {
	for (const target of newDeps) {
		if (!prevDeps.has(target) || !propsMatch(prevReads, newReads, target)) return false
	}
	return true
}

function depsMatch(
	prevDeps: Set<object>,
	newDeps: Set<object>,
	prevReads: Map<object, Set<PropertyKey>>,
	newReads: Map<object, Set<PropertyKey>>
): boolean {
	if (prevDeps.size !== newDeps.size) return false
	if (prevDeps === newDeps && prevReads === newReads) return true
	return allDepsPropsMatch(prevDeps, newDeps, prevReads, newReads)
}

// Proxy handler functions
function createDeleteHandler<T>(
	onDelete: HookFunction<[PropertyKey, boolean, T]> | undefined
): NonNullable<ProxyHandler<ProxyTarget>['deleteProperty']> {
	return (rawTarget: ProxyTarget, prop: PropertyKey): boolean => {
		const had = Object.hasOwn(rawTarget, prop)
		const ok = delete rawTarget[prop]
		callHookSafe(onDelete, prop, had, rawTarget as T)
		if (had && ok) scheduleSubscribersForTarget(rawTarget, prop)
		return ok
	}
}

function resolveValue(value: unknown, hooks: StateHooks<object> | undefined): unknown {
	if (value === null || typeof value !== 'object') return value
	return wrapNestedObject(value as object, hooks)
}

function isInternalSymbol(prop: PropertyKey): boolean {
	return prop === SUBSCRIBERS || prop === PROXY || prop === HOOKS
}

function wrapNestedObject(value: object, hooks: StateHooks<object> | undefined): object {
	return proxyCache.get(value) ?? state(value, hooks)
}

function trackDependency(rawTarget: ProxyTarget, prop: PropertyKey): void {
	if (!currentEffect) return
	if (isTrackingOnly) {
		recordEffectRead(currentEffect, rawTarget, prop, true)
	} else {
		const subs = getSubscribers(rawTarget)
		subs.add(currentEffect)
		indexRead(subs, currentEffect, prop)
		recordEffectRead(currentEffect, rawTarget, prop, false)
	}
}

function getWrappedArrayMethod(rawTarget: ProxyTarget, prop: PropertyKey, value: unknown): CachedMethod | undefined {
	if (
		!Array.isArray(rawTarget) ||
		typeof prop !== 'string' ||
		!MUTATING_ARRAY_METHODS.has(prop) ||
		typeof value !== 'function'
	)
		return undefined
	return wrapArrayMethod(rawTarget, prop, value as CachedMethod)
}

function createGetHandler<T>(
	onRead: HookFunction<[PropertyKey, unknown, T]> | undefined,
	hooks: StateHooks<T> | undefined
): NonNullable<ProxyHandler<ProxyTarget>['get']> {
	if (!onRead && !hooks) {
		return (rawTarget: ProxyTarget, prop: PropertyKey): unknown => {
			if (isInternalSymbol(prop)) return rawTarget[prop]
			if (currentEffect) trackDependency(rawTarget, prop)
			const value = rawTarget[prop]
			if (value === null || typeof value !== 'object') return value
			const wrapped = getWrappedArrayMethod(rawTarget, prop, value)
			if (wrapped) return wrapped
			return wrapNestedObject(value as object, undefined)
		}
	}

	return (rawTarget: ProxyTarget, prop: PropertyKey): unknown => {
		if (isInternalSymbol(prop)) return rawTarget[prop]
		if (currentEffect) trackDependency(rawTarget, prop)
		const value = rawTarget[prop]

		callHookSafe(onRead, prop, value, rawTarget as T)

		const wrapped = getWrappedArrayMethod(rawTarget, prop, value)
		if (wrapped) return wrapped

		return resolveValue(value, hooks as StateHooks<object> | undefined)
	}
}

function createHasHandler<T>(
	onHas: HookFunction<[PropertyKey, boolean, T]> | undefined
): NonNullable<ProxyHandler<ProxyTarget>['has']> {
	return (rawTarget: ProxyTarget, prop: PropertyKey): boolean => {
		trackDependency(rawTarget, prop)
		const exists = prop in rawTarget
		callHookSafe(onHas, prop, exists, rawTarget as T)
		return exists
	}
}

function createOwnKeysHandler<T>(
	onOwnKeys: HookFunction<[PropertyKey[], T]> | undefined
): NonNullable<ProxyHandler<ProxyTarget>['ownKeys']> {
	return (rawTarget: ProxyTarget): (string | symbol)[] => {
		trackDependency(rawTarget, OWN_KEYS_SYMBOL)
		const keys = Reflect.ownKeys(rawTarget) as (string | symbol)[]
		callHookSafe(onOwnKeys, keys, rawTarget as T)
		return keys
	}
}

function notifyLengthChangeIfNeeded(rawTarget: ProxyTarget, oldLength: number | undefined): void {
	if (oldLength !== undefined && (rawTarget as unknown as unknown[]).length !== oldLength) {
		scheduleSubscribersForTarget(rawTarget, 'length')
	}
}

function getArrayLengthBeforeMutation(rawTarget: ProxyTarget, prop: PropertyKey): number | undefined {
	if (!Array.isArray(rawTarget) || typeof prop !== 'string') return undefined
	const index = Number(prop)
	if (Number.isNaN(index) || index < 0) return undefined
	return (rawTarget as unknown as unknown[]).length
}

function handleBatchFastPath(rawTarget: ProxyTarget, prop: PropertyKey, value: unknown): boolean {
	const oldValue = rawTarget[prop]
	if (Object.is(oldValue, value)) return true

	rawTarget[prop] = value

	if (!(rawTarget as SubscribersObject)[SUBSCRIBERS]?.size) return true

	let props = dirtyTargets.get(rawTarget)
	if (!props) {
		props = new Set<PropertyKey>()
		dirtyTargets.set(rawTarget, props)
	}
	props.add(prop)

	return true
}

function checkInfiniteLoop(rawTarget: ProxyTarget, prop: PropertyKey): void {
	if (!currentEffect || !didEffectReadProp(currentEffect, rawTarget, prop)) return
	// microtask effects re-run on a later microtask; MAX_MICROTASK_FLUSH_CHAIN bounds a self-feeding chain
	if (currentEffect.__schedule === 'microtask') return
	const parent = currentEffect.__parent
	if (parent) return
	const effectName = currentEffect.effectName
	const errorMsg = effectName
		? `Infinite loop detected: effect "${effectName}" cannot update property "${String(prop)}" it depends on`
		: 'Infinite loop detected: effect cannot update a state it depends on'
	throw new Error(errorMsg)
}

function createSetHandler<T>(
	onWrite: HookFunction<[PropertyKey, unknown, unknown, T]> | undefined
): NonNullable<ProxyHandler<ProxyTarget>['set']> {
	if (!onWrite) {
		return (rawTarget: ProxyTarget, prop: PropertyKey, value: unknown): boolean => {
			if (batchDepth > 0 && !currentEffect) {
				return handleBatchFastPath(rawTarget, prop, value)
			}
			if (!currentEffect) {
				const oldValue = rawTarget[prop]
				if (Object.is(oldValue, value)) return true
				const subs = (rawTarget as SubscribersObject)[SUBSCRIBERS]
				if (!subs?.size) {
					rawTarget[prop] = value
					return true
				}
				const oldLength = getArrayLengthBeforeMutation(rawTarget, prop)
				rawTarget[prop] = value
				scheduleSubscribersForTarget(rawTarget, prop)
				notifyLengthChangeIfNeeded(rawTarget, oldLength)
				return true
			}
			return performWrite(rawTarget, prop, value, undefined)
		}
	}

	return (rawTarget: ProxyTarget, prop: PropertyKey, value: unknown): boolean => {
		return performWrite(rawTarget, prop, value, onWrite)
	}
}

function performWrite<T>(
	rawTarget: ProxyTarget,
	prop: PropertyKey,
	value: unknown,
	onWrite: HookFunction<[PropertyKey, unknown, unknown, T]> | undefined
): boolean {
	checkInfiniteLoop(rawTarget, prop)

	const oldValue = rawTarget[prop]
	if (Object.is(oldValue, value)) return true

	const oldLength = getArrayLengthBeforeMutation(rawTarget, prop)
	rawTarget[prop] = value

	callHookSafe(onWrite, prop, oldValue, value, rawTarget as T)

	scheduleSubscribersForTarget(rawTarget, prop)
	notifyLengthChangeIfNeeded(rawTarget, oldLength)

	return true
}

function storeHooksForFrozenTarget(target: ProxyTarget, hooks: StateHooks | undefined): void {
	if (hooks) {
		frozenHooksCache.set(target, hooks)
	}
}

function definePropertyOnTarget(target: ProxyTarget, proxy: unknown, hooks: StateHooks | undefined): void {
	Object.defineProperty(target, PROXY, {
		configurable: true,
		enumerable: false,
		value: proxy,
		writable: false,
	})
	if (hooks) {
		Object.defineProperty(target, HOOKS, {
			configurable: true,
			enumerable: false,
			value: hooks,
			writable: false,
		})
	}
}

function defineProxyProperties(target: ProxyTarget, proxy: unknown, hooks: StateHooks | undefined): void {
	try {
		if (Object.isExtensible(target)) {
			definePropertyOnTarget(target, proxy, hooks)
		} else {
			storeHooksForFrozenTarget(target, hooks)
		}
	} catch {
		storeHooksForFrozenTarget(target, hooks)
	}
}

const HOOKLESS_HANDLER: ProxyHandler<ProxyTarget> = {
	deleteProperty: createDeleteHandler(undefined),
	get: createGetHandler(undefined, undefined),
	has: createHasHandler(undefined),
	ownKeys: createOwnKeysHandler(undefined),
	set: createSetHandler(undefined),
}

/** Wrap an object in a reactive Proxy. Property reads are tracked, writes notify subscribers. */
export function state<T extends object>(initial: T, hooks?: StateHooks<T>): T {
	if (initial === null || initial === undefined || typeof initial !== 'object') return initial

	const initialWithProxy = initial as ProxyObject
	const existingProxy = initialWithProxy?.[PROXY]
	if (existingProxy) return existingProxy as T

	const target = initial as ProxyTarget
	const cached = proxyCache.get(target)
	if (cached) return cached as T

	if (!hooks) {
		const proxy = new Proxy(target, HOOKLESS_HANDLER) as T
		proxyCache.set(target, proxy)
		defineProxyProperties(target, proxy, undefined)
		return proxy
	}

	const onDelete = composeHook(hooks.onDelete)
	const onHas = composeHook(hooks.onHas)
	const onOwnKeys = composeHook(hooks.onOwnKeys)
	const onRead = composeHook(hooks.onRead)
	const onWrite = composeHook(hooks.onWrite)

	const handler: ProxyHandler<ProxyTarget> = {
		deleteProperty: createDeleteHandler(onDelete),
		get: createGetHandler(onRead, hooks),
		has: createHasHandler(onHas),
		ownKeys: createOwnKeysHandler(onOwnKeys),
		set: createSetHandler(onWrite),
	} as ProxyHandler<ProxyTarget>

	const proxy = new Proxy(target, handler) as T
	proxyCache.set(target, proxy)
	defineProxyProperties(target, proxy, hooks as StateHooks | undefined)
	return proxy
}

function disposeChildEffects(eff: EffectFunction): void {
	const existing = eff.__children
	if (!existing?.size) return
	eff.__children = undefined
	for (const c of existing) {
		cleanupEffectCompletely(c)
	}
	existing.clear()
}

function removeStaleSubscribers(eff: EffectFunction, prevDeps: Set<object>, newDeps: Set<object>): void {
	for (const dep of prevDeps) {
		if (!newDeps.has(dep)) {
			findSubscribers(dep)?.delete(eff)
		}
	}
}

function registerNewSubscribers(eff: EffectFunction, prevDeps: Set<object>, newDeps: Set<object>): void {
	for (const dep of newDeps) {
		if (!prevDeps.has(dep)) {
			const subs = getSubscribers(dep)
			subs.add(eff)
		}
	}
}

function tryRestoreStableDeps(
	eff: EffectFunction,
	prevDeps: Set<object> | undefined,
	prevReads: Map<object, Set<PropertyKey>> | undefined,
	newDeps: Set<object> | undefined,
	newReads: Map<object, Set<PropertyKey>> | undefined
): boolean {
	if (!prevDeps || !prevReads || !newDeps || !newReads) return false
	if (!depsMatch(prevDeps, newDeps, prevReads, newReads)) return false
	eff.__reads = prevReads
	eff.__deps = prevDeps
	return true
}

function updateEffectSubscriptions(
	eff: EffectFunction,
	prevDeps: Set<object> | undefined,
	prevReads: Map<object, Set<PropertyKey>> | undefined
): void {
	const newDeps = eff.__deps
	const newReads = eff.__reads

	if (tryRestoreStableDeps(eff, prevDeps, prevReads, newDeps, newReads)) return

	if (!newDeps || !newReads) return

	if (prevDeps) {
		removeStaleSubscribers(eff, prevDeps, newDeps)
		registerNewSubscribers(eff, prevDeps, newDeps)
		if (prevReads) reindexReads(eff, prevReads, newReads)
	}
	eff.__prevDeps = newDeps
	eff.__prevReads = newReads
}

function reindexReads(
	eff: EffectFunction,
	prevReads: Map<object, Set<PropertyKey>>,
	newReads: Map<object, Set<PropertyKey>>
): void {
	for (const [target, props] of prevReads) {
		const subs = getSubscribers(target)
		const kept = newReads.get(target)
		for (const prop of props) {
			if (!kept?.has(prop)) unindexRead(subs, eff, prop)
		}
	}
	for (const [target, props] of newReads) {
		const subs = getSubscribers(target)
		for (const prop of props) indexRead(subs, eff, prop)
	}
}

function removeEffectFromSubscribers(
	eff: EffectFunction,
	deps: Set<object> | undefined,
	reads: Map<object, Set<PropertyKey>> | undefined
): void {
	if (!deps) return
	for (const dep of deps) {
		const subs = getSubscribers(dep)
		subs.delete(eff)
		const props = reads?.get(dep)
		if (props) {
			for (const prop of props) unindexRead(subs, eff, prop)
		}
	}
}

function cleanupEffectOnError(eff: EffectFunction): void {
	removeEffectFromSubscribers(eff, eff.__prevDeps, eff.__prevReads)
	removeEffectFromSubscribers(eff, eff.__deps, eff.__reads)
	resetEffectTracking(eff)
}

function clearRerunState(): void {
	rerunReadList = null
	rerunReadIndex = 0
	rerunStable = false
	rerunTempDeps = null
	rerunTempReads = null
	buildingReadList = null
}

function handleReadListMismatch(eff: EffectFunction): void {
	if (rerunReadList) {
		if (rerunStable) {
			rerunStable = false
			replayReadListToTempCollections(rerunReadList, rerunReadIndex)
		}
		eff.__readList = undefined
		rerunReadList = null
		rerunReadIndex = 0
	}
}

function handleRerunResult(
	eff: EffectFunction,
	prevDeps: Set<object>,
	prevReads: Map<object, Set<PropertyKey>>
): boolean {
	if (rerunStable && rerunReadList && rerunReadIndex === rerunReadList.length) {
		clearRerunState()
		return true
	}

	handleReadListMismatch(eff)

	if (rerunTempDeps && rerunTempReads) {
		if (depsMatch(prevDeps, rerunTempDeps, prevReads, rerunTempReads)) {
			if (buildingReadList) {
				eff.__readList = buildingReadList
			}
			clearRerunState()
			return true
		}
		eff.__deps = rerunTempDeps
		eff.__reads = rerunTempReads
		eff.__readList = undefined
	}

	clearRerunState()
	return false
}

function executeEffectBody(
	eff: EffectFunction,
	fn: EffectCallback,
	prevDeps: Set<object> | undefined,
	prevReads: Map<object, Set<PropertyKey>> | undefined,
	onRun: HookFunction<[EffectName | undefined]> | undefined,
	name: EffectName | undefined
): void {
	const isFirstRun = !prevDeps
	if (!isFirstRun) isTrackingOnly = true

	pendingEffects.delete(eff)
	disposeChildEffects(eff)

	currentEffect = eff

	if (isFirstRun) {
		eff.__reads = new Map<object, Set<PropertyKey>>()
		eff.__deps = new Set<object>()
	} else {
		const existingReadList = eff.__readList
		if (existingReadList) {
			rerunReadList = existingReadList
			rerunReadIndex = 0
			rerunStable = true
			buildingReadList = null
		} else {
			rerunTempDeps = new Set<object>()
			rerunTempReads = new Map<object, Set<PropertyKey>>()
			buildingReadList = []
			rerunReadList = null
			rerunStable = false
		}
	}

	callHookSafe(onRun, name)

	fn()

	if (!isFirstRun && prevDeps && prevReads) {
		if (handleRerunResult(eff, prevDeps, prevReads)) return
	}

	updateEffectSubscriptions(eff, prevDeps, prevReads)
}

function runEffectSafely(
	eff: EffectFunction,
	fn: EffectCallback,
	onRun: HookFunction<[EffectName | undefined]> | undefined,
	onError: HookFunction<[Error, EffectName | undefined]> | undefined,
	name: EffectName | undefined
): void {
	const prev = currentEffect
	const prevTrackingOnly = isTrackingOnly
	try {
		executeEffectBody(eff, fn, eff.__prevDeps, eff.__prevReads, onRun, name)
	} catch (err) {
		clearRerunState()
		cleanupEffectOnError(eff)
		effectErrorHandled = onError !== undefined
		callHookSafe(onError, err as Error, name)
		throw err
	} finally {
		currentEffect = prev
		isTrackingOnly = prevTrackingOnly
		eff.__active = false
	}
}

function registerChildEffect(eff: EffectFunction): void {
	if (!currentEffect) return
	eff.__parent = currentEffect
	let children = currentEffect.__children
	if (!children) {
		children = new Set<EffectFunction>()
		currentEffect.__children = children
	}
	children.add(eff)
}

/** Run a function whenever its tracked dependencies change. Returns an {@linkcode Unsubscribe} disposal function. */
export function effect(
	fn: EffectCallback,
	name?: EffectName,
	hooks?: EffectHooks,
	options?: EffectOptions
): Unsubscribe {
	const onRun = composeHook(hooks?.onRun)
	const onDispose = composeHook(hooks?.onDispose)
	const onError = composeHook(hooks?.onError)
	const onDependencyAdd = composeHook(hooks?.onDependencyAdd)
	const onDependencyChange = composeHook(hooks?.onDependencyChange)
	const onSchedule = composeHook(hooks?.onSchedule)

	const runEffect: EffectFunction = () => {
		if (runEffect.__active) return
		runEffect.__active = true
		runEffectSafely(runEffect, fn, onRun, onError, name)
	}

	if (onDependencyAdd || onDependencyChange || onSchedule) {
		runEffect.__hooks = { onDependencyAdd, onDependencyChange, onSchedule }
	}
	registerChildEffect(runEffect)

	if (options?.schedule) {
		runEffect.__schedule = options.schedule
	}

	if (name) {
		runEffect.effectName = name
	}

	if (batchDepth === 0) runEffect()
	else deferredEffectCreations.push(runEffect)

	return (): void => {
		callHookSafe(onDispose, name)
		cleanupEffectCompletely(runEffect)
	}
}

function flushDirtyTargets(): void {
	for (const [target, props] of dirtyTargets) {
		if (Array.isArray(target)) {
			scheduleSubscribersForTarget(target)
		} else {
			for (const prop of props) {
				scheduleSubscribersForTarget(target, prop)
			}
		}
	}
	dirtyTargets.clear()
}

function clearBatchState(): void {
	pendingEffects.clear()
	pendingMicroEffects.clear()
	deferredEffectCreations.length = 0
	dirtyTargets.clear()
}

function runDeferredEffects(): void {
	const len = deferredEffectCreations.length
	if (len > 0) {
		for (let i = 0; i < len; i++) {
			const eff = deferredEffectCreations[i]
			if (eff) eff()
		}
		deferredEffectCreations.length = 0
	}
}

function flushBatchEffects(): void {
	try {
		runDeferredEffects()
		if (pendingEffects.size > 0) flushEffects()
		notifySettledOutsideFlush()
	} catch (err) {
		clearBatchState()
		throw err
	}
}

function handleBatchError(
	err: unknown,
	onBatchError: HookFunction<[Error, number]> | undefined,
	entryDepth: number
): void {
	batchDepth--
	callHookSafe(onBatchError, err as Error, entryDepth)
	if (batchDepth === 0) {
		clearBatchState()
	}
}

/** Group multiple state mutations so effects flush once at the outermost batch boundary. */
export function batch<T>(fn: () => T, hooks?: BatchHooks): T {
	if (!hooks) {
		batchDepth++
		let result: T
		try {
			result = fn()
		} catch (err) {
			batchDepth--
			if (batchDepth === 0) clearBatchState()
			throw err
		}
		if (batchDepth === 1 && dirtyTargets.size > 0) {
			flushDirtyTargets()
		}
		batchDepth--
		if (batchDepth === 0) {
			flushBatchEffects()
		}
		return result
	}

	const onBatchStart = composeHook(hooks.onBatchStart)
	const onBatchEnd = composeHook(hooks.onBatchEnd)
	const onBatchError = composeHook(hooks.onBatchError)

	batchDepth++
	const entryDepth = batchDepth

	callHookSafe(onBatchStart, entryDepth)

	let result: T
	try {
		result = fn()
	} catch (err) {
		handleBatchError(err, onBatchError, entryDepth)
		throw err
	}
	if (batchDepth === 1 && dirtyTargets.size > 0) {
		flushDirtyTargets()
	}

	batchDepth--
	if (batchDepth === 0) {
		flushBatchEffects()
	}

	callHookSafe(onBatchEnd, entryDepth)

	return result
}

function isThenable(value: unknown): value is Promise<unknown> {
	// Promise resolution only treats objects and functions as thenables; primitives skip the .then lookup
	if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return false
	return typeof (value as { then?: unknown }).then === 'function'
}

function writeDeriveValue<T>(
	internalState: {
		lastValue: T | undefined | null
	},
	reactiveInternal: {
		value: T | undefined | null
	} | null,
	newValue: T
): void {
	if (!Object.is(newValue, internalState.lastValue)) {
		internalState.lastValue = newValue
		if (reactiveInternal) {
			reactiveInternal.value = newValue
		}
	}
}

function setDerivePending(
	internalState: {
		pending: boolean
	},
	reactiveInternal: {
		pending: boolean
	} | null,
	pending: boolean
): void {
	if (internalState.pending === pending) return
	// write through the proxy when present: a raw pre-write would make the proxy set a no-op and swallow notification
	if (reactiveInternal) {
		reactiveInternal.pending = pending
	} else {
		internalState.pending = pending
	}
}

function computeDerive<T>(
	computeFn: () => T | Promise<T>,
	internalState: {
		lastValue: T | undefined | null
		pending: boolean
	},
	reactiveInternal: {
		pending: boolean
		value: T | undefined | null
	} | null,
	onCompute: HookFunction<[T | undefined]> | undefined,
	onError: HookFunction<[Error]> | undefined,
	onAsync: (result: Promise<T>) => void,
	cleanup: () => void
): void {
	try {
		callHookSafe(onCompute, internalState.lastValue as T | undefined)
		const newValue = computeFn()
		if (isThenable(newValue)) {
			onAsync(newValue as Promise<T>)
		} else {
			writeDeriveValue(internalState, reactiveInternal, newValue as T)
			setDerivePending(internalState, reactiveInternal, false)
		}
	} catch (err) {
		callHookSafe(onError, err as Error)
		throw err
	} finally {
		cleanup()
	}
}

/** Eagerly compute a value from reactive dependencies. Returns a {@linkcode ComputedValue} — set `reactive` to `false` to dispose. */
export function derive<T>(computeFn: () => Promise<T>, hooks?: DeriveHooks<T>): ComputedValue<Awaited<T>>
export function derive<T>(computeFn: () => T, hooks?: DeriveHooks<T>): ComputedValue<T>
export function derive<T>(computeFn: () => T | Promise<T>, hooks?: DeriveHooks<T>): ComputedValue<T> {
	const onCompute = composeHook(hooks?.onCompute)
	const onCacheHit = composeHook(hooks?.onCacheHit)
	const onDeriveDispose = composeHook(hooks?.onDispose)
	const onError = composeHook(hooks?.onError)
	const onDependencyChange = composeHook(hooks?.onDependencyChange)

	const internalState = {
		lastValue: undefined as T | undefined | null,
		pending: false,
		reactive: true,
		value: undefined as T | undefined | null,
	}

	let dispose: Unsubscribe | null = null
	let generation = 0
	let isComputing = false
	let reactiveInternal: typeof internalState | null = null

	const createEffect = (): void => {
		if (dispose) return

		reactiveInternal = state(internalState)

		dispose = effect(
			(): void => {
				if (!internalState.reactive || isComputing) return

				isComputing = true
				computeDerive(
					computeFn,
					internalState,
					reactiveInternal,
					onCompute,
					onError,
					(result: Promise<T>): void => {
						// a newer computation bumps generation; a sync result or dispose clears pending; either discards this settle
						const gen = ++generation
						setDerivePending(internalState, reactiveInternal, true)
						result.then(
							(value: T): void => {
								if (gen !== generation || !internalState.pending) return
								settleProcessed = true
								batch((): void => {
									writeDeriveValue(internalState, reactiveInternal, value)
									setDerivePending(internalState, reactiveInternal, false)
								})
							},
							(err: unknown): void => {
								if (gen !== generation || !internalState.pending) return
								settleProcessed = true
								batch((): void => {
									setDerivePending(internalState, reactiveInternal, false)
								})
								callHookSafe(onError, err as Error)
							}
						)
					},
					(): void => {
						isComputing = false
					}
				)
			},
			undefined,
			onDependencyChange && {
				onDependencyChange,
			}
		)
	}

	const disposeEffect = (): void => {
		if (dispose) {
			callHookSafe(onDeriveDispose)
			dispose()
			dispose = null
			setDerivePending(internalState, reactiveInternal, false)
			reactiveInternal = null
		}
	}

	if (internalState.reactive) {
		createEffect()
	}

	const readValue = (): T | undefined | null => {
		if (untilEvaluating) {
			untilSawPending = untilSawPending || internalState.pending
			if (reactiveInternal && currentEffect) void reactiveInternal.pending
		}
		const value = reactiveInternal && currentEffect ? reactiveInternal.value : internalState.value
		callHookSafe(onCacheHit, value as T, !isComputing)
		return value
	}

	return new Proxy(internalState, {
		get(target: typeof internalState, prop: PropertyKey): unknown {
			if (prop === 'value') {
				return readValue()
			}
			if (prop === 'pending') {
				return reactiveInternal && currentEffect ? reactiveInternal.pending : target.pending
			}
			if (prop === 'reactive') {
				return target.reactive
			}
			return undefined
		},
		set(target: typeof internalState, prop: PropertyKey, value: unknown): boolean {
			if (prop === 'reactive') {
				const wasReactive = target.reactive
				target.reactive = value as boolean
				if (value && !wasReactive && !dispose) createEffect()
				else if (!value && wasReactive && dispose) disposeEffect()
				return true
			}
			return false
		},
	}) as ComputedValue<T>
}

function notifySettledIfQuiet(): void {
	if (pendingEffects.size > 0 || effectQueue.length > 0 || microtaskFlushArmed) return
	if (!flushProcessed && !settleProcessed) return
	flushProcessed = false
	settleProcessed = false
	// runs on every flush: skip creating an iterator when nothing listens
	if (settledCallbacks.size === 0) return
	for (const callback of settledCallbacks) {
		try {
			callback()
		} catch {}
	}
}

// Callback writes queue while isNotifying is set; outside a flush they are flushed once every callback has returned
function notifySettledOutsideFlush(): void {
	if (isNotifying) {
		notifySettledIfQuiet()
		return
	}
	isNotifying = true
	notifySettledIfQuiet()
	isNotifying = false
	flushEffects()
}

/** Invoke a callback whenever the reactive graph reaches quiescence after processing work. Returns an unsubscribe. */
export function onSettled(callback: SettledCallback): Unsubscribe {
	settledCallbacks.add(callback)
	return (): void => {
		settledCallbacks.delete(callback)
	}
}

function runUntil<T>(
	predicate: () => T,
	options: UntilOptions | undefined,
	resolve: (value: T) => void,
	reject: (reason: unknown) => void
): void {
	const signal = options?.signal
	const timeout = options?.timeout
	let done = false
	let stop: Unsubscribe = (): void => {}
	let timer: ReturnType<typeof setTimeout> | undefined
	const cleanup = (): void => {
		if (timer !== undefined) clearTimeout(timer)
		if (signal) signal.removeEventListener('abort', onAbort)
		const unsubscribe = stop
		stop = (): void => {}
		unsubscribe()
	}
	const fail = (reason: unknown): void => {
		if (done) return
		done = true
		cleanup()
		reject(reason)
	}
	const onAbort = (): void => {
		fail(signal?.reason)
	}
	if (signal)
		signal.addEventListener('abort', onAbort, {
			once: true,
		})
	if (timeout !== undefined) {
		timer = setTimeout((): void => {
			fail(new Error(`until() timed out after ${timeout}ms`))
		}, timeout)
	}
	stop = effect((): void => {
		if (done) return
		untilSawPending = false
		untilEvaluating = true
		let value: T
		try {
			value = predicate()
		} catch (err) {
			// The error belongs to the awaiter, not the writer; settle on a microtask so `stop` is assigned on a first-run throw
			done = true
			queueMicrotask((): void => {
				cleanup()
				reject(err)
			})
			return
		} finally {
			untilEvaluating = false
		}
		if (value && !untilSawPending) {
			done = true
			queueMicrotask((): void => {
				cleanup()
				resolve(value)
			})
		}
	})
}

/** Resolve with the predicate's value once a settled evaluation is truthy. Must not be called inside a reactive scope. */
export function until<T>(predicate: () => T, options?: UntilOptions): Promise<T> {
	if (currentEffect) {
		throw new Error('until() must not be called inside a reactive scope')
	}
	const signal = options?.signal
	if (signal?.aborted) {
		return Promise.reject(signal.reason)
	}
	return new Promise<T>((resolve, reject): void => {
		runUntil(predicate, options, resolve, reject)
	})
}
