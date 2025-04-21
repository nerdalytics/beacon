// Core types for reactive primitives
type Subscriber = () => void
type Unsubscribe = () => void
export type ReadOnlyState<T> = () => T
export interface WriteableState<T> {
	set(value: T): void
	update(fn: (value: T) => T): void
}

// Special symbol used for internal tracking
const STATE_ID = Symbol()

export type State<T> = ReadOnlyState<T> &
	WriteableState<T> & {
		[STATE_ID]?: symbol
	}

/**
 * Creates a reactive state container with the provided initial value.
 */
export const state = <T>(initialValue: T, equalityFn: (a: T, b: T) => boolean = Object.is): State<T> =>
	StateImpl.createState(initialValue, equalityFn)

/**
 * Registers a function to run whenever its reactive dependencies change.
 */
export const effect = (fn: () => void): Unsubscribe => StateImpl.createEffect(fn)

/**
 * Groups multiple state updates to trigger effects only once at the end.
 */
export const batch = <T>(fn: () => T): T => StateImpl.executeBatch(fn)

/**
 * Creates a read-only computed value that updates when its dependencies change.
 */
export const derive = <T>(computeFn: () => T): ReadOnlyState<T> => StateImpl.createDerive(computeFn)

/**
 * Creates an efficient subscription to a subset of a state value.
 */
export const select = <T, R>(
	source: ReadOnlyState<T>,
	selectorFn: (state: T) => R,
	equalityFn: (a: R, b: R) => boolean = Object.is
): ReadOnlyState<R> => StateImpl.createSelect(source, selectorFn, equalityFn)

/**
 * Creates a read-only view of a state, hiding mutation methods.
 */
export const readonlyState =
	<T>(state: State<T>): ReadOnlyState<T> =>
	(): T =>
		state()

/**
 * Creates a state with access control, returning a tuple of reader and writer.
 */
export const protectedState = <T>(
	initialValue: T,
	equalityFn: (a: T, b: T) => boolean = Object.is
): [ReadOnlyState<T>, WriteableState<T>] => {
	const fullState = state(initialValue, equalityFn)
	return [
		(): T => readonlyState(fullState)(),
		{
			set: (value: T): void => fullState.set(value),
			update: (fn: (value: T) => T): void => fullState.update(fn),
		},
	]
}

/**
 * Creates a lens for direct updates to nested properties of a state.
 */
export const lens = <T, K>(source: State<T>, accessor: (state: T) => K): State<K> =>
	StateImpl.createLens(source, accessor)

class StateImpl<T> {
	// Static fields track global reactivity state - this centralized approach allows
	// for coordinated updates while maintaining individual state isolation
	private static currentSubscriber: Subscriber | null = null
	private static pendingSubscribers = new Set<Subscriber>()
	private static isNotifying = false
	private static batchDepth = 0
	private static deferredEffectCreations: Subscriber[] = []
	private static activeSubscribers = new Set<Subscriber>()

	// WeakMaps enable automatic garbage collection when subscribers are no
	// longer referenced, preventing memory leaks in long-running applications
	private static stateTracking = new WeakMap<Subscriber, Set<symbol>>()
	private static subscriberDependencies = new WeakMap<Subscriber, Set<Set<Subscriber>>>()
	private static parentSubscriber = new WeakMap<Subscriber, Subscriber>()
	private static childSubscribers = new WeakMap<Subscriber, Set<Subscriber>>()

	// Instance state - each state has unique subscribers and ID
	private value: T
	private subscribers = new Set<Subscriber>()
	private stateId = Symbol()
	private equalityFn: (a: T, b: T) => boolean

	constructor(initialValue: T, equalityFn: (a: T, b: T) => boolean = Object.is) {
		this.value = initialValue
		this.equalityFn = equalityFn
	}

	/**
	 * Creates a reactive state container with the provided initial value.
	 * Implementation of the public 'state' function.
	 */
	static createState = <T>(initialValue: T, equalityFn: (a: T, b: T) => boolean = Object.is): State<T> => {
		const instance = new StateImpl<T>(initialValue, equalityFn)
		const get = (): T => instance.get()
		get.set = (value: T): void => instance.set(value)
		get.update = (fn: (currentValue: T) => T): void => instance.update(fn)
		get[STATE_ID] = instance.stateId
		return get as State<T>
	}

