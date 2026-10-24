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

/** Derived value returned by {@linkcode derive}. Set `reactive` to `false` to dispose. */
export type DerivedValue<T> = {
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

/** Callback for {@linkcode onIdle}, invoked when the graph goes idle: no effect queued and no microtask flush armed. */
export type IdleCallback = () => void

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
// A dirty array wakes every subscriber at the batch end, so its entry never records properties: this shared
// empty set stands in for the per-batch Set an array method call would otherwise allocate
const ARRAY_DIRTY_PROPS: Set<PropertyKey> = new Set<PropertyKey>()
const idleCallbacks: Set<IdleCallback> = new Set<IdleCallback>()
let settleProcessed = false
let flushProcessed = false
let microtaskFlushArmed = false
let microtaskFlushing = false
// Consecutive microtask flushes each armed by the one before it, with no macrotask in between
let microtaskFlushChain = 0
let effectErrorHandled = false
let untilEvaluating = false
let untilSawPending = false
// ponytail: process-wide flag, armed only by a target sealed or frozen after state() and before its first
// subscription; once armed, every hookless no-subscriber write pays a proxyCacheSubs miss (~+10% on that path)
let hasFallbackSubs = false

// Proxy caching
// Only targets that could not take the [PROXY] symbol: a WeakMap entry per state() cost 2.6x on creation (GC
// ephemeron work), and an extensible target carries its Proxy on itself
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

// A native mutating array method, or the wrapper the Proxy hands out in its place
type ArrayMethod = (...args: unknown[]) => unknown
// Keyed by the native method: the wrapper acts on its call receiver, so one wrapper serves every array
const arrayMethodCache: WeakMap<ArrayMethod, ArrayMethod> = new WeakMap()
// Only these two take the direct path (Q52 a); any other function under their names keeps the Proxy receiver
const NATIVE_PUSH: ArrayMethod = Array.prototype.push as ArrayMethod
const NATIVE_POP: ArrayMethod = Array.prototype.pop as ArrayMethod

type ArrayTarget = ProxyTarget & unknown[]

// What the direct push and pop of one array act on: its raw target and its composed hooks. An array target
// carries it in its [HOOKS] slot, where the shared wrappers read it through the Proxy receiver's internal-symbol
// guard: a WeakMap keyed by the Proxy cost 2.7x on array state creation (GC ephemeron work). A class, so the
// wrappers can tell it from the hooks object a non-array target keeps in the same slot
class DirectArrayContext {
	readonly hooks: StateHooks<object> | undefined
	readonly onDelete: HookFunction<[PropertyKey, boolean, object]> | undefined
	readonly onRead: HookFunction<[PropertyKey, unknown, object]> | undefined
	readonly onWrite: HookFunction<[PropertyKey, unknown, unknown, object]> | undefined
	readonly target: ArrayTarget

	constructor(
		target: ArrayTarget,
		hooks: StateHooks<object> | undefined,
		onDelete: HookFunction<[PropertyKey, boolean, object]> | undefined,
		onRead: HookFunction<[PropertyKey, unknown, object]> | undefined,
		onWrite: HookFunction<[PropertyKey, unknown, unknown, object]> | undefined
	) {
		this.hooks = hooks
		this.onDelete = onDelete
		this.onRead = onRead
		this.onWrite = onWrite
		this.target = target
	}
}

// What the [HOOKS] slot of a target holds: the hooks of a non-array target, the direct context of an array
type HooksSlot = StateHooks | DirectArrayContext | undefined

const frozenHooksCache: WeakMap<object, StateHooks | DirectArrayContext> = new WeakMap()
const MAX_IDLE_CYCLES = 100
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
	[HOOKS]?: HooksSlot
	[PROXY]?: object
}

// The hookless batch() bookkeeping without the batch(fn) closure: one allocation less per method call
function applyInBatch(method: ArrayMethod, receiver: unknown, args: unknown[]): unknown {
	batchDepth++
	let result: unknown
	try {
		result = method.apply(receiver, args)
	} catch (err) {
		abortBatch()
		throw err
	}
	endBatch()
	return result
}

