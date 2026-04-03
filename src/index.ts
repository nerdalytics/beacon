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

/**
 * Creates a reactive state container with the provided initial value.
 */
const createState = <T>(initialValue: T, equalityFn: (a: T, b: T) => boolean = Object.is): State<T> => {
	let value = initialValue
	const subscribers = new Set<Subscriber>()
	const stateId = Symbol()

	const get = (): T => {
		const currentEffect = currentSubscriber
		if (currentEffect) {
			subscribers.add(currentEffect)

			let dependencies = subscriberDependencies.get(currentEffect)
			if (!dependencies) {
				dependencies = new Set()
				subscriberDependencies.set(currentEffect, dependencies)
			}
			dependencies.add(subscribers)

			let readStates = stateTracking.get(currentEffect)
			if (!readStates) {
				readStates = new Set()
				stateTracking.set(currentEffect, readStates)
			}
			readStates.add(stateId)
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

/**
 * Registers a function to run whenever its reactive dependencies change.
 */
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
			stateTracking.set(runEffect, new Set())

			if (parentEffect) {
				parentSubscriber.set(runEffect, parentEffect)
				let children = childSubscribers.get(parentEffect)
				if (!children) {
					children = new Set()
					childSubscribers.set(parentEffect, children)
				}
				children.add(runEffect)
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
			let children = childSubscribers.get(parent)
			if (!children) {
				children = new Set()
				childSubscribers.set(parent, children)
			}
			children.add(runEffect)
		}

		deferredEffectCreations.push(runEffect)
	}

	return (): void => {
		cleanupEffect(runEffect)
		activeSubscribers.delete(runEffect)
		stateTracking.delete(runEffect)

		const parent = parentSubscriber.get(runEffect)
		if (parent) {
			const siblings = childSubscribers.get(parent)
			if (siblings) {
				siblings.delete(runEffect)
			}
		}
		parentSubscriber.delete(runEffect)

		const children = childSubscribers.get(runEffect)
		if (children) {
			for (const child of children) {
				cleanupEffect(child)
			}
			children.clear()
			childSubscribers.delete(runEffect)
		}
	}
}

/**
 * Groups multiple state updates to trigger effects only once at the end.
 */
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

/**
 * Creates a read-only computed value that updates when its dependencies change.
 */
const createDerive = <T>(computeFn: () => T): ReadOnlyState<T> => {
	const container = {
		cachedValue: undefined as unknown as T,
		computeFn,
		initialized: false,
		valueState: createState<T | undefined>(undefined),
	}

	createEffect(function deriveEffect(): void {
		const newValue = container.computeFn()

		if (!(container.initialized && Object.is(container.cachedValue, newValue))) {
			container.cachedValue = newValue
			container.valueState.set(newValue)
		}

		container.initialized = true
	})

	return function deriveGetter(): T {
		if (!container.initialized) {
			container.cachedValue = container.computeFn()
			container.initialized = true
			container.valueState.set(container.cachedValue)
		}
		return container.valueState() as T
	}
}

/**
 * Creates an efficient subscription to a subset of a state value.
 */
const createSelect = <T, R>(
	source: ReadOnlyState<T>,
	selectorFn: (state: T) => R,
	equalityFn: (a: R, b: R) => boolean = Object.is
): ReadOnlyState<R> => {
	const container = {
		equalityFn,
		initialized: false,
		lastSelectedValue: undefined as R | undefined,
		lastSourceValue: undefined as T | undefined,
		selectorFn,
		source,
		valueState: createState<R | undefined>(undefined),
	}

	createEffect(function selectEffect(): void {
		const sourceValue = container.source()

		if (container.initialized && Object.is(container.lastSourceValue, sourceValue)) {
			return
		}

		container.lastSourceValue = sourceValue
		const newSelectedValue = container.selectorFn(sourceValue)

		if (
			container.initialized &&
			container.lastSelectedValue !== undefined &&
			container.equalityFn(container.lastSelectedValue, newSelectedValue)
		) {
			return
		}

		container.lastSelectedValue = newSelectedValue
		container.valueState.set(newSelectedValue)
		container.initialized = true
	})

	return function selectGetter(): R {
		if (!container.initialized) {
			container.lastSourceValue = container.source()
			container.lastSelectedValue = container.selectorFn(container.lastSourceValue)
			container.valueState.set(container.lastSelectedValue)
			container.initialized = true
		}
		return container.valueState() as R
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

// Helper for handling array path updates
const updateArrayPath = <V>(array: unknown[], pathSegments: (string | number)[], value: V): unknown[] => {
	const index = Number(pathSegments[0])

	if (pathSegments.length === 1) {
		return updateArrayItem(array, index, value)
	}

	const copy = [
		...array,
	]
	const nextPathSegments = pathSegments.slice(1)
	const nextKey = nextPathSegments[0]

	let nextValue = array[index]
	if (nextValue === undefined || nextValue === null) {
		nextValue = nextKey === undefined ? {} : createContainer(nextKey)
	}

	copy[index] = setValueAtPath(nextValue, nextPathSegments, value)
	return copy
}

// Helper for handling object path updates
const updateObjectPath = <V>(
	obj: Record<string | number, unknown>,
	pathSegments: (string | number)[],
	value: V
): Record<string | number, unknown> => {
	const currentKey = pathSegments[0]
	if (currentKey === undefined) {
		return obj
	}

	if (pathSegments.length === 1) {
		return updateShallowProperty(obj, currentKey, value)
	}

	const nextPathSegments = pathSegments.slice(1)
	const nextKey = nextPathSegments[0]

	let currentValue = obj[currentKey]
	if (currentValue === undefined || currentValue === null) {
		currentValue = nextKey === undefined ? {} : createContainer(nextKey)
	}

	const result = {
		...obj,
	}
	result[currentKey] = setValueAtPath(currentValue, nextPathSegments, value)
	return result
}

const setValueAtPath = <V, O>(obj: O, pathSegments: (string | number)[], value: V): O => {
	if (pathSegments.length === 0) {
		return value as unknown as O
	}

	if (obj === undefined || obj === null) {
		return setValueAtPath({} as O, pathSegments, value)
	}

	const currentKey = pathSegments[0]
	if (currentKey === undefined) {
		return obj
	}

	if (Array.isArray(obj)) {
		return updateArrayPath(obj, pathSegments, value) as unknown as O
	}

	return updateObjectPath(obj as Record<string | number, unknown>, pathSegments, value) as unknown as O
}

/**
 * Creates a lens for direct updates to nested properties of a state.
 */
const createLens = <T, K>(source: State<T>, accessor: (state: T) => K): State<K> => {
	const container = {
		accessor,
		isUpdating: false,
		lensState: null as unknown as State<K>,
		originalSet: null as unknown as (value: K) => void,
		path: [] as (string | number)[],
		source,
	}

	const extractPath = (): (string | number)[] => {
		const pathCollector: (string | number)[] = []
		const proxy = new Proxy(
			{},
			{
				get: (_: object, prop: string | symbol): unknown => {
					if (typeof prop === 'string' || typeof prop === 'number') {
						pathCollector.push(prop)
					}
					return proxy
				},
			}
		)

		try {
			container.accessor(proxy as unknown as T)
		} catch {
			// Ignore errors, we're just collecting the path
		}

		return pathCollector
	}

	container.path = extractPath()

	container.lensState = createState<K>(container.accessor(container.source()))
	container.originalSet = container.lensState.set

	createEffect(function lensEffect(): void {
		if (container.isUpdating) {
			return
		}

		container.isUpdating = true
		try {
			container.lensState.set(container.accessor(container.source()))
		} finally {
			container.isUpdating = false
		}
	})

	container.lensState.set = function lensSet(value: K): void {
		if (container.isUpdating) {
			return
		}

		container.isUpdating = true
		try {
			container.originalSet(value)

			container.source.update((current: T): T => setValueAtPath(current, container.path, value))
		} finally {
			container.isUpdating = false
		}
	}

	container.lensState.update = function lensUpdate(fn: (value: K) => K): void {
		container.lensState.set(fn(container.lensState()))
	}

	return container.lensState
}

/**
 * Creates a read-only view of a state, hiding mutation methods.
 */
const createReadonlyState =
	<T>(source: State<T>): ReadOnlyState<T> =>
	(): T =>
		source()

/**
 * Creates a state with access control, returning a tuple of reader and writer.
 */
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
