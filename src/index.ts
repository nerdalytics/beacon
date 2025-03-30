// Types
type Subscriber = () => void;

type Unsubscribe = () => void;

export interface Signal<T> {
	(): T; // get value
	set(value: T): void; // set value directly
	update(fn: (currentValue: T) => T): void; // update value with a function
}

// Global state for tracking
let currentEffect: Subscriber | null = null;

let batchDepth = 0;

const pendingEffects = new Set<Subscriber>();

const subscriberDependencies = new WeakMap<Subscriber, Set<Set<Subscriber>>>();

// Use a flag to prevent multiple updates from running the effects
let updateInProgress = false;

/**
 * Creates a new reactive state with the provided initial value
 */
export const state = <T>(initialValue: T): Signal<T> => {
	let value = initialValue;

	const subscribers = new Set<Subscriber>();

	const read = (): T => {
		if (currentEffect) {
			subscribers.add(currentEffect);

			let dependencies = subscriberDependencies.get(currentEffect);

			if (!dependencies) {
				dependencies = new Set();

				subscriberDependencies.set(currentEffect, dependencies);
			}

			dependencies.add(subscribers);
		}

		return value;
	};

	const write = (newValue: T): void => {
		if (Object.is(value, newValue)) {
			return; // No change
		}
		value = newValue;

		if (subscribers.size === 0) {
			return;
		}

		// Add subscribers to pendingEffects - always use loop for better performance
		for (const sub of subscribers) {
			pendingEffects.add(sub);
		}

		if (batchDepth === 0 && !updateInProgress) {
			processEffects();
		}
	};

	const update = (fn: (currentValue: T) => T): void => {
		write(fn(value));
	};

	return Object.assign(read, { set: write, update });
};

/**
 * Process all pending effects, ensuring full propagation through the dependency chain
 */
const processEffects = (): void => {
	if (pendingEffects.size === 0 || updateInProgress) {
		return;
	}

	updateInProgress = true;

	while (pendingEffects.size > 0) {
		const currentEffects = [...pendingEffects];
		pendingEffects.clear();

		for (const effect of currentEffects) {
			effect();
		}
	}

	updateInProgress = false;
};

/**
 * Helper to clean up effect subscriptions
 */
const cleanupEffect = (effect: Subscriber): void => {
	const deps = subscriberDependencies.get(effect);

	if (deps) {
		for (const subscribers of deps) {
			subscribers.delete(effect);
		}

		deps.clear();
	}
};

/**
 * Creates an effect that runs when its dependencies change
 */
export const effect = (fn: () => void): Unsubscribe => {
	const runEffect = (): void => {
		cleanupEffect(runEffect);

		const prevEffect = currentEffect;

		currentEffect = runEffect;

		try {
			fn();
		} finally {
			currentEffect = prevEffect;
		}
	};

	runEffect();

	return (): void => {
		cleanupEffect(runEffect);
	};
};
