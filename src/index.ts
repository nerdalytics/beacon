// Core types for reactive primitives
type Subscriber = () => void
type Unsubscribe = () => void
export type ReadOnly<T> = () => T
export interface WriteMethods<T> {
	set(value: T): void
	update(fn: (value: T) => T): void
}

// Special symbol used for internal tracking
const STATE_ID = Symbol()

export type State<T> = ReadOnly<T> &
	WriteMethods<T> & {
		[STATE_ID]?: symbol
	}

/**
 * Creates a reactive state container with the provided initial value.
 */
export const state = <T>(initialValue: T): State<T> => StateImpl.createState(initialValue)

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
export const derive = <T>(computeFn: () => T): ReadOnly<T> => StateImpl.createDerive(computeFn)

/**
 * Creates an efficient subscription to a subset of a state value.
 */
export const select = <T, R>(
	source: ReadOnly<T>,
	selectorFn: (state: T) => R,
	equalityFn: (a: R, b: R) => boolean = Object.is
): ReadOnly<R> => StateImpl.createSelect(source, selectorFn, equalityFn)

/**
 * Creates a read-only view of a state, hiding mutation methods.
 */
export const readonly =
	<T>(state: State<T>): ReadOnly<T> =>
	(): T =>
		state()

/**
 * Creates a state with access control, returning a tuple of reader and writer.
 */
export const protectedState = <T>(initialValue: T): [ReadOnly<T>, WriteMethods<T>] => {
	const fullState = state(initialValue)
	return [
		(): T => readonly(fullState)(),
		{
			set: (value: T): void => fullState.set(value),
			update: (fn: (value: T) => T): void => fullState.update(fn),
		},
	]
}

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

	constructor(initialValue: T) {
		this.value = initialValue
	}

	// Creates a callable function that both reads and writes state -
	// this design maintains JavaScript idioms while adding reactivity
	static createState = <T>(initialValue: T): State<T> => {
		const instance = new StateImpl<T>(initialValue)
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
		if (Object.is(this.value, newValue)) {
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

	// Creates an effect that automatically tracks and responds to state changes
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

	// Batches state updates to improve performance by reducing redundant effect runs
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

	// Creates a derived state that memoizes computations and updates only when dependencies change
	static createDerive = <T>(computeFn: () => T): ReadOnly<T> => {
		const valueState = StateImpl.createState<T | undefined>(undefined)
		let initialized = false
		let cachedValue: T

		// Internal effect automatically tracks dependencies and updates the derived value
		StateImpl.createEffect((): void => {
			const newValue = computeFn()

			// Only update if the value actually changed to preserve referential equality
			// and prevent unnecessary downstream updates
			if (!(initialized && Object.is(cachedValue, newValue))) {
				cachedValue = newValue
				valueState.set(newValue)
			}

			initialized = true
		})

		// Return function with lazy initialization - ensures value is available
		// even when accessed before its dependencies have had a chance to update
		return (): T => {
			if (!initialized) {
				cachedValue = computeFn()
				initialized = true
				valueState.set(cachedValue)
			}
			return valueState() as T
		}
	}

	// Creates a selector that monitors a slice of state with performance optimizations
	static createSelect = <T, R>(
		source: ReadOnly<T>,
		selectorFn: (state: T) => R,
		equalityFn: (a: R, b: R) => boolean = Object.is
	): ReadOnly<R> => {
		let lastSourceValue: T | undefined
		let lastSelectedValue: R | undefined
		let initialized = false
		const valueState = StateImpl.createState<R | undefined>(undefined)

		// Internal effect to track the source and update only when needed
		StateImpl.createEffect((): void => {
			const sourceValue = source()

			// Skip computation if source reference hasn't changed
			if (initialized && Object.is(lastSourceValue, sourceValue)) {
				return
			}

			lastSourceValue = sourceValue
			const newSelectedValue = selectorFn(sourceValue)

			// Use custom equality function to determine if value semantically changed,
			// allowing for deep equality comparisons with complex objects
			if (initialized && lastSelectedValue !== undefined && equalityFn(lastSelectedValue, newSelectedValue)) {
				return
			}

			// Update cache and notify subscribers due the value has changed
			lastSelectedValue = newSelectedValue
			valueState.set(newSelectedValue)
			initialized = true
		})

		// Return function with eager initialization capability
		return (): R => {
			if (!initialized) {
				lastSourceValue = source()
				lastSelectedValue = selectorFn(lastSourceValue)
				valueState.set(lastSelectedValue)
				initialized = true
			}
			return valueState() as R
		}
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