function wrapArrayMethod(nativeMethod: ArrayMethod): ArrayMethod {
	let wrapped = arrayMethodCache.get(nativeMethod)
	if (!wrapped) {
		if (nativeMethod === NATIVE_PUSH) {
			wrapped = directPushWrapper
		} else if (nativeMethod === NATIVE_POP) {
			wrapped = directPopWrapper
		} else {
			// The receiver is the Proxy the caller went through, so every read and write the method performs
			// passes the traps; the batch collapses them into one wake per subscriber after the method returns
			wrapped = function (this: unknown, ...args: unknown[]): unknown {
				return applyInBatch(nativeMethod, this, args)
			}
		}
		arrayMethodCache.set(nativeMethod, wrapped)
	}
	return wrapped
}

// The wrappers the cache hands out for the native push and pop: a receiver whose [HOOKS] slot holds a context is
// a reactive array and takes the direct path; any other receiver, such as push.call(otherArray), runs the native
// method in a batch. A nullish receiver has no slot to read, so the native method raises its own TypeError.
// The raw target as receiver takes the direct path too, because its slot carries the context
function directPushWrapper(this: unknown, ...items: unknown[]): unknown {
	const context = (this as ProxyObject | null | undefined)?.[HOOKS]
	if (!(context instanceof DirectArrayContext)) return applyInBatch(NATIVE_PUSH, this, items)
	return applyInBatch(directPush as ArrayMethod, context, items)
}

function directPopWrapper(this: unknown, ...args: unknown[]): unknown {
	const context = (this as ProxyObject | null | undefined)?.[HOOKS]
	if (!(context instanceof DirectArrayContext)) return applyInBatch(NATIVE_POP, this, args)
	return applyInBatch(directPop as ArrayMethod, context, args)
}

// The get trap's bookkeeping for a property the native method reads on the raw target
function recordDirectRead(context: DirectArrayContext, prop: PropertyKey, value: unknown): void {
	if (currentEffect) trackDependency(context.target, prop)
	callHookSafe(context.onRead, prop, value, context.target)
}

// The set trap's bookkeeping for a write the native method already performed on the raw target: an equal value
// stays silent, but inside an effect the loop check still runs first. A write that grew the array went to an
// absent index, so it is a change whatever the item, as the set trap treats an absent property (Q65 a)
function recordDirectWrite(
	context: DirectArrayContext,
	prop: PropertyKey,
	oldValue: unknown,
	value: unknown,
	grewLength: boolean
): void {
	const target = context.target
	if (currentEffect) checkInfiniteLoop(target, prop)
	if (!grewLength && Object.is(oldValue, value)) return
	callHookSafe(context.onWrite, prop, oldValue, value, target)
	if (currentEffect) {
		// the effect path schedules per property; an index write that grew the array also wakes length readers
		scheduleSubscribersForTarget(target, prop)
		if (grewLength) scheduleSubscribersForTarget(target, 'length')
		return
	}
	// outside an effect the array goes dirty once and wakes every subscriber at the batch end
	if (!dirtyTargets.has(target) && findSubscribers(target)?.size) dirtyTargets.set(target, ARRAY_DIRTY_PROPS)
}

// Reads length, pushes on the raw target, then replays a set of each new index and of length
function directPush(this: DirectArrayContext, ...items: unknown[]): number {
	const target = this.target
	const length = target.length
	recordDirectRead(this, 'length', length)
	const result = NATIVE_PUSH.apply(target, items) as number
	for (let i = 0; i < items.length; i++) recordDirectWrite(this, String(length + i), undefined, items[i], true)
	// the index writes already grew the raw length, so the set trap sees the length write as equal: inside an
	// effect only its loop check remains
	recordDirectWrite(this, 'length', result, result, false)
	return result
}

