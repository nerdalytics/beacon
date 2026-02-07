// Beacon - reactive state management system
import { composeHook } from './hooks/compose.ts'
import type { BatchHooks, DeriveHooks, EffectHooks, HookFunction, SingleOrArray, StateHooks } from './types.ts'

// Type definitions
export type Unsubscribe = () => void
export type EffectCallback = () => void
export type EffectName = string

export type ComputedValue<T> = {
	readonly value: T | undefined | null
	reactive: boolean
}

type ProxyTarget = Record<PropertyKey, unknown>

// Configuration constants
const CONFIG = {
	MAX_BATCH_DEPTH: 100,
	MUTATING_ARRAY_METHODS: [
		'push',
		'pop',
		'shift',
		'unshift',
		'splice',
		'sort',
		'reverse',
	] as const,
} as const

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
const effectQueue: EffectFunction[] = []
const deferredEffectCreations: EffectFunction[] = []
const dirtyTargets: Map<object, Set<PropertyKey>> = new Map<object, Set<PropertyKey>>()

// WeakMaps for tracking relationships
const parentEffect: WeakMap<EffectFunction, EffectFunction> = new WeakMap<EffectFunction, EffectFunction>()
const childEffects: WeakMap<EffectFunction, Set<EffectFunction>> = new WeakMap<EffectFunction, Set<EffectFunction>>()

const effectStateReads: WeakMap<EffectFunction, WeakMap<object, Set<PropertyKey>>> = new WeakMap<
	EffectFunction,
	WeakMap<object, Set<PropertyKey>>
>()

const effectDependencies: WeakMap<EffectFunction, Set<object>> = new WeakMap<EffectFunction, Set<object>>()

// Proxy caching
const proxyCache: WeakMap<object, object> = new WeakMap<object, object>()
const proxyCacheSubs: WeakMap<object, Set<EffectFunction>> = new WeakMap<object, Set<EffectFunction>>()
const subscriberCache: WeakMap<object, Set<EffectFunction>> = new WeakMap<object, Set<EffectFunction>>()

const MUTATING_ARRAY_METHODS: Set<string> = new Set(CONFIG.MUTATING_ARRAY_METHODS)

// Symbol for cached methods
const CACHED_METHODS: unique symbol = Symbol('[[cachedMethods]]')

// Function type for cached methods
type CachedMethod = (...args: unknown[]) => unknown
const frozenMethodCache: WeakMap<object, Map<PropertyKey, CachedMethod>> = new WeakMap()
const frozenHooksCache: WeakMap<object, StateHooks> = new WeakMap()

// Effect function type
type EffectFunction = {
	(): void
	__active?: boolean
	__hooks?: {
		onDependencyAdd?: HookFunction<
			[
				object,
				PropertyKey,
				string | undefined,
			]
		>
		onDependencyChange?: HookFunction<
			[
				object,
				PropertyKey,
			]
		>
		onSchedule?: HookFunction<
			[
				string | undefined,
			]
		>
	}
	__prevDeps?: Set<object> | undefined
	__prevReads?: WeakMap<object, Set<PropertyKey>> | undefined
	effectName?: string
}

// Helper types for objects with internal symbols
type SubscribersObject = ProxyTarget & {
	[SUBSCRIBERS]?: Set<EffectFunction>
}

type ProxyObject = ProxyTarget & {
	[PROXY]?: object
}

type CachedMethodsObject = ProxyTarget & {
	[CACHED_METHODS]?: Record<PropertyKey, CachedMethod>
}

