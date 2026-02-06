# src/ — Beacon Core

Single file: `index.ts`. The entire reactive system. Do not split into modules.

## Exports

`state`, `effect`, `batch`, `derive`, `Unsubscribe`, `EffectCallback`, `EffectName`, `ComputedValue`

## Internal State (Module-Level)

Global mutable state driving the reactive system:

| Variable | Type | Purpose |
|----------|------|---------|
| `currentEffect` | `EffectFunction \| null` | Currently executing effect (for dependency tracking) |
| `batchDepth` | `number` | Nesting depth counter for batch operations |
| `isNotifying` | `boolean` | Prevents re-entrant `flushEffects` calls |
| `trackingOnly` | `boolean` | When true, get/has/ownKeys handlers skip subscriber set operations (P2 optimization) |
| `pendingEffects` | `Set<EffectFunction>` | Effects queued for execution |
| `deferredEffectCreations` | `EffectFunction[]` | Effects created inside batch (deferred until batch end) |
| `dirtyTargets` | `Map<object, Set<PropertyKey>>` | Batch fast path: tracks dirty target-property pairs for deferred scheduling |

## Internal Data Structures (WeakMap-based)

| WeakMap | Type | Purpose |
|---------|------|---------|
| `parentEffect` | `EffectFunction → EffectFunction` | Effect hierarchy for nested cleanup |
| `childEffects` | `EffectFunction → Set<EffectFunction>` | Children of an effect |
| `effectStateReads` | `EffectFunction → WeakMap<object, Set<PropertyKey>>` | Three-level per-property read tracking |
| `effectDependencies` | `EffectFunction → Set<object>` | Which objects an effect depends on |
| `proxyCache` | `object → object` | Reuse same Proxy for same target |
| `subscriberCache` | `object → Set<EffectFunction>` | Fast subscriber lookup by target |
| `proxyCacheSubs` | `object → Set<EffectFunction>` | Fallback subscriber storage for frozen/sealed objects |
| `frozenMethodCache` | `object → Map<PropertyKey, CachedMethod>` | Cached wrapped array methods for frozen objects |

## Symbols

| Symbol | Purpose |
|--------|---------|
| `OWN_KEYS_SYMBOL` | Tracks key enumeration reads (ownKeys trap) |
| `SUBSCRIBERS` | Stores subscriber Set on target objects |
| `PROXY` | Stores Proxy reference on target objects |
| `CACHED_METHODS` | Stores cached array method wrappers |

## Proxy Handler Architecture

Five handler factories, each returns a ProxyHandler method:

| Handler | Traps | Key behavior |
|---------|-------|-------------|
| `createGetHandler()` | `get` | Tracks reads (or lightweight `trackRead` when `trackingOnly`), wraps nested objects, intercepts array mutating methods |
| `createSetHandler()` | `set` | Batch fast path (defers to `dirtyTargets`), infinite loop detection, `Object.is` comparison, array length tracking |
| `createDeleteHandler()` | `deleteProperty` | Deletion with subscriber notification |
| `createHasHandler()` | `has` | `in` operator tracking |
| `createOwnKeysHandler()` | `ownKeys` | Key enumeration tracking via `OWN_KEYS_SYMBOL` |

## Critical Invariants

1. **Proxy deduplication**: Never create two Proxies for the same target. Always check `proxyCache` and `[PROXY]` symbol first.
2. **Effect re-entrancy guard**: `__active` boolean on EffectFunction prevents an effect from running while already running.
3. **Batch depth counting**: `batchDepth` must always return to 0. Incremented before `fn()`, decremented in all paths (success + error).
4. **Cleanup order**: `cleanupEffect` removes from subscribers and clears `__prevDeps`/`__prevReads`. `cleanupEffectCompletely` also handles children iteratively (not recursively — avoids stack overflow).
5. **`flushEffects` non-recursion**: Uses a while loop draining `pendingEffects`. New effects triggered during flush are added to `pendingEffects` and processed in the same loop iteration.
7. **Stable dependency skip**: `runEffect` compares deps after execution via `depsMatch`. If stable, restores previous tracking structures (skips subscriber teardown/rebuild). If changed, only removes stale subscriber sets.
8. **Batch dirty target processing**: `dirtyTargets` processed at `batchDepth === 1` (before decrement), so `scheduleSubscribersForTarget` sees `batchDepth > 0` and defers flushing. Processing after decrement would cause premature per-property flushing.
6. **Infinite loop detection scope**: Only blocks direct self-mutation (effect reads prop X then writes prop X on same target). Indirect cycles through different effects are allowed. Nested child effects are exempt (they have a `parentEffect`).

## `derive()` Implementation

Creates an internal `state()` + `effect()` pair. Returns a Proxy over `internalState` with custom get/set traps. The `value` property reads through the reactive internal when inside an effect (for dependency propagation) or from `target.value` otherwise. The `reactive` property controls the effect lifecycle (false → dispose, true → recreate).

## Modification Guidelines

- Maintain single-file architecture
- All internal symbols: `unique symbol` typed
- Use WeakMap for any new object→data mappings (GC-safe)
- Follow Biome rules: tabs, sorted keys/properties, no `any`, explicit return types, shorthand array types
- Test every code path — coverage targets: 100% branches, 100% functions

<!--— BEACON-START —>[Source Index]
|root: ./src
|IMPORTANT: Maintain single-file architecture for core. Hooks are a separate module.
|.:{index.ts,types.ts}
|hooks/:{AGENTS.md,index.ts,compose.ts}
<!--— BEACON-END —>