// Reads length and the last index, pops on the raw target, then replays the delete of that index and a set
// of length; the delete gets no loop check and no equal check, as the delete trap has none (Q57 a)
function directPop(this: DirectArrayContext): unknown {
	const target = this.target
	const length = target.length
	recordDirectRead(this, 'length', length)
	if (length === 0) {
		recordDirectWrite(this, 'length', 0, 0, false)
		return undefined
	}
	const index = String(length - 1)
	const value = target[index]
	recordDirectRead(this, index, value)
	const had = Object.hasOwn(target, index)
	NATIVE_POP.call(target)
	callHookSafe(this.onDelete, index, had, target)
	if (had) scheduleSubscribersForTarget(target, index)
	recordDirectWrite(this, 'length', length, length - 1, false)
	// the get trap hands out the reactive wrapper of a nested object, so pop returns the same
	if (value === null || typeof value !== 'object') return value
	return wrapNestedObject(value, this.hooks)
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
			return
		}
	} catch {
		// a Proxy target that rejects symbol defines
	}
	proxyCacheSubs.set(target, subscriberSet)
	// the hookless fast paths consult proxyCacheSubs only for targets without PROXY; a target that took PROXY at
	// state() time and cannot take SUBSCRIBERS now was sealed or frozen in between, so arm the lookup for everyone
	if ((target as ProxyObject)[PROXY] !== undefined) hasFallbackSubs = true
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
	const subs = (target as SubscribersObject)[SUBSCRIBERS]
	if (subs !== undefined) return subs
	return hasFallbackSubs || (target as ProxyObject)[PROXY] === undefined ? proxyCacheSubs.get(target) : undefined
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
			notifyIdleOutsideFlush()
		} finally {
			microtaskFlushing = false
		}
	})
}