function getCachedMethodFromWeakMap(target: object, prop: PropertyKey, originalMethod: CachedMethod): CachedMethod {
	let cache = frozenMethodCache.get(target)
	if (!cache) {
		cache = new Map<PropertyKey, CachedMethod>()
		frozenMethodCache.set(target, cache)
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
	const cached = subscriberCache.get(target)
	if (cached) return cached

	const targetWithSubs = target as SubscribersObject
	if (targetWithSubs[SUBSCRIBERS] instanceof Set) {
		const subscriberSet = targetWithSubs[SUBSCRIBERS]
		subscriberCache.set(target, subscriberSet)
		return subscriberSet
	}

	const fallbackSubs = proxyCacheSubs.get(target)
	if (fallbackSubs) {
		subscriberCache.set(target, fallbackSubs)
		return fallbackSubs
	}

	const subscriberSet = new Set<EffectFunction>()
	storeSubscriberSet(target, subscriberSet)
	subscriberCache.set(target, subscriberSet)
	return subscriberSet
}

function recordEffectRead(eff: EffectFunction, target: object, prop: PropertyKey, silent: boolean): void {
	let deps = effectDependencies.get(eff)
	if (!deps) {
		deps = new Set<object>()
		effectDependencies.set(eff, deps)
	}
	deps.add(target)

	let map = effectStateReads.get(eff)
	if (!map) {
		map = new WeakMap<object, Set<PropertyKey>>()
		effectStateReads.set(eff, map)
	}
	let set = map.get(target)
	if (!set) {
		set = new Set<PropertyKey>()
		map.set(target, set)
	}

	if (silent) {
		set.add(prop)
		return
	}

	const isNew = !set.has(prop)
	set.add(prop)
	if (isNew) {
		callHookSafe(eff.__hooks?.onDependencyAdd, target, prop, eff.effectName)
	}
}

function didEffectReadProp(effect: EffectFunction, target: object, prop: PropertyKey): boolean {
	const map = effectStateReads.get(effect)
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

function addPendingEffect(subscriber: EffectFunction): void {
	if (pendingEffects.has(subscriber)) return
	pendingEffects.add(subscriber)
	if (subscriber.__hooks?.onSchedule) {
		try {
			subscriber.__hooks.onSchedule(subscriber.effectName)
		} catch {}
	}
}

function scheduleSubscriberWithProp(subscriber: EffectFunction, target: object, prop: PropertyKey): void {
	if (pendingEffects.has(subscriber) && !subscriber.__hooks?.onDependencyChange) return
	const set = effectStateReads.get(subscriber)?.get(target)
	if (!set?.has(prop) && !set?.has(OWN_KEYS_SYMBOL)) return
	addPendingEffect(subscriber)
	callHookSafe(subscriber.__hooks?.onDependencyChange, target, prop)
}

function scheduleSubscriber(subscriber: EffectFunction, target: object, prop: PropertyKey | undefined): void {
	if (prop === undefined) {
		addPendingEffect(subscriber)
	} else {
		scheduleSubscriberWithProp(subscriber, target, prop)
	}
}

function scheduleSubscribersForTarget(target: object, prop?: PropertyKey): void {
	const subs = findSubscribers(target)
	if (!subs?.size) return

	for (const subscriber of subs) {
		scheduleSubscriber(subscriber, target, prop)
	}
	if (batchDepth === 0 && !isNotifying) flushEffects()
}

// Flush all pending effects
function runEffectIfActive(effect: EffectFunction): void {
	if (effectDependencies.has(effect)) {
		try {
			effect()
		} catch (err) {
			pendingEffects.clear()
			throw err
		}
	}
}

function runPendingEffectBatch(): void {
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
		while (pendingEffects.size > 0) {
			runPendingEffectBatch()
		}
	} finally {
		isNotifying = false
	}
}

function cleanupEffect(effect: EffectFunction): void {
	pendingEffects.delete(effect)
	const deps = effectDependencies.get(effect)
	if (deps) {
		for (const dep of deps) {
			const depWithSubs = dep as SubscribersObject
			const subs = depWithSubs[SUBSCRIBERS] ?? proxyCacheSubs.get(dep)
			subs?.delete(effect)
		}
		deps.clear()
		effectDependencies.delete(effect)
	}
	effectStateReads.delete(effect)
	effect.__prevDeps = undefined
	effect.__prevReads = undefined
}

function cleanupChildEffect(child: EffectFunction, toCleanup: EffectFunction[]): void {
	cleanupEffect(child)

	const grandchildren = childEffects.get(child)
	if (grandchildren) {
		toCleanup.push(...grandchildren)
		grandchildren.clear()
		childEffects.delete(child)
	}

	parentEffect.delete(child)
	child.__active = false
}

function cleanupEffectCompletely(effect: EffectFunction): void {
	cleanupEffect(effect)

	const toCleanup: EffectFunction[] = []
	const children = childEffects.get(effect)
	if (children) {
		toCleanup.push(...children)
		children.clear()
		childEffects.delete(effect)
	}

	while (toCleanup.length > 0) {
		cleanupChildEffect(toCleanup.pop() as EffectFunction, toCleanup)
	}

	// Clean up parent relationship
	const parent = parentEffect.get(effect)
	if (parent) {
		const pchildren = childEffects.get(parent)
		pchildren?.delete(effect)
	}

	// Final cleanup
	parentEffect.delete(effect)
	effect.__active = false
}

function setContainsAll(superset: Set<PropertyKey>, subset: Set<PropertyKey>): boolean {
	for (const prop of subset) {
		if (!superset.has(prop)) return false
	}
	return true
}

function propsMatch(
	prevReads: WeakMap<object, Set<PropertyKey>>,
	newReads: WeakMap<object, Set<PropertyKey>>,
	target: object
): boolean {
	const prevProps = prevReads.get(target)
	const newProps = newReads.get(target)
	if (!prevProps || !newProps || prevProps.size !== newProps.size) return false
	return setContainsAll(prevProps, newProps)
}

function allDepsPropsMatch(
	prevDeps: Set<object>,
	newDeps: Set<object>,
	prevReads: WeakMap<object, Set<PropertyKey>>,
	newReads: WeakMap<object, Set<PropertyKey>>
): boolean {
	for (const target of newDeps) {
		if (!prevDeps.has(target) || !propsMatch(prevReads, newReads, target)) return false
	}
	return true
}

function depsMatch(
	prevDeps: Set<object>,
	newDeps: Set<object>,
	prevReads: WeakMap<object, Set<PropertyKey>>,
	newReads: WeakMap<object, Set<PropertyKey>>
): boolean {
	if (prevDeps.size !== newDeps.size) return false
	return allDepsPropsMatch(prevDeps, newDeps, prevReads, newReads)
}

// Proxy handler functions
function createDeleteHandler<T>(
	onDelete:
		| HookFunction<
				[
					PropertyKey,
					boolean,
					T,
				]
		  >
		| undefined
): ProxyHandler<ProxyTarget>['deleteProperty'] {
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
		recordEffectRead(currentEffect, rawTarget, prop, false)
	}
}

