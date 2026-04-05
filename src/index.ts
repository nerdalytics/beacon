// Core types for reactive primitives
type Subscriber = () => void
type Unsubscribe = () => void
type ReadOnlyState<T> = () => T
interface WriteableState<T> {
	set(value: T): void
	update(fn: (value: T) => T): void
}

// Special symbol used for internal tracking
const STATE_ID: unique symbol = Symbol('STATE_ID')

type State<T> = ReadOnlyState<T> &
	WriteableState<T> & {
		[STATE_ID]?: symbol
	}

// Module-level reactive state
let currentSubscriber: Subscriber | null = null
let pendingSubscribers: Set<Subscriber> = new Set<Subscriber>()
let isNotifying = false
let batchDepth = 0
let deferredEffectCreations: Subscriber[] = []
const activeSubscribers: Set<Subscriber> = new Set<Subscriber>()
const stateTracking: WeakMap<Subscriber, Set<symbol>> = new WeakMap<Subscriber, Set<symbol>>()
const subscriberDependencies: WeakMap<Subscriber, Set<Set<Subscriber>>> = new WeakMap<
	Subscriber,
	Set<Set<Subscriber>>
>()
const parentSubscriber: WeakMap<Subscriber, Subscriber> = new WeakMap<Subscriber, Subscriber>()
const childSubscribers: WeakMap<Subscriber, Set<Subscriber>> = new WeakMap<Subscriber, Set<Subscriber>>()
const DANGEROUS_KEYS: ReadonlySet<string> = new Set([
	'__proto__',
	'constructor',
	'prototype',
])

const getOrCreate = <K extends object, V>(map: WeakMap<K, V>, key: K, factory: () => V): V => {
	let value = map.get(key)
	if (!value) {
		value = factory()
		map.set(key, value)
	}
	return value
}

const notifySubscribers = (): void => {
	if (isNotifying) {
		return
	}

	isNotifying = true

	try {
		while (pendingSubscribers.size > 0) {
			const subscribers = pendingSubscribers
			pendingSubscribers = new Set()

			for (const effect of subscribers) {
				effect()
			}
		}
	} finally {
		isNotifying = false
	}
}

const cleanupEffect = (effect: Subscriber): void => {
	pendingSubscribers.delete(effect)

	const deps = subscriberDependencies.get(effect)
	if (deps) {
		for (const subscribers of deps) {
			subscribers.delete(effect)
		}
		deps.clear()
		subscriberDependencies.delete(effect)
	}
}

const disposeEffect = (effect: Subscriber): void => {
	cleanupEffect(effect)
	activeSubscribers.delete(effect)
	stateTracking.delete(effect)

	const parent = parentSubscriber.get(effect)
	if (parent) {
		const siblings = childSubscribers.get(parent)
		if (siblings) {
			siblings.delete(effect)
		}
	}
	parentSubscriber.delete(effect)

	const children = childSubscribers.get(effect)
	if (children) {
		for (const child of children) {
			disposeEffect(child)
		}
		children.clear()
		childSubscribers.delete(effect)
	}
}

const createState = <T>(initialValue: T, equalityFn: (a: T, b: T) => boolean = Object.is): State<T> => {
	let value = initialValue
	const subscribers = new Set<Subscriber>()
	const stateId = Symbol()

	const get = (): T => {
		const currentEffect = currentSubscriber
		if (currentEffect) {
			subscribers.add(currentEffect)

			getOrCreate(subscriberDependencies, currentEffect, () => new Set()).add(subscribers)

			getOrCreate(stateTracking, currentEffect, () => new Set()).add(stateId)
		}
		return value
	}

	get.set = (newValue: T): void => {
		if (equalityFn(value, newValue)) {
			return
		}

		const effect = currentSubscriber
		if (effect) {
			const states = stateTracking.get(effect)
			if (states?.has(stateId) && !parentSubscriber.get(effect)) {
				throw new Error('Infinite loop detected: effect() cannot update a state() it depends on!')
			}
		}

		value = newValue

		if (subscribers.size === 0) {
			return
		}

		for (const sub of subscribers) {
			pendingSubscribers.add(sub)
		}

		if (batchDepth === 0 && !isNotifying) {
			notifySubscribers()
		}
	}

	get.update = (fn: (currentValue: T) => T): void => {
		get.set(fn(value))
	}

	get[STATE_ID] = stateId
	return get as State<T>
}