	// Auto-tracks dependencies when called within effects, creating a fine-grained
	// reactivity graph that only updates affected components
	get = (): T => {
		const currentEffect = StateImpl.currentSubscriber
		if (currentEffect) {
			// Add this effect to subscribers for future notification
			this.subscribers.add(currentEffect)

			// Maintain bidirectional dependency tracking to enable precise cleanup
			// when effects are unsubscribed, preventing memory leaks
			let dependencies = StateImpl.subscriberDependencies.get(currentEffect)
			if (!dependencies) {
				dependencies = new Set()
				StateImpl.subscriberDependencies.set(currentEffect, dependencies)
			}
			dependencies.add(this.subscribers)

			// Track read states to detect direct cyclical dependencies that
			// could cause infinite loops
			let readStates = StateImpl.stateTracking.get(currentEffect)
			if (!readStates) {
				readStates = new Set()
				StateImpl.stateTracking.set(currentEffect, readStates)
			}
			readStates.add(this.stateId)
		}
		return this.value
	}

	// Handles value updates with built-in optimizations and safeguards
	set = (newValue: T): void => {
		// Skip updates for unchanged values to prevent redundant effect executions
		if (this.equalityFn(this.value, newValue)) {
			return
		}

		// Infinite loop detection prevents direct self-mutation within effects,
		// while allowing nested effect patterns that would otherwise appear cyclical
		const effect = StateImpl.currentSubscriber
		if (effect) {
			const states = StateImpl.stateTracking.get(effect)
			if (states?.has(this.stateId) && !StateImpl.parentSubscriber.get(effect)) {
				throw new Error('Infinite loop detected: effect() cannot update a state() it depends on!')
			}
		}

		this.value = newValue

		// Skip updates when there are no subscribers, avoiding unnecessary processing
		if (this.subscribers.size === 0) {
			return
		}

		// Queue notifications instead of executing immediately to support batch operations
		// and prevent redundant effect runs
		for (const sub of this.subscribers) {
			StateImpl.pendingSubscribers.add(sub)
		}

		// Immediate execution outside of batches, deferred execution inside batches
		if (StateImpl.batchDepth === 0 && !StateImpl.isNotifying) {
			StateImpl.notifySubscribers()
		}
	}

	update = (fn: (currentValue: T) => T): void => {
		this.set(fn(this.value))
	}

	/**
	 * Registers a function to run whenever its reactive dependencies change.
	 * Implementation of the public 'effect' function.
	 */
	static createEffect = (fn: () => void): Unsubscribe => {
		const runEffect = (): void => {
			// Prevent re-entrance to avoid cascade updates during effect execution
			if (StateImpl.activeSubscribers.has(runEffect)) {
				return
			}

			StateImpl.activeSubscribers.add(runEffect)
			const parentEffect = StateImpl.currentSubscriber

			try {
				// Clean existing subscriptions before running to ensure only
				// currently accessed states are tracked as dependencies
				StateImpl.cleanupEffect(runEffect)

				// Set current context for automatic dependency tracking
				StateImpl.currentSubscriber = runEffect
				StateImpl.stateTracking.set(runEffect, new Set())

				// Track parent-child relationships to handle nested effects correctly
				// and enable hierarchical cleanup later
				if (parentEffect) {
					StateImpl.parentSubscriber.set(runEffect, parentEffect)
					let children = StateImpl.childSubscribers.get(parentEffect)
					if (!children) {
						children = new Set()
						StateImpl.childSubscribers.set(parentEffect, children)
					}
					children.add(runEffect)
				}

				// Execute the effect function, which will auto-track dependencies
				fn()
			} finally {
				// Restore previous context when done
				StateImpl.currentSubscriber = parentEffect
				StateImpl.activeSubscribers.delete(runEffect)
			}
		}

		// Run immediately unless we're in a batch operation
		if (StateImpl.batchDepth === 0) {
			runEffect()
		} else {
			// Still track parent-child relationship even when deferred,
			// ensuring proper hierarchical cleanup later
			if (StateImpl.currentSubscriber) {
				const parent = StateImpl.currentSubscriber
				StateImpl.parentSubscriber.set(runEffect, parent)
				let children = StateImpl.childSubscribers.get(parent)
				if (!children) {
					children = new Set()
					StateImpl.childSubscribers.set(parent, children)
				}
				children.add(runEffect)
			}

			// Queue for execution when batch completes
			StateImpl.deferredEffectCreations.push(runEffect)
		}

		// Return cleanup function to properly disconnect from reactivity graph
		return (): void => {
			// Remove from dependency tracking to stop future notifications
			StateImpl.cleanupEffect(runEffect)
			StateImpl.pendingSubscribers.delete(runEffect)
			StateImpl.activeSubscribers.delete(runEffect)
			StateImpl.stateTracking.delete(runEffect)

			// Clean up parent-child relationship bidirectionally
			const parent = StateImpl.parentSubscriber.get(runEffect)
			if (parent) {
				const siblings = StateImpl.childSubscribers.get(parent)
				if (siblings) {
					siblings.delete(runEffect)
				}
			}
			StateImpl.parentSubscriber.delete(runEffect)

			// Recursively clean up child effects to prevent memory leaks in
			// nested effect scenarios
			const children = StateImpl.childSubscribers.get(runEffect)
			if (children) {
				for (const child of children) {
					StateImpl.cleanupEffect(child)
				}
				children.clear()
				StateImpl.childSubscribers.delete(runEffect)
			}
		}
	}