function getOrCreateMethodCache(rawTarget: ProxyTarget): Record<PropertyKey, CachedMethod> | null {
	const rawTargetWithCache = rawTarget as CachedMethodsObject
	const existing = rawTargetWithCache[CACHED_METHODS]
	if (existing) return existing

	const cache = Object.create(null) as Record<PropertyKey, CachedMethod>
	try {
		Object.defineProperty(rawTarget, CACHED_METHODS, {
			configurable: true,
			enumerable: false,
			value: cache,
			writable: false,
		})
	} catch {
		return null
	}
	return cache
}

function getWrappedArrayMethod(rawTarget: ProxyTarget, prop: PropertyKey, value: unknown): CachedMethod | undefined {
	if (
		!Array.isArray(rawTarget) ||
		typeof prop !== 'string' ||
		!MUTATING_ARRAY_METHODS.has(prop) ||
		typeof value !== 'function'
	)
		return undefined

	if (!Object.isExtensible(rawTarget)) {
		return getCachedMethodFromWeakMap(rawTarget, prop, value as CachedMethod)
	}

	const cache = getOrCreateMethodCache(rawTarget)
	if (!cache) return getCachedMethodFromWeakMap(rawTarget, prop, value as CachedMethod)

	return createCachedArrayMethod(rawTarget, cache, prop, value as CachedMethod)
}