const createEffect = (fn: () => void): Unsubscribe => {
	const runEffect = (): void => {
		if (activeSubscribers.has(runEffect)) {
			return
		}

		activeSubscribers.add(runEffect)
		const parentEffect = currentSubscriber

		try {
			cleanupEffect(runEffect)

			currentSubscriber = runEffect
			const existingStates = stateTracking.get(runEffect)
			if (existingStates) {
				existingStates.clear()
			} else {
				stateTracking.set(runEffect, new Set())
			}

			if (parentEffect) {
				parentSubscriber.set(runEffect, parentEffect)
				getOrCreate(childSubscribers, parentEffect, () => new Set()).add(runEffect)
			}

			fn()
		} finally {
			currentSubscriber = parentEffect
			activeSubscribers.delete(runEffect)
		}
	}

	if (batchDepth === 0) {
		runEffect()
	} else {
		if (currentSubscriber) {
			const parent = currentSubscriber
			parentSubscriber.set(runEffect, parent)
			getOrCreate(childSubscribers, parent, () => new Set()).add(runEffect)
		}

		deferredEffectCreations.push(runEffect)
	}

	return (): void => {
		disposeEffect(runEffect)
	}
}

const executeBatch = <T>(fn: () => T): T => {
	batchDepth++
	try {
		return fn()
	} catch (error: unknown) {
		if (batchDepth === 1) {
			pendingSubscribers.clear()
			deferredEffectCreations.length = 0
		}
		throw error
	} finally {
		batchDepth--

		if (batchDepth === 0) {
			if (deferredEffectCreations.length > 0) {
				const effectsToRun = deferredEffectCreations
				deferredEffectCreations = []
				for (const effect of effectsToRun) {
					effect()
				}
			}

			if (pendingSubscribers.size > 0 && !isNotifying) {
				notifySubscribers()
			}
		}
	}
}

const createDerive = <T>(computeFn: () => T): ReadOnlyState<T> => {
	let cachedValue: T = undefined as unknown as T
	let initialized = false
	const valueState = createState<T | undefined>(undefined)

	createEffect(function deriveEffect(): void {
		const newValue = computeFn()

		if (!(initialized && Object.is(cachedValue, newValue))) {
			cachedValue = newValue
			valueState.set(newValue)
		}

		initialized = true
	})

	return function deriveGetter(): T {
		if (!initialized) {
			cachedValue = computeFn()
			initialized = true
			valueState.set(cachedValue)
		}
		return valueState() as T
	}
}

const createSelect = <T, R>(
	source: ReadOnlyState<T>,
	selectorFn: (state: T) => R,
	equalityFn: (a: R, b: R) => boolean = Object.is
): ReadOnlyState<R> => {
	let initialized = false
	let lastSelectedValue: R | undefined
	let lastSourceValue: T | undefined
	const valueState = createState<R | undefined>(undefined)

	createEffect(function selectEffect(): void {
		const sourceValue = source()

		if (initialized && Object.is(lastSourceValue, sourceValue)) {
			return
		}

		lastSourceValue = sourceValue
		const newSelectedValue = selectorFn(sourceValue)

		if (initialized && lastSelectedValue !== undefined && equalityFn(lastSelectedValue, newSelectedValue)) {
			return
		}

		lastSelectedValue = newSelectedValue
		valueState.set(newSelectedValue)
		initialized = true
	})

	return function selectGetter(): R {
		if (!initialized) {
			lastSourceValue = source()
			lastSelectedValue = selectorFn(lastSourceValue)
			valueState.set(lastSelectedValue)
			initialized = true
		}
		return valueState() as R
	}
}

// Helper for array updates
const updateArrayItem = <V>(arr: unknown[], index: number, value: V): unknown[] => {
	const copy = [
		...arr,
	]
	copy[index] = value
	return copy
}

// Helper for single-level updates (optimization)
const updateShallowProperty = <V>(
	obj: Record<string | number, unknown>,
	key: string | number,
	value: V
): Record<string | number, unknown> => {
	const result = {
		...obj,
	}
	result[key] = value
	return result
}