	/**
	 * Groups multiple state updates to trigger effects only once at the end.
	 * Implementation of the public 'batch' function.
	 */
	static executeBatch = <T>(fn: () => T): T => {
		// Increment depth counter to handle nested batches correctly
		StateImpl.batchDepth++
		try {
			return fn()
		} catch (error: unknown) {
			// Clean up on error to prevent stale subscribers from executing
			// and potentially causing cascading errors
			if (StateImpl.batchDepth === 1) {
				StateImpl.pendingSubscribers.clear()
				StateImpl.deferredEffectCreations.length = 0
			}
			throw error
		} finally {
			StateImpl.batchDepth--

			// Only process effects when exiting the outermost batch,
			// maintaining proper execution order while avoiding redundant runs
			if (StateImpl.batchDepth === 0) {
				// Process effects created during the batch
				if (StateImpl.deferredEffectCreations.length > 0) {
					const effectsToRun = [...StateImpl.deferredEffectCreations]
					StateImpl.deferredEffectCreations.length = 0
					for (const effect of effectsToRun) {
						effect()
					}
				}

				// Process state updates that occurred during the batch
				if (StateImpl.pendingSubscribers.size > 0 && !StateImpl.isNotifying) {
					StateImpl.notifySubscribers()
				}
			}
		}
	}

