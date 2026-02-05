// Beacon - reactive state management system
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
const pendingEffects: Set<EffectFunction> = new Set<EffectFunction>()
const activeEffects: Set<EffectFunction> = new Set<EffectFunction>()
const deferredEffectCreations: EffectFunction[] = []

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
	__hooks?: {
		onDependencyAdd?: HookFunction<[object, PropertyKey, string | undefined]>
		onDependencyChange?: HookFunction<[object, PropertyKey]>
		onSchedule?: HookFunction<[string | undefined]>
	}
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

type HooksObject = ProxyTarget & {
	[HOOKS]?: StateHooks
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

function getSubscribers(target: object): Set<EffectFunction> {
	const cached = subscriberCache.get(target)
	if (cached) return cached

	// Check if target has SUBSCRIBERS property
	const targetWithSubs = target as SubscribersObject
	if (targetWithSubs[SUBSCRIBERS] instanceof Set) {
		const s = targetWithSubs[SUBSCRIBERS]
		subscriberCache.set(target, s)
		return s
	}

	// Check fallback
	const fb = proxyCacheSubs.get(target)
	if (fb) {
		subscriberCache.set(target, fb)
		return fb
	}

	// Create new subscriber set
	const s = new Set<EffectFunction>()
	try {
		if (Object.isExtensible(target)) {
			Object.defineProperty(target, SUBSCRIBERS, {
				configurable: true,
				enumerable: false,
				value: s,
				writable: false,
			})
		} else {
			proxyCacheSubs.set(target, s)
		}
	} catch {
		// Failed to define property, fallback to WeakMap storage
		proxyCacheSubs.set(target, s)
	}
	subscriberCache.set(target, s)
	return s
}

function registerEffectRead(effect: EffectFunction, target: object, prop: PropertyKey): void {
	let deps = effectDependencies.get(effect)
	if (!deps) {
		deps = new Set<object>()
		effectDependencies.set(effect, deps)
	}
	deps.add(target)

	let map = effectStateReads.get(effect)
	if (!map) {
		map = new WeakMap<object, Set<PropertyKey>>()
		effectStateReads.set(effect, map)
	}
	let set = map.get(target)
	if (!set) {
		set = new Set<PropertyKey>()
		map.set(target, set)
	}
	const isNew = !set.has(prop)
	set.add(prop)

	if (isNew && effect.__hooks?.onDependencyAdd) {
		try { effect.__hooks.onDependencyAdd(target, prop, effect.effectName) } catch {}
	}
}

function didEffectReadProp(effect: EffectFunction, target: object, prop: PropertyKey): boolean {
	const map = effectStateReads.get(effect)
	if (!map) return false
	const set = map.get(target)
	return set?.has(prop) ?? false
}

function tryUnwrap(value: unknown): unknown {
	if (!value || typeof value !== 'object') return value
	try {
		const rv = value as ProxyObject
		if (rv?.[PROXY]) return value
	} catch {
		// Failed to access PROXY property, likely due to access restrictions
	}
	return value
}

function composeHookInline<Args extends unknown[]>(
	hook: SingleOrArray<HookFunction<Args>> | undefined,
): HookFunction<Args> | undefined {
	if (hook == null) return undefined
	if (typeof hook === 'function') return hook
	if (hook.length === 0) return undefined
	if (hook.length === 1) return hook[0]
	const fns = hook
	return (...args: Args): void => {
		for (let i = 0; i < fns.length; i++) {
			try {
				fns[i]!(...args)
			} catch {
				// Error isolated: hook errors must not break core
			}
		}
	}
}

function scheduleSubscribersForTarget(target: object, prop?: PropertyKey): void {
	const subs = getSubscribers(target)

	if (subs?.size === 0 || !subs) return

	for (const s of subs) {
		if (prop === undefined) {
			if (!pendingEffects.has(s)) {
				pendingEffects.add(s)
				if (s.__hooks?.onSchedule) {
					try { s.__hooks.onSchedule(s.effectName) } catch {}
				}
			}
		} else {
			const map = effectStateReads.get(s)
			if (map) {
				const set = map.get(target)
				if (set?.has(prop) || set?.has(OWN_KEYS_SYMBOL)) {
					if (!pendingEffects.has(s)) {
						pendingEffects.add(s)
						if (s.__hooks?.onSchedule) {
							try { s.__hooks.onSchedule(s.effectName) } catch {}
						}
					}
					if (s.__hooks?.onDependencyChange && prop !== undefined) {
						try { s.__hooks.onDependencyChange(target, prop) } catch {}
					}
				}
			}
		}
	}
	if (batchDepth === 0 && !isNotifying) flushEffects()
}

// Flush all pending effects
function flushEffects(): void {
	// Early return if no pending effects
	if (pendingEffects.size === 0) return
	if (isNotifying) return
	isNotifying = true

	try {
		while (pendingEffects.size > 0) {
			// Copy effects to array to avoid mutation during iteration
			const effects: EffectFunction[] = []
			for (const e of pendingEffects) effects.push(e)
			pendingEffects.clear()

			// Run each effect
			for (let i = 0; i < effects.length; i++) {
				const effect = effects[i]
				// Only run if effect still has dependencies (hasn't been cleaned up)
				if (effect && effectDependencies.has(effect)) {
					try {
						effect()
					} catch (err) {
						pendingEffects.clear()
						throw err
					}
				}
			}
		}
	} finally {
		isNotifying = false
	}
}

function cleanupEffect(effect: EffectFunction): void {
	pendingEffects.delete(effect)
	const deps = effectDependencies.get(effect)
	if (deps) {
		for (const d of deps) {
			const dWithSubs = d as SubscribersObject
			const subs = dWithSubs[SUBSCRIBERS] ?? proxyCacheSubs.get(d)
			subs?.delete(effect)
		}
		deps.clear()
		effectDependencies.delete(effect)
	}
	effectStateReads.delete(effect)
}

function cleanupEffectCompletely(effect: EffectFunction): void {
	cleanupEffect(effect)

	// Collect all child effects to cleanup
	const toCleanup: EffectFunction[] = []
	const children = childEffects.get(effect)
	if (children) {
		toCleanup.push(...children)
		children.clear()
		childEffects.delete(effect)
	}

	// Clean up all descendants
	while (toCleanup.length > 0) {
		const child = toCleanup.pop()
		if (!child) continue

		// Clean up the child
		cleanupEffect(child)

		// Add grandchildren to cleanup list
		const grandchildren = childEffects.get(child)
		if (grandchildren) {
			toCleanup.push(...grandchildren)
			grandchildren.clear()
			childEffects.delete(child)
		}

		// Remove parent-child relationships
		parentEffect.delete(child)
		activeEffects.delete(child)
	}

	// Clean up parent relationship
	const parent = parentEffect.get(effect)
	if (parent) {
		const pchildren = childEffects.get(parent)
		pchildren?.delete(effect)
	}

	// Final cleanup
	parentEffect.delete(effect)
	activeEffects.delete(effect)
}

// Proxy handler functions
function createDeleteHandler<T>(
	onDelete: HookFunction<[PropertyKey, boolean, T]> | undefined,
): ProxyHandler<ProxyTarget>['deleteProperty'] {
	return (rawTarget: ProxyTarget, prop: PropertyKey): boolean => {
		const had = Object.hasOwn(rawTarget, prop)
		const ok = delete rawTarget[prop]
		if (onDelete) {
			try { onDelete(prop, had, rawTarget as T) } catch {}
		}
		if (had && ok) scheduleSubscribersForTarget(rawTarget, prop)
		return ok
	}
}

function createGetHandler<T>(
	onRead: HookFunction<[PropertyKey, unknown, T]> | undefined,
	hooks: StateHooks<T> | undefined,
): ProxyHandler<ProxyTarget>['get'] {
	return (rawTarget: ProxyTarget, prop: PropertyKey): unknown => {
		if (prop === SUBSCRIBERS || prop === PROXY || prop === HOOKS) return rawTarget[prop]
		if (currentEffect) {
			const subs = getSubscribers(rawTarget)
			subs.add(currentEffect)
			registerEffectRead(currentEffect, rawTarget, prop)
		}
		const value = rawTarget[prop]

		if (onRead) {
			try { onRead(prop, value, rawTarget as T) } catch {}
		}

		// Handle array mutating methods
		if (Array.isArray(rawTarget) && typeof prop === 'string' && MUTATING_ARRAY_METHODS.has(prop)) {
			if (typeof value === 'function') {
				// For extensible objects, use property cache
				if (Object.isExtensible(rawTarget)) {
					const rawTargetWithCache = rawTarget as CachedMethodsObject
					let cache = rawTargetWithCache[CACHED_METHODS]
					if (!cache) {
						cache = Object.create(null) as Record<PropertyKey, CachedMethod>
						try {
							Object.defineProperty(rawTarget, CACHED_METHODS, {
								configurable: true,
								enumerable: false,
								value: cache,
								writable: false,
							})
						} catch {
							// Failed to define CACHED_METHODS property, fallback to WeakMap
							return getCachedMethodFromWeakMap(rawTarget, prop, value as CachedMethod)
						}
					}
					// Return cached or create new wrapped method
					if (!cache[prop]) {
						cache[prop] = (...args: unknown[]): unknown => {
							const result = (value as CachedMethod).apply(rawTarget, args)
							scheduleSubscribersForTarget(rawTarget)
							return result
						}
					}
					return cache[prop]
				} else {
					// For frozen objects, use WeakMap
					return getCachedMethodFromWeakMap(rawTarget, prop, value as CachedMethod)
				}
			}
		}

		if (value === null || typeof value !== 'object') return value
		const c = proxyCache.get(value as object)
		return c ?? state(value as object, hooks as StateHooks<object> | undefined)
	}
}

function createHasHandler<T>(
	onHas: HookFunction<[PropertyKey, boolean, T]> | undefined,
): ProxyHandler<ProxyTarget>['has'] {
	return (rawTarget: ProxyTarget, prop: PropertyKey): boolean => {
		if (currentEffect) {
			const subs = getSubscribers(rawTarget)
			subs.add(currentEffect)
			registerEffectRead(currentEffect, rawTarget, prop)
		}
		const exists = prop in rawTarget
		if (onHas) {
			try { onHas(prop, exists, rawTarget as T) } catch {}
		}
		return exists
	}
}

function createOwnKeysHandler<T>(
	onOwnKeys: HookFunction<[PropertyKey[], T]> | undefined,
): ProxyHandler<ProxyTarget>['ownKeys'] {
	return (rawTarget: ProxyTarget): (string | symbol)[] => {
		if (currentEffect) {
			const subs = getSubscribers(rawTarget)
			subs.add(currentEffect)
			registerEffectRead(currentEffect, rawTarget, OWN_KEYS_SYMBOL)
		}
		const keys = Reflect.ownKeys(rawTarget) as (string | symbol)[]
		if (onOwnKeys) {
			try { onOwnKeys(keys, rawTarget as T) } catch {}
		}
		return keys
	}
}

function createSetHandler<T>(
	onWrite: HookFunction<[PropertyKey, unknown, unknown, T]> | undefined,
): ProxyHandler<ProxyTarget>['set'] {
	return (rawTarget: ProxyTarget, prop: PropertyKey, value: unknown): boolean => {
		if (currentEffect && didEffectReadProp(currentEffect, rawTarget, prop)) {
			const parent = parentEffect.get(currentEffect)
			if (!parent) {
				const effectName = currentEffect.effectName
				const errorMsg = effectName
					? `Infinite loop detected: effect "${effectName}" cannot update property "${String(prop)}" it depends on`
					: 'Infinite loop detected: effect cannot update a state it depends on'
				throw new Error(errorMsg)
			}
		}
		const oldValue = rawTarget[prop]
		if (Object.is(oldValue, value)) return true
		const rawValue = value !== null && typeof value === 'object' ? tryUnwrap(value) : value

		// Track array length changes
		let oldLength: number | undefined
		if (Array.isArray(rawTarget) && typeof prop === 'string') {
			const index = Number(prop)
			if (!Number.isNaN(index) && index >= 0 && 'length' in rawTarget) {
				oldLength = rawTarget.length
			}
		}

		rawTarget[prop] = rawValue

		if (onWrite) {
			try { onWrite(prop, oldValue, value, rawTarget as T) } catch {}
		}

		scheduleSubscribersForTarget(rawTarget, prop)

		// If array length changed, notify length subscribers
		if (oldLength !== undefined && 'length' in rawTarget && (rawTarget as unknown as unknown[]).length !== oldLength) {
			scheduleSubscribersForTarget(rawTarget, 'length')
		}

		return true
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

	const onDelete = composeHookInline(hooks?.onDelete)
	const onHas = composeHookInline(hooks?.onHas)
	const onOwnKeys = composeHookInline(hooks?.onOwnKeys)
	const onRead = composeHookInline(hooks?.onRead)
	const onWrite = composeHookInline(hooks?.onWrite)

	const handler: ProxyHandler<ProxyTarget> = {
		deleteProperty: createDeleteHandler(onDelete),
		get: createGetHandler(onRead, hooks),
		has: createHasHandler(onHas),
		ownKeys: createOwnKeysHandler(onOwnKeys),
		set: createSetHandler(onWrite),
	} as ProxyHandler<ProxyTarget>

	const proxy = new Proxy(target, handler) as T
	proxyCache.set(target, proxy)
	try {
		if (Object.isExtensible(target)) {
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
		} else if (hooks) {
			frozenHooksCache.set(target, hooks as StateHooks)
		}
	} catch {
		if (hooks) {
			frozenHooksCache.set(target, hooks as StateHooks)
		}
	}
	return proxy
}

export function effect(fn: EffectCallback, name?: EffectName, hooks?: EffectHooks): Unsubscribe {
	const onRun = composeHookInline(hooks?.onRun)
	const onDispose = composeHookInline(hooks?.onDispose)
	const onError = composeHookInline(hooks?.onError)
	const onDependencyAdd = composeHookInline(hooks?.onDependencyAdd)
	const onDependencyChange = composeHookInline(
		(hooks as EffectHooks & { onDependencyChange?: SingleOrArray<HookFunction<[object, PropertyKey]>> } | undefined)
			?.onDependencyChange,
	)
	const onSchedule = composeHookInline(hooks?.onSchedule)

	const runEffect: EffectFunction = () => {
		if (activeEffects.has(runEffect)) return
		activeEffects.add(runEffect)
		const prev = currentEffect
		try {
			cleanupEffect(runEffect)
			const existing = childEffects.get(runEffect)
			if (existing?.size && existing.size > 0) {
				for (const c of existing) {
					cleanupEffectCompletely(c)
					existing.delete(c)
				}
			}
			currentEffect = runEffect
			effectStateReads.set(runEffect, new WeakMap())

			if (onRun) {
				try { onRun(name) } catch {}
			}

			fn()
		} catch (err) {
			if (onError) {
				try { onError(err as Error, name) } catch {}
			}
			throw err
		} finally {
			currentEffect = prev
			activeEffects.delete(runEffect)
		}
	}

	if (onDependencyAdd || onSchedule || onDependencyChange) {
		runEffect.__hooks = {
			...(onDependencyAdd ? { onDependencyAdd } : {}),
			...(onDependencyChange ? { onDependencyChange } : {}),
			...(onSchedule ? { onSchedule } : {}),
		}
	}

	if (currentEffect) {
		parentEffect.set(runEffect, currentEffect)
		let cs = childEffects.get(currentEffect)
		if (!cs) {
			cs = new Set<EffectFunction>()
			childEffects.set(currentEffect, cs)
		}
		cs.add(runEffect)
	}

	if (name) {
		runEffect.effectName = name
	}

	if (batchDepth === 0) runEffect()
	else deferredEffectCreations.push(runEffect)

	return (): void => {
		if (onDispose) {
			try { onDispose(name) } catch {}
		}
		cleanupEffectCompletely(runEffect)
	}
}

export function batch<T>(fn: () => T, hooks?: BatchHooks): T {
	const onBatchStart = composeHookInline(hooks?.onBatchStart)
	const onBatchEnd = composeHookInline(hooks?.onBatchEnd)
	const onBatchError = composeHookInline(hooks?.onBatchError)

	batchDepth++
	const entryDepth = batchDepth

	if (onBatchStart) {
		try { onBatchStart(entryDepth) } catch {}
	}

	let result: T
	try {
		result = fn()
	} catch (err) {
		batchDepth--
		if (onBatchError) {
			try { onBatchError(err as Error, entryDepth) } catch {}
		}
		if (batchDepth === 0) {
			pendingEffects.clear()
			deferredEffectCreations.length = 0
		}
		throw err
	}
	batchDepth--
	if (batchDepth === 0) {
		try {
			if (deferredEffectCreations.length > 0) {
				const effectsToRun = Array.from(deferredEffectCreations)
				deferredEffectCreations.length = 0
				for (const e of effectsToRun) e()
			}
			if (pendingEffects.size > 0) flushEffects()
		} catch (err) {
			pendingEffects.clear()
			deferredEffectCreations.length = 0
			throw err
		}
	}

	if (onBatchEnd) {
		try { onBatchEnd(entryDepth) } catch {}
	}

	return result
}

export function derive<T>(computeFn: () => T): ComputedValue<T> {
	// Internal state to hold the derived value
	const internalState = {
		lastValue: undefined as T | undefined | null,
		reactive: true,
		value: undefined as T | undefined | null,
	}

	let dispose: Unsubscribe | null = null
	let isComputing = false
	let reactiveInternal: typeof internalState | null = null

	// Function to create the effect
	const createEffect = (): void => {
		if (dispose) return // Already have an effect

		// Wrap the internal state in a reactive proxy for the effect to track
		reactiveInternal = state(internalState)

		dispose = effect((): void => {
			// Only recompute if reactive is true
			if (!internalState.reactive) return

			// Prevent infinite loops during computation
			if (isComputing) return

			isComputing = true
			try {
				const newValue = computeFn()

				// Only update if value actually changed
				if (!Object.is(newValue, internalState.lastValue)) {
					internalState.lastValue = newValue
					if (reactiveInternal) {
						reactiveInternal.value = newValue
					}
				}
			} finally {
				isComputing = false
			}
		})
	}

	// Function to dispose the effect
	const disposeEffect = (): void => {
		if (dispose) {
			dispose()
			dispose = null
			reactiveInternal = null
		}
	}

	// Create initial effect if reactive is true
	if (internalState.reactive) {
		createEffect()
	}

	// Return a proxy that controls the effect lifecycle
	return new Proxy(internalState, {
		get(target: typeof internalState, prop: PropertyKey): unknown {
			if (prop === 'value') {
				// Read through the reactive state if we have an effect
				if (reactiveInternal && currentEffect) {
					// Track this read in the current effect
					return reactiveInternal.value
				}
				return target.value
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

				// Handle effect lifecycle based on reactive change
				if (value && !wasReactive && !dispose) {
					createEffect()
				} else if (!value && wasReactive && dispose) {
					disposeEffect()
				}
				return true
			}
			// value is read-only
			return false
		},
	}) as ComputedValue<T>
}