function addPendingEffect(subscriber: EffectFunction): void {
	const isMicro = subscriber.__schedule === 'microtask'
	const queue = isMicro ? pendingMicroEffects : pendingEffects
	const prevSize = queue.size
	queue.add(subscriber)
	if (queue.size === prevSize) return
	callHookSafe(subscriber.__hooks?.onSchedule, subscriber.effectName)
	if (isMicro) armMicrotaskFlush()
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
		// A cycle after the first drains effects scheduled by onIdle callbacks, then notifies again
		for (let cycle = 0; cycle < MAX_IDLE_CYCLES; cycle++) {
			flushProcessed = true
			while (pendingEffects.size > 0) {
				runPendingEffectBatch()
			}
			notifyIfIdle()
			if (pendingEffects.size === 0) return
		}
		pendingEffects.clear()
		const err = new Error(
			`Infinite loop detected: onIdle callbacks kept scheduling effects for ${MAX_IDLE_CYCLES} notifications`
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

// Iterative, not recursive: deep effect trees must not overflow the stack
function cleanupEffectCompletely(effect: EffectFunction): void {
	const pending: EffectFunction[] = [effect]
	while (pending.length > 0) {
		const eff = pending.pop() as EffectFunction
		cleanupEffect(eff)
		if (eff.__children) {
			for (const c of eff.__children) pending.push(c)
			eff.__children = undefined
		}
		eff.__parent?.__children?.delete(eff)
		eff.__parent = undefined
		eff.__active = false
	}
}

function setContainsAll(superset: Set<PropertyKey>, subset: Set<PropertyKey>): boolean {
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
	// every builder of a reads map adds the target's Set together with the deps entry, so both lookups are defined
	const prevProps = prevReads.get(target) as Set<PropertyKey>
	const newProps = newReads.get(target) as Set<PropertyKey>
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

function isInternalSymbol(prop: PropertyKey): boolean {
	return prop === SUBSCRIBERS || prop === PROXY || prop === HOOKS
}

// The symbol read is the fast path; state() finds a non-extensible value's Proxy in proxyCache
function wrapNestedObject(value: object, hooks: StateHooks<object> | undefined): object {
	return (value as ProxyObject)[PROXY] ?? state(value, hooks)
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

// Every property read calls this: any change to its body, even in code a plain-object read never reaches, cost
// 2 to 5% on the read benchmark, so the direct push/pop dispatch lives in the cached wrappers instead (Q61 a)
function getWrappedArrayMethod(rawTarget: ProxyTarget, prop: PropertyKey, value: unknown): ArrayMethod | undefined {
	if (!Array.isArray(rawTarget) || typeof value !== 'function') return undefined
	// The cache hit comes before the name check: a wrapped method is read far more often than it is first wrapped
	const wrapped = arrayMethodCache.get(value as ArrayMethod)
	if (wrapped) return wrapped
	if (typeof prop !== 'string' || !MUTATING_ARRAY_METHODS.has(prop)) return undefined
	return wrapArrayMethod(value as ArrayMethod)
}

function createGetHandler<T>(
	onRead: HookFunction<[PropertyKey, unknown, T]> | undefined,
	hooks: StateHooks<T> | undefined
): NonNullable<ProxyHandler<ProxyTarget>['get']> {
	// One keyed load per trap, before the internal-symbol check: a second load site reached only with array
	// targets (the direct push/pop reading [HOOKS]) lost its map feedback whenever those arrays were collected,
	// and V8 then deoptimized the trap on the next direct call, which cost 4% on every later property read
	if (!onRead && !hooks) {
		return (rawTarget: ProxyTarget, prop: PropertyKey): unknown => {
			const value = rawTarget[prop]
			if (isInternalSymbol(prop)) return value
			if (currentEffect) trackDependency(rawTarget, prop)
			const wrapped = getWrappedArrayMethod(rawTarget, prop, value)
			if (wrapped) return wrapped
			if (value === null || typeof value !== 'object') return value
			return wrapNestedObject(value as object, undefined)
		}
	}

	return (rawTarget: ProxyTarget, prop: PropertyKey): unknown => {
		const value = rawTarget[prop]
		if (isInternalSymbol(prop)) return value
		if (currentEffect) trackDependency(rawTarget, prop)

		callHookSafe(onRead, prop, value, rawTarget as T)

		const wrapped = getWrappedArrayMethod(rawTarget, prop, value)
		if (wrapped) return wrapped

		if (value === null || typeof value !== 'object') return value
		return wrapNestedObject(value as object, hooks as StateHooks<object> | undefined)
	}
}

// An array target's [HOOKS] slot holds the context its direct push and pop find through the Proxy receiver
function hooksSlotFor<T>(
	target: ProxyTarget,
	hooks: StateHooks<T> | undefined,
	onDelete: HookFunction<[PropertyKey, boolean, T]> | undefined,
	onRead: HookFunction<[PropertyKey, unknown, T]> | undefined,
	onWrite: HookFunction<[PropertyKey, unknown, unknown, T]> | undefined
): HooksSlot {
	if (!Array.isArray(target)) return hooks as StateHooks | undefined
	return new DirectArrayContext(
		target as ArrayTarget,
		hooks as StateHooks<object> | undefined,
		onDelete as DirectArrayContext['onDelete'],
		onRead as DirectArrayContext['onRead'],
		onWrite as DirectArrayContext['onWrite']
	)
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

function handleBatchFastPath<T>(
	rawTarget: ProxyTarget,
	prop: PropertyKey,
	value: unknown,
	onWrite: HookFunction<[PropertyKey, unknown, unknown, T]> | undefined
): boolean {
	const oldValue = rawTarget[prop]
	if (isUnchangedWrite(rawTarget, prop, oldValue, value)) return true

	rawTarget[prop] = value
	if (onWrite) callHookSafe(onWrite, prop, oldValue, value, rawTarget as T)

	// A target already in dirtyTargets had subscribers at its first write, so only the first write looks them up
	const props = dirtyTargets.get(rawTarget)
	if (props === ARRAY_DIRTY_PROPS) return true
	if (props) {
		props.add(prop)
		return true
	}

	// inlined, not findSubscribers: the call cost ~5% on the batch + derive benchmarks
	let subs = (rawTarget as SubscribersObject)[SUBSCRIBERS]
	if (subs === undefined && (hasFallbackSubs || (rawTarget as ProxyObject)[PROXY] === undefined)) {
		subs = proxyCacheSubs.get(rawTarget)
	}
	if (!subs?.size) return true

	if (Array.isArray(rawTarget)) {
		dirtyTargets.set(rawTarget, ARRAY_DIRTY_PROPS)
	} else {
		dirtyTargets.set(rawTarget, new Set<PropertyKey>([prop]))
	}
	return true
}

// Equal means equal to the value of a property that exists: a write of undefined to an absent property is a
// change, as it is on a plain object (Q65 a). A read that is not undefined proves the property exists, so only
// an equal undefined write pays the existence check; `in` costs 4% there where Object.hasOwn cost 35%
function isUnchangedWrite(rawTarget: ProxyTarget, prop: PropertyKey, oldValue: unknown, value: unknown): boolean {
	return Object.is(oldValue, value) && (value !== undefined || prop in rawTarget)
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
	// One trap for hooked and hookless state: onWrite only observes, it never selects a notification path
	return (rawTarget: ProxyTarget, prop: PropertyKey, value: unknown): boolean => {
		if (batchDepth > 0 && !currentEffect) {
			return handleBatchFastPath(rawTarget, prop, value, onWrite)
		}
		if (!currentEffect) {
			return performUnbatchedWrite(rawTarget, prop, value, onWrite)
		}
		return performWrite(rawTarget, prop, value, onWrite)
	}
}

// Outside any effect and batch: no loop check, and a target without subscribers skips scheduling
function performUnbatchedWrite<T>(
	rawTarget: ProxyTarget,
	prop: PropertyKey,
	value: unknown,
	onWrite: HookFunction<[PropertyKey, unknown, unknown, T]> | undefined
): boolean {
	const oldValue = rawTarget[prop]
	if (isUnchangedWrite(rawTarget, prop, oldValue, value)) return true
	const subs = findSubscribers(rawTarget)
	if (!subs?.size) {
		rawTarget[prop] = value
		if (onWrite) callHookSafe(onWrite, prop, oldValue, value, rawTarget as T)
		return true
	}
	const oldLength = getArrayLengthBeforeMutation(rawTarget, prop)
	rawTarget[prop] = value
	if (onWrite) callHookSafe(onWrite, prop, oldValue, value, rawTarget as T)
	scheduleSubscribersForTarget(rawTarget, prop)
	notifyLengthChangeIfNeeded(rawTarget, oldLength)
	return true
}

function performWrite<T>(
	rawTarget: ProxyTarget,
	prop: PropertyKey,
	value: unknown,
	onWrite: HookFunction<[PropertyKey, unknown, unknown, T]> | undefined
): boolean {
	checkInfiniteLoop(rawTarget, prop)

	const oldValue = rawTarget[prop]
	if (isUnchangedWrite(rawTarget, prop, oldValue, value)) return true

	const oldLength = getArrayLengthBeforeMutation(rawTarget, prop)
	rawTarget[prop] = value

	callHookSafe(onWrite, prop, oldValue, value, rawTarget as T)

	scheduleSubscribersForTarget(rawTarget, prop)
	notifyLengthChangeIfNeeded(rawTarget, oldLength)

	return true
}

function storeHooksForFrozenTarget(target: ProxyTarget, hooks: HooksSlot): void {
	if (hooks) {
		frozenHooksCache.set(target, hooks)
	}
}

function definePropertyOnTarget(target: ProxyTarget, proxy: unknown, hooks: HooksSlot): void {
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

// Returns whether the target took the [PROXY] symbol; only a target that did not needs the proxyCache entry
function defineProxyProperties(target: ProxyTarget, proxy: unknown, hooks: HooksSlot): boolean {
	try {
		if (Object.isExtensible(target)) {
			definePropertyOnTarget(target, proxy, hooks)
			return true
		}
		storeHooksForFrozenTarget(target, hooks)
	} catch {
		storeHooksForFrozenTarget(target, hooks)
	}
	return false
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
		if (!defineProxyProperties(target, proxy, hooksSlotFor(target, undefined, undefined, undefined, undefined))) {
			proxyCache.set(target, proxy)
		}
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
	if (!defineProxyProperties(target, proxy, hooksSlotFor(target, hooks, onDelete, onRead, onWrite))) {
		proxyCache.set(target, proxy)
	}
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

// Reached on a first run, or on a re-run handleRerunResult did not keep. A re-run can arrive here with deps
// identical to prevDeps: a child effect that throws on its first run clears the re-run state in its own catch,
// and when the parent catches that throw, no temp collections remain, so handleRerunResult returns false.
// On identical sets every step below is a no-op, so no stable-dependency restore path is needed before them.
function updateEffectSubscriptions(
	eff: EffectFunction,
	prevDeps: Set<object> | undefined,
	prevReads: Map<object, Set<PropertyKey>> | undefined
): void {
	const newDeps = eff.__deps
	const newReads = eff.__reads
	// Both are cleared when the effect's own dispose handle is called from inside its body (cleanupEffect ran)
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
		if (props === ARRAY_DIRTY_PROPS) {
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
	if (len === 0) return
	for (let i = 0; i < len; i++) {
		const eff = deferredEffectCreations[i]
		if (eff) eff()
	}
	deferredEffectCreations.length = 0
}

function flushBatchEffects(): void {
	try {
		runDeferredEffects()
		if (pendingEffects.size > 0) flushEffects()
		notifyIdleOutsideFlush()
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

function abortBatch(): void {
	batchDepth--
	if (batchDepth === 0) clearBatchState()
}

// Dirty targets flush at depth 1, before the decrement, so their scheduling still sees an open batch
function endBatch(): void {
	if (batchDepth === 1 && dirtyTargets.size > 0) flushDirtyTargets()
	batchDepth--
	if (batchDepth === 0) flushBatchEffects()
}

/** Group multiple state mutations so effects flush once at the outermost batch boundary. */
export function batch<T>(fn: () => T, hooks?: BatchHooks): T {
	if (!hooks) {
		batchDepth++
		let result: T
		try {
			result = fn()
		} catch (err) {
			abortBatch()
			throw err
		}
		endBatch()
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
	endBatch()

	callHookSafe(onBatchEnd, entryDepth)

	return result
}

function isThenable(value: unknown): value is Promise<unknown> {
	// Promise resolution only treats objects and functions as thenables; primitives skip the .then lookup
	if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return false
	return typeof (value as { then?: unknown }).then === 'function'
}

type DeriveInternal<T> = {
	lastValue: T | undefined | null
	pending: boolean
	value: T | undefined | null
}

function writeDeriveValue<T>(
	internalState: DeriveInternal<T>,
	reactiveInternal: DeriveInternal<T> | null,
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
	internalState: DeriveInternal<unknown>,
	reactiveInternal: DeriveInternal<unknown> | null,
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
	internalState: DeriveInternal<T>,
	reactiveInternal: DeriveInternal<T> | null,
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

/** Eagerly compute a derived value from reactive dependencies. Returns a {@linkcode DerivedValue} — set `reactive` to `false` to dispose. */
export function derive<T>(computeFn: () => Promise<T>, hooks?: DeriveHooks<T>): DerivedValue<Awaited<T>>
export function derive<T>(computeFn: () => T, hooks?: DeriveHooks<T>): DerivedValue<T>
export function derive<T>(computeFn: () => T | Promise<T>, hooks?: DeriveHooks<T>): DerivedValue<T> {
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

	createEffect()

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
				else if (!value && wasReactive && dispose) {
					callHookSafe(onDeriveDispose)
					dispose()
					dispose = null
					setDerivePending(internalState, reactiveInternal, false)
					reactiveInternal = null
				}
				return true
			}
			return false
		},
	}) as DerivedValue<T>
}

function notifyIfIdle(): void {
	if (pendingEffects.size > 0 || effectQueue.length > 0 || microtaskFlushArmed) return
	if (!flushProcessed && !settleProcessed) return
	flushProcessed = false
	settleProcessed = false
	// runs on every flush: skip creating an iterator when nothing listens
	if (idleCallbacks.size === 0) return
	for (const callback of idleCallbacks) {
		try {
			callback()
		} catch {}
	}
}

// Callback writes queue while isNotifying is set; outside a flush they are flushed once every callback has returned
function notifyIdleOutsideFlush(): void {
	if (isNotifying) {
		notifyIfIdle()
		return
	}
	isNotifying = true
	notifyIfIdle()
	isNotifying = false
	flushEffects()
}

/** Invoke a callback whenever the reactive graph goes idle after processing work. A pending async computation does not keep the graph busy. Returns an unsubscribe. */
export function onIdle(callback: IdleCallback): Unsubscribe {
	idleCallbacks.add(callback)
	return (): void => {
		idleCallbacks.delete(callback)
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
		stop()
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