function createCachedArrayMethod(
	rawTarget: ProxyTarget,
	cache: Record<PropertyKey, CachedMethod>,
	prop: PropertyKey,
	value: CachedMethod
): CachedMethod {
	if (!cache[prop]) {
		cache[prop] = (...args: unknown[]): unknown => {
			const result = value.apply(rawTarget, args)
			scheduleSubscribersForTarget(rawTarget)
			return result
		}
	}
	return cache[prop] as CachedMethod
}

function createGetHandler<T>(
	onRead:
		| HookFunction<
				[
					PropertyKey,
					unknown,
					T,
				]
		  >
		| undefined,
	hooks: StateHooks<T> | undefined
): ProxyHandler<ProxyTarget>['get'] {
	return (rawTarget: ProxyTarget, prop: PropertyKey): unknown => {
		if (isInternalSymbol(prop)) return rawTarget[prop]
		trackDependency(rawTarget, prop)
		const value = rawTarget[prop]

		callHookSafe(onRead, prop, value, rawTarget as T)

		const wrapped = getWrappedArrayMethod(rawTarget, prop, value)
		if (wrapped) return wrapped

		return resolveValue(value, hooks as StateHooks<object> | undefined)
	}
}

function createHasHandler<T>(
	onHas:
		| HookFunction<
				[
					PropertyKey,
					boolean,
					T,
				]
		  >
		| undefined
): ProxyHandler<ProxyTarget>['has'] {
	return (rawTarget: ProxyTarget, prop: PropertyKey): boolean => {
		trackDependency(rawTarget, prop)
		const exists = prop in rawTarget
		callHookSafe(onHas, prop, exists, rawTarget as T)
		return exists
	}
}

function createOwnKeysHandler<T>(
	onOwnKeys:
		| HookFunction<
				[
					PropertyKey[],
					T,
				]
		  >
		| undefined
): ProxyHandler<ProxyTarget>['ownKeys'] {
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

	const oldLength = getArrayLengthBeforeMutation(rawTarget, prop)
	rawTarget[prop] = value

	let props = dirtyTargets.get(rawTarget)
	if (!props) {
		props = new Set<PropertyKey>()
		dirtyTargets.set(rawTarget, props)
	}
	props.add(prop)

	if (oldLength !== undefined && (rawTarget as unknown as unknown[]).length !== oldLength) {
		props.add('length')
	}

	return true
}

function checkInfiniteLoop(rawTarget: ProxyTarget, prop: PropertyKey): void {
	if (!currentEffect || !didEffectReadProp(currentEffect, rawTarget, prop)) return
	const parent = parentEffect.get(currentEffect)
	if (parent) return
	const effectName = currentEffect.effectName
	const errorMsg = effectName
		? `Infinite loop detected: effect "${effectName}" cannot update property "${String(prop)}" it depends on`
		: 'Infinite loop detected: effect cannot update a state it depends on'
	throw new Error(errorMsg)
}

function createSetHandler<T>(
	onWrite:
		| HookFunction<
				[
					PropertyKey,
					unknown,
					unknown,
					T,
				]
		  >
		| undefined
): ProxyHandler<ProxyTarget>['set'] {
	return (rawTarget: ProxyTarget, prop: PropertyKey, value: unknown): boolean => {
		if (batchDepth > 0 && !onWrite && !currentEffect) {
			return handleBatchFastPath(rawTarget, prop, value)
		}
		return performWrite(rawTarget, prop, value, onWrite)
	}
}