	/**
	 * Creates a read-only computed value that updates when its dependencies change.
	 * Implementation of the public 'derive' function.
	 */
	static createDerive = <T>(computeFn: () => T): ReadOnlyState<T> => {
		// Create a container to hold state and minimize closure captures
		const container = {
			valueState: StateImpl.createState<T | undefined>(undefined),
			initialized: false,
			cachedValue: undefined as unknown as T,
			computeFn,
		}

		// Internal effect automatically tracks dependencies and updates the derived value
		StateImpl.createEffect(function deriveEffect(): void {
			const newValue = container.computeFn()

			// Only update if the value actually changed to preserve referential equality
			// and prevent unnecessary downstream updates
			if (!(container.initialized && Object.is(container.cachedValue, newValue))) {
				container.cachedValue = newValue
				container.valueState.set(newValue)
			}

			container.initialized = true
		})

		// Return function with lazy initialization - ensures value is available
		// even when accessed before its dependencies have had a chance to update
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
	 * Implementation of the public 'select' function.
	 */
	static createSelect = <T, R>(
		source: ReadOnlyState<T>,
		selectorFn: (state: T) => R,
		equalityFn: (a: R, b: R) => boolean = Object.is
	): ReadOnlyState<R> => {
		// Create a container to hold state and minimize closure captures
		const container = {
			lastSourceValue: undefined as T | undefined,
			lastSelectedValue: undefined as R | undefined,
			initialized: false,
			valueState: StateImpl.createState<R | undefined>(undefined),
			source,
			selectorFn,
			equalityFn,
		}

		// Internal effect to track the source and update only when needed
		StateImpl.createEffect(function selectEffect(): void {
			const sourceValue = container.source()

			// Skip computation if source reference hasn't changed
			if (container.initialized && Object.is(container.lastSourceValue, sourceValue)) {
				return
			}

			container.lastSourceValue = sourceValue
			const newSelectedValue = container.selectorFn(sourceValue)

			// Use custom equality function to determine if value semantically changed,
			// allowing for deep equality comparisons with complex objects
			if (
				container.initialized &&
				container.lastSelectedValue !== undefined &&
				container.equalityFn(container.lastSelectedValue, newSelectedValue)
			) {
				return
			}

			// Update cache and notify subscribers due the value has changed
			container.lastSelectedValue = newSelectedValue
			container.valueState.set(newSelectedValue)
			container.initialized = true
		})

		// Return function with eager initialization capability
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

	/**
	 * Creates a lens for direct updates to nested properties of a state.
	 * Implementation of the public 'lens' function.
	 */
	static createLens = <T, K>(source: State<T>, accessor: (state: T) => K): State<K> => {
		// Create a container to hold lens state and minimize closure captures
		const container = {
			source,
			accessor,
			path: [] as (string | number)[],
			lensState: null as unknown as State<K>,
			isUpdating: false,
			originalSet: null as unknown as (value: K) => void,
		}

		// Extract the property path once during lens creation
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

		// Capture the path once
		container.path = extractPath()

		// Create a state with the initial value from the source
		container.lensState = StateImpl.createState<K>(container.accessor(container.source()))
		container.originalSet = container.lensState.set

		// Set up an effect to sync from source to lens
		StateImpl.createEffect(function lensEffect(): void {
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

		// Override the lens state's set method to update the source
		container.lensState.set = function lensSet(value: K): void {
			if (container.isUpdating) {
				return
			}

			container.isUpdating = true
			try {
				// Update lens state
				container.originalSet(value)

				// Update source by modifying the value at path
				container.source.update((current: T): T => setValueAtPath(current, container.path, value))
			} finally {
				container.isUpdating = false
			}
		}

		// Add update method for completeness
		container.lensState.update = function lensUpdate(fn: (value: K) => K): void {
			container.lensState.set(fn(container.lensState()))
		}

		return container.lensState
	}

	// Processes queued subscriber notifications in a controlled, non-reentrant way
	private static notifySubscribers = (): void => {
		// Prevent reentrance to avoid cascading notification loops when
		// effects trigger further state changes
		if (StateImpl.isNotifying) {
			return
		}

		StateImpl.isNotifying = true

		try {
			// Process all pending effects in batches for better perf,
			// ensuring topological execution order is maintained
			while (StateImpl.pendingSubscribers.size > 0) {
				// Process in snapshot batches to prevent infinite loops
				// when effects trigger further state changes
				const subscribers = Array.from(StateImpl.pendingSubscribers)
				StateImpl.pendingSubscribers.clear()

				for (const effect of subscribers) {
					effect()
				}
			}
		} finally {
			StateImpl.isNotifying = false
		}
	}

	// Removes effect from dependency tracking to prevent memory leaks
	private static cleanupEffect = (effect: Subscriber): void => {
		// Remove from execution queue to prevent stale updates
		StateImpl.pendingSubscribers.delete(effect)

		// Remove bidirectional dependency references to prevent memory leaks
		const deps = StateImpl.subscriberDependencies.get(effect)
		if (deps) {
			for (const subscribers of deps) {
				subscribers.delete(effect)
			}
			deps.clear()
			StateImpl.subscriberDependencies.delete(effect)
		}
	}
}
// Helper for array updates
const updateArrayItem = <V>(arr: unknown[], index: number, value: V): unknown[] => {
	const copy = [...arr]
	copy[index] = value
	return copy
}

// Helper for single-level updates (optimization)
const updateShallowProperty = <V>(
	obj: Record<string | number, unknown>,
	key: string | number,
	value: V
): Record<string | number, unknown> => {
	const result = { ...obj }
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
		// Simple array item update
		return updateArrayItem(array, index, value)
	}

	// Nested path in array
	const copy = [...array]
	const nextPathSegments = pathSegments.slice(1)
	const nextKey = nextPathSegments[0]

	// For null/undefined values in arrays, create appropriate containers
	let nextValue = array[index]
	if (nextValue === undefined || nextValue === null) {
		// Use empty object as default if nextKey is undefined
		nextValue = nextKey !== undefined ? createContainer(nextKey) : {}
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
	// Ensure we have a valid key
	const currentKey = pathSegments[0]
	if (currentKey === undefined) {
		// This shouldn't happen given our checks in the main function
		return obj
	}

	if (pathSegments.length === 1) {
		// Simple object property update
		return updateShallowProperty(obj, currentKey, value)
	}

	// Nested path in object
	const nextPathSegments = pathSegments.slice(1)
	const nextKey = nextPathSegments[0]

	// For null/undefined values, create appropriate containers
	let currentValue = obj[currentKey]
	if (currentValue === undefined || currentValue === null) {
		// Use empty object as default if nextKey is undefined
		currentValue = nextKey !== undefined ? createContainer(nextKey) : {}
	}

	// Create new object with updated property
	const result = { ...obj }
	result[currentKey] = setValueAtPath(currentValue, nextPathSegments, value)
	return result
}

// Simplified function to update a nested value at a path
const setValueAtPath = <V, O>(obj: O, pathSegments: (string | number)[], value: V): O => {
	// Handle base cases
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

	// Delegate to specialized handlers based on data type
	if (Array.isArray(obj)) {
		return updateArrayPath(obj, pathSegments, value) as unknown as O
	}

	return updateObjectPath(obj as Record<string | number, unknown>, pathSegments, value) as unknown as O
}