// Helper to create the appropriate container type
const createContainer = (key: string | number): Record<string | number, unknown> | unknown[] => {
	const isArrayKey = typeof key === 'number' || !Number.isNaN(Number(key))
	return isArrayKey ? [] : {}
}

const setValueAtPath = <V, O>(obj: O, pathSegments: (string | number)[], depth: number, value: V): O => {
	if (depth >= pathSegments.length) {
		return value as unknown as O
	}

	if (obj === undefined || obj === null) {
		return setValueAtPath({} as O, pathSegments, depth, value)
	}

	const currentKey = pathSegments[depth]
	if (currentKey === undefined) {
		return obj
	}

	if (Array.isArray(obj)) {
		const index = Number(currentKey)

		if (depth === pathSegments.length - 1) {
			return updateArrayItem(obj, index, value) as unknown as O
		}

		const copy = [
			...obj,
		]
		const nextDepth = depth + 1
		const nextKey = pathSegments[nextDepth]

		let nextValue = obj[index]
		if (nextValue === undefined || nextValue === null) {
			nextValue = nextKey === undefined ? {} : createContainer(nextKey)
		}

		copy[index] = setValueAtPath(nextValue, pathSegments, nextDepth, value)
		return copy as unknown as O
	}

	const record = obj as Record<string | number, unknown>

	if (depth === pathSegments.length - 1) {
		return updateShallowProperty(record, currentKey, value) as unknown as O
	}

	const nextDepth = depth + 1
	const nextKey = pathSegments[nextDepth]

	let currentValue = record[currentKey]
	if (currentValue === undefined || currentValue === null) {
		currentValue = nextKey === undefined ? {} : createContainer(nextKey)
	}

	const result = {
		...record,
	}
	result[currentKey] = setValueAtPath(currentValue, pathSegments, nextDepth, value)
	return result as unknown as O
}

const createLens = <T, K>(source: State<T>, accessor: (state: T) => K): State<K> => {
	let isUpdating = false

	const extractPath = (): (string | number)[] => {
		const pathCollector: (string | number)[] = []
		let tainted = false
		const proxy = new Proxy(
			{},
			{
				get: (_: object, prop: string | symbol): unknown => {
					if (!tainted && (typeof prop === 'string' || typeof prop === 'number')) {
						if (DANGEROUS_KEYS.has(String(prop))) {
							tainted = true
						} else {
							pathCollector.push(prop)
						}
					}
					return proxy
				},
			}
		)

		try {
			accessor(proxy as unknown as T)
		} catch {
			// Ignore errors, we're just collecting the path
		}

		return tainted ? [] : pathCollector
	}

	const path = extractPath()
	const lensState = createState<K>(accessor(source()))
	const originalSet = lensState.set

	createEffect(function lensEffect(): void {
		if (isUpdating) {
			return
		}

		isUpdating = true
		try {
			lensState.set(accessor(source()))
		} finally {
			isUpdating = false
		}
	})

	lensState.set = function lensSet(value: K): void {
		if (isUpdating || path.length === 0) {
			return
		}

		isUpdating = true
		try {
			originalSet(value)
			source.update((current: T): T => setValueAtPath(current, path, 0, value))
		} finally {
			isUpdating = false
		}
	}

	lensState.update = function lensUpdate(fn: (value: K) => K): void {
		lensState.set(fn(lensState()))
	}

	return lensState
}

const createReadonlyState =
	<T>(source: State<T>): ReadOnlyState<T> =>
	(): T =>
		source()

const createProtectedState = <T>(
	initialValue: T,
	equalityFn: (a: T, b: T) => boolean = Object.is
): [
	ReadOnlyState<T>,
	WriteableState<T>,
] => {
	const fullState = createState(initialValue, equalityFn)
	const reader = createReadonlyState(fullState)
	return [
		reader,
		{
			set: (value: T): void => fullState.set(value),
			update: (fn: (value: T) => T): void => fullState.update(fn),
		},
	]
}

export type { ReadOnlyState, State, Unsubscribe, WriteableState }
export {
	createDerive as derive,
	createEffect as effect,
	createLens as lens,
	createProtectedState as protectedState,
	createReadonlyState as readonlyState,
	createSelect as select,
	createState as state,
	executeBatch as batch,
}
