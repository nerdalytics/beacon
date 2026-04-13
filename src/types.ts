/** A hook callback that receives typed arguments. */
export type HookFunction<Args extends unknown[]> = (...args: Args) => void
/** Accept a single value or an array of values. */
export type SingleOrArray<T> = T | T[]

/** Hooks for {@linkcode batch}. */
export interface BatchHooks {
	onBatchEnd?: SingleOrArray<
		HookFunction<
			[
				depth: number,
			]
		>
	>
	onBatchError?: SingleOrArray<
		HookFunction<
			[
				error: Error,
				depth: number,
			]
		>
	>
	onBatchStart?: SingleOrArray<
		HookFunction<
			[
				depth: number,
			]
		>
	>
}

/** Hooks for {@linkcode derive}. */
export interface DeriveHooks<T = unknown> {
	onCacheHit?: SingleOrArray<
		HookFunction<
			[
				value: T,
				cacheHit: boolean,
			]
		>
	>
	onCompute?: SingleOrArray<
		HookFunction<
			[
				previousValue: T | undefined,
			]
		>
	>
	onDependencyChange?: SingleOrArray<
		HookFunction<
			[
				target: object,
				prop: PropertyKey,
			]
		>
	>
	onDispose?: SingleOrArray<HookFunction<[]>>
	onError?: SingleOrArray<
		HookFunction<
			[
				error: Error,
			]
		>
	>
}

/** Hooks for {@linkcode effect}. */
export interface EffectHooks {
	onDependencyAdd?: SingleOrArray<
		HookFunction<
			[
				target: object,
				prop: PropertyKey,
				effectName?: string,
			]
		>
	>
	onDependencyChange?: SingleOrArray<
		HookFunction<
			[
				target: object,
				prop: PropertyKey,
			]
		>
	>
	onDispose?: SingleOrArray<
		HookFunction<
			[
				effectName?: string,
			]
		>
	>
	onError?: SingleOrArray<
		HookFunction<
			[
				error: Error,
				effectName?: string,
			]
		>
	>
	onRun?: SingleOrArray<
		HookFunction<
			[
				effectName?: string,
			]
		>
	>
	onSchedule?: SingleOrArray<
		HookFunction<
			[
				effectName?: string,
			]
		>
	>
}

/** Hooks for {@linkcode state}. */
export interface StateHooks<T = unknown> {
	onDelete?: SingleOrArray<
		HookFunction<
			[
				prop: PropertyKey,
				hadProperty: boolean,
				target: T,
			]
		>
	>
	onHas?: SingleOrArray<
		HookFunction<
			[
				prop: PropertyKey,
				exists: boolean,
				target: T,
			]
		>
	>
	onOwnKeys?: SingleOrArray<
		HookFunction<
			[
				keys: PropertyKey[],
				target: T,
			]
		>
	>
	onRead?: SingleOrArray<
		HookFunction<
			[
				prop: PropertyKey,
				value: unknown,
				target: T,
			]
		>
	>
	onWrite?: SingleOrArray<
		HookFunction<
			[
				prop: PropertyKey,
				oldValue: unknown,
				newValue: unknown,
				target: T,
			]
		>
	>
}