function performWrite<T>(
	rawTarget: ProxyTarget,
	prop: PropertyKey,
	value: unknown,
	onWrite:
		| HookFunction<
				[
					PropertyKey,
					unknown,
					unknown,
					T,
				]
		  >
		| undefined
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

export function state<T extends object>(initial: T, hooks?: StateHooks<T>): T {
	if (initial === null || initial === undefined || typeof initial !== 'object') return initial

	const initialWithProxy = initial as ProxyObject
	const existingProxy = initialWithProxy?.[PROXY]
	if (existingProxy) return existingProxy as T

	const target = initial as ProxyTarget
	const cached = proxyCache.get(target)
	if (cached) return cached as T

	const onDelete = composeHook(hooks?.onDelete)
	const onHas = composeHook(hooks?.onHas)
	const onOwnKeys = composeHook(hooks?.onOwnKeys)
	const onRead = composeHook(hooks?.onRead)
	const onWrite = composeHook(hooks?.onWrite)

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
	const existing = childEffects.get(eff)
	if (existing?.size && existing.size > 0) {
		for (const c of existing) {
			cleanupEffectCompletely(c)
			existing.delete(c)
		}
	}
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

function areDepsStable(
	newDeps: Set<object> | undefined,
	newReads: WeakMap<object, Set<PropertyKey>> | undefined,
	prevDeps: Set<object> | undefined,
	prevReads: WeakMap<object, Set<PropertyKey>> | undefined
): boolean {
	if (!newDeps || !newReads || !prevDeps || !prevReads) return false
	return depsMatch(prevDeps, newDeps, prevReads, newReads)
}

function tryRestoreStableDeps(
	eff: EffectFunction,
	prevDeps: Set<object> | undefined,
	prevReads: WeakMap<object, Set<PropertyKey>> | undefined,
	newDeps: Set<object> | undefined,
	newReads: WeakMap<object, Set<PropertyKey>> | undefined
): boolean {
	if (!prevDeps || !prevReads || !areDepsStable(newDeps, newReads, prevDeps, prevReads)) return false
	effectStateReads.set(eff, prevReads)
	effectDependencies.set(eff, prevDeps)
	return true
}

function updateEffectSubscriptions(
	eff: EffectFunction,
	prevDeps: Set<object> | undefined,
	prevReads: WeakMap<object, Set<PropertyKey>> | undefined
): void {
	const newDeps = effectDependencies.get(eff)
	const newReads = effectStateReads.get(eff)

	if (tryRestoreStableDeps(eff, prevDeps, prevReads, newDeps, newReads)) return

	if (!newDeps || !newReads) return

	if (prevDeps) {
		removeStaleSubscribers(eff, prevDeps, newDeps)
		registerNewSubscribers(eff, prevDeps, newDeps)
	}
	eff.__prevDeps = newDeps
	eff.__prevReads = newReads
}

function removeEffectFromSubscribers(eff: EffectFunction, deps: Set<object> | undefined): void {
	if (!deps) return
	for (const dep of deps) {
		findSubscribers(dep)?.delete(eff)
	}
}

function cleanupEffectOnError(eff: EffectFunction): void {
	removeEffectFromSubscribers(eff, eff.__prevDeps)
	removeEffectFromSubscribers(eff, effectDependencies.get(eff))
	effectDependencies.delete(eff)
	effectStateReads.delete(eff)
	pendingEffects.delete(eff)
	eff.__prevDeps = undefined
	eff.__prevReads = undefined
}

function attachEffectHooks(
	eff: EffectFunction,
	onDependencyAdd:
		| HookFunction<
				[
					object,
					PropertyKey,
					string | undefined,
				]
		  >
		| undefined,
	onDependencyChange:
		| HookFunction<
				[
					object,
					PropertyKey,
				]
		  >
		| undefined,
	onSchedule:
		| HookFunction<
				[
					string | undefined,
				]
		  >
		| undefined
): void {
	if (!onDependencyAdd && !onSchedule && !onDependencyChange) return
	eff.__hooks = buildEffectHooksMap(onDependencyAdd, onDependencyChange, onSchedule)
}

function buildEffectHooksMap(
	onDependencyAdd:
		| HookFunction<
				[
					object,
					PropertyKey,
					string | undefined,
				]
		  >
		| undefined,
	onDependencyChange:
		| HookFunction<
				[
					object,
					PropertyKey,
				]
		  >
		| undefined,
	onSchedule:
		| HookFunction<
				[
					string | undefined,
				]
		  >
		| undefined
): NonNullable<EffectFunction['__hooks']> {
	const map: NonNullable<EffectFunction['__hooks']> = Object.create(null)
	if (onDependencyAdd) map.onDependencyAdd = onDependencyAdd
	if (onDependencyChange) map.onDependencyChange = onDependencyChange
	if (onSchedule) map.onSchedule = onSchedule
	return map
}

function executeEffectBody(
	eff: EffectFunction,
	fn: EffectCallback,
	prevDeps: Set<object> | undefined,
	prevReads: WeakMap<object, Set<PropertyKey>> | undefined,
	onRun:
		| HookFunction<
				[
					EffectName | undefined,
				]
		  >
		| undefined,
	name: EffectName | undefined
): void {
	const isFirstRun = !prevDeps
	if (!isFirstRun) isTrackingOnly = true

	pendingEffects.delete(eff)
	disposeChildEffects(eff)

	currentEffect = eff
	effectStateReads.set(eff, new WeakMap<object, Set<PropertyKey>>())
	effectDependencies.set(eff, new Set<object>())

	callHookSafe(onRun, name)

	fn()

	updateEffectSubscriptions(eff, prevDeps, prevReads)
}

function runEffectSafely(
	eff: EffectFunction,
	fn: EffectCallback,
	onRun:
		| HookFunction<
				[
					EffectName | undefined,
				]
		  >
		| undefined,
	onError:
		| HookFunction<
				[
					Error,
					EffectName | undefined,
				]
		  >
		| undefined,
	name: EffectName | undefined
): void {
	const prev = currentEffect
	const prevTrackingOnly = isTrackingOnly
	try {
		executeEffectBody(eff, fn, eff.__prevDeps, eff.__prevReads, onRun, name)
	} catch (err) {
		cleanupEffectOnError(eff)
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
	parentEffect.set(eff, currentEffect)
	let children = childEffects.get(currentEffect)
	if (!children) {
		children = new Set<EffectFunction>()
		childEffects.set(currentEffect, children)
	}
	children.add(eff)
}

export function effect(fn: EffectCallback, name?: EffectName, hooks?: EffectHooks): Unsubscribe {
	const onRun = composeHook(hooks?.onRun)
	const onDispose = composeHook(hooks?.onDispose)
	const onError = composeHook(hooks?.onError)
	const onDependencyAdd = composeHook(hooks?.onDependencyAdd)
	const onDependencyChange = composeHook(
		(
			hooks as
				| (EffectHooks & {
						onDependencyChange?: SingleOrArray<
							HookFunction<
								[
									object,
									PropertyKey,
								]
							>
						>
				  })
				| undefined
		)?.onDependencyChange
	)
	const onSchedule = composeHook(hooks?.onSchedule)

	const runEffect: EffectFunction = () => {
		if (runEffect.__active) return
		runEffect.__active = true
		runEffectSafely(runEffect, fn, onRun, onError, name)
	}

	attachEffectHooks(runEffect, onDependencyAdd, onDependencyChange, onSchedule)
	registerChildEffect(runEffect)

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
		for (const prop of props) {
			scheduleSubscribersForTarget(target, prop)
		}
	}
	dirtyTargets.clear()
}

function clearBatchState(): void {
	pendingEffects.clear()
	deferredEffectCreations.length = 0
	dirtyTargets.clear()
}

function runDeferredEffects(): void {
	if (deferredEffectCreations.length > 0) {
		const effectsToRun = Array.from(deferredEffectCreations)
		deferredEffectCreations.length = 0
		for (const eff of effectsToRun) eff()
	}
}

function flushBatchEffects(): void {
	try {
		runDeferredEffects()
		if (pendingEffects.size > 0) flushEffects()
	} catch (err) {
		clearBatchState()
		throw err
	}
}

function handleBatchError(
	err: unknown,
	onBatchError:
		| HookFunction<
				[
					Error,
					number,
				]
		  >
		| undefined,
	entryDepth: number
): void {
	batchDepth--
	callHookSafe(onBatchError, err as Error, entryDepth)
	if (batchDepth === 0) {
		clearBatchState()
	}
}

export function batch<T>(fn: () => T, hooks?: BatchHooks): T {
	const onBatchStart = composeHook(hooks?.onBatchStart)
	const onBatchEnd = composeHook(hooks?.onBatchEnd)
	const onBatchError = composeHook(hooks?.onBatchError)

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

function runDeriveComputation<T>(
	computeFn: () => T,
	internalState: {
		lastValue: T | undefined | null
	},
	reactiveInternal: {
		value: T | undefined | null
	} | null,
	onCompute:
		| HookFunction<
				[
					T | undefined,
				]
		  >
		| undefined
): void {
	callHookSafe(onCompute, internalState.lastValue as T | undefined)
	const newValue = computeFn()
	if (!Object.is(newValue, internalState.lastValue)) {
		internalState.lastValue = newValue
		if (reactiveInternal) {
			reactiveInternal.value = newValue
		}
	}
}

function resolveDeriveValue<T>(
	target: {
		value: T | undefined | null
	},
	reactiveInternal: {
		value: T | undefined | null
	} | null
): T | undefined | null {
	return reactiveInternal && currentEffect ? reactiveInternal.value : target.value
}

function toggleDeriveReactivity(
	value: boolean,
	wasReactive: boolean,
	hasDispose: boolean,
	createEffect: () => void,
	disposeEffect: () => void
): void {
	if (value && !wasReactive && !hasDispose) {
		createEffect()
	} else if (!value && wasReactive && hasDispose) {
		disposeEffect()
	}
}

function runDeriveWithErrorHandling<T>(
	computeFn: () => T,
	internalState: {
		lastValue: T | undefined | null
	},
	reactiveInternal: {
		value: T | undefined | null
	} | null,
	onCompute:
		| HookFunction<
				[
					T | undefined,
				]
		  >
		| undefined,
	onError:
		| HookFunction<
				[
					Error,
				]
		  >
		| undefined,
	cleanup: () => void
): void {
	try {
		runDeriveComputation(computeFn, internalState, reactiveInternal, onCompute)
	} catch (err) {
		callHookSafe(onError, err as Error)
		throw err
	} finally {
		cleanup()
	}
}

export function derive<T>(computeFn: () => T, hooks?: DeriveHooks<T>): ComputedValue<T> {
	const onCompute = composeHook(hooks?.onCompute)
	const onCacheHit = composeHook(hooks?.onCacheHit)
	const onDeriveDispose = composeHook(hooks?.onDispose)
	const onError = composeHook(hooks?.onError)
	const onDependencyChange = composeHook(hooks?.onDependencyChange)

	const internalState = {
		lastValue: undefined as T | undefined | null,
		reactive: true,
		value: undefined as T | undefined | null,
	}

	let dispose: Unsubscribe | null = null
	let isComputing = false
	let reactiveInternal: typeof internalState | null = null

	const createEffect = (): void => {
		if (dispose) return

		reactiveInternal = state(internalState)

		const internalEffectHooks: EffectHooks | undefined = onDependencyChange
			? ({
					onDependencyChange,
				} as EffectHooks)
			: undefined

		dispose = effect(
			(): void => {
				if (!internalState.reactive || isComputing) return

				isComputing = true
				runDeriveWithErrorHandling(computeFn, internalState, reactiveInternal, onCompute, onError, () => {
					isComputing = false
				})
			},
			undefined,
			internalEffectHooks
		)
	}

	const disposeEffect = (): void => {
		if (dispose) {
			callHookSafe(onDeriveDispose)
			dispose()
			dispose = null
			reactiveInternal = null
		}
	}

	if (internalState.reactive) {
		createEffect()
	}

	return new Proxy(internalState, {
		get(target: typeof internalState, prop: PropertyKey): unknown {
			if (prop === 'value') {
				const value = resolveDeriveValue(target, reactiveInternal)
				callHookSafe(onCacheHit, value as T, !isComputing)
				return value
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
				toggleDeriveReactivity(value as boolean, wasReactive, !!dispose, createEffect, disposeEffect)
				return true
			}
			return false
		},
	}) as ComputedValue<T>
}
