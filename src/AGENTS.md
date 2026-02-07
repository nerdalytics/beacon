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
| `isTrackingOnly` | `boolean` | When true, get/has/ownKeys handlers skip subscriber registration (re-run optimization) |
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
| `frozenHooksCache` | `object → StateHooks` | Hooks storage for frozen/sealed targets |

## Symbols

| Symbol | Purpose |
|--------|---------|
| `OWN_KEYS_SYMBOL` | Tracks key enumeration reads (ownKeys trap) |
| `SUBSCRIBERS` | Stores subscriber Set on target objects |
| `PROXY` | Stores Proxy reference on target objects |
| `HOOKS` | Stores StateHooks on target objects for nested propagation |
| `CACHED_METHODS` | Stores cached array method wrappers |

## Internal Function Architecture

### Proxy Handlers

Five handler factories, each returns a ProxyHandler method:

| Handler | Traps | Key behavior |
|---------|-------|-------------|
| `createGetHandler()` | `get` | Delegates to `trackDependency` for reads, `getWrappedArrayMethod` for mutating methods, `resolveValue` for nested wrapping |
| `createSetHandler()` | `set` | Delegates to `handleBatchFastPath` during batch, `performWrite` otherwise |
| `createDeleteHandler()` | `deleteProperty` | Deletion with subscriber notification |
| `createHasHandler()` | `has` | `in` operator tracking via `trackDependency` |
| `createOwnKeysHandler()` | `ownKeys` | Key enumeration tracking via `OWN_KEYS_SYMBOL` |

Handler helpers:

| Function | Purpose |
|----------|---------|
| `trackDependency` | Routes to `registerEffectRead` (first run) or `trackReadSilently` (re-runs via `isTrackingOnly`) |
| `registerEffectRead` | Records read + fires `onDependencyAdd` hook |
| `trackReadSilently` | Records read without hooks or subscriber registration |
| `resolveValue` | Wraps nested objects via `wrapNestedObject` → `state()` |
| `isInternalSymbol` | Guards access to `SUBSCRIBERS`, `PROXY`, `HOOKS` symbols |
| `getWrappedArrayMethod` | Intercepts mutating array methods, delegates to cache strategies |
| `createCachedArrayMethod` | Caches wrapped method on extensible targets via `CACHED_METHODS` symbol |
| `getCachedMethodFromWeakMap` | Caches wrapped method for frozen targets via `frozenMethodCache` |
| `performWrite` | Checks infinite loop, compares via `Object.is`, notifies subscribers |
| `checkInfiniteLoop` | Throws if effect writes to a property it read (exempt: child effects) |
| `handleBatchFastPath` | Defers writes to `dirtyTargets` during batch (skips hooks + loop check) |
| `getArrayLengthBeforeMutation` | Captures array length before index assignment |
| `notifyLengthChangeIfNeeded` | Notifies `length` subscribers if array grew/shrank |

### Subscriber Scheduling Pipeline

```
scheduleSubscribersForTarget(target, prop)
  → findSubscribers(target)
  → for each subscriber:
    scheduleSubscriber(subscriber, target, prop)
      → addPendingEffect(subscriber)           [prop undefined]
      → scheduleSubscriberWithProp(subscriber)  [prop defined]
        → checks effectStateReads for matching prop or OWN_KEYS_SYMBOL
        → addPendingEffect(subscriber)
  → flushEffects() if batchDepth === 0
```

### Effect Lifecycle

| Function | Purpose |
|----------|---------|
| `effect()` | Public API — composes hooks, creates `runEffect` closure, registers as child |
| `runEffectSafely` | Saves/restores `currentEffect` + `isTrackingOnly`, delegates to `executeEffectBody` |
| `executeEffectBody` | Sets `isTrackingOnly` on re-runs, disposes children, runs `fn()`, updates subscriptions |
| `disposeChildEffects` | Cleans up all child effects before re-running parent |
| `updateEffectSubscriptions` | Compares deps after execution, restores if stable, updates subscriber sets if changed |
| `tryRestoreStableDeps` | Short-circuits if deps unchanged (via `depsMatch` → `areDepsStable`) |
| `removeStaleSubscribers` | Removes effect from targets no longer depended on |
| `registerNewSubscribers` | Adds effect to newly depended-on targets |
| `registerChildEffect` | Links effect to `currentEffect` via `parentEffect`/`childEffects` |
| `attachEffectHooks` | Sets `__hooks` on `EffectFunction` for runtime hook callbacks |

### Effect Cleanup

| Function | Purpose |
|----------|---------|
| `cleanupEffect` | Removes from subscribers, clears deps/reads, resets `__prevDeps`/`__prevReads` |
| `cleanupEffectCompletely` | `cleanupEffect` + iterative child cleanup (avoids stack overflow) |
| `cleanupChildEffect` | Cleans one child + pushes grandchildren onto iterative queue |
| `cleanupEffectOnError` | Emergency cleanup on error — removes from all subscriber sets |
| `removeEffectFromSubscribers` | Removes effect from all subscriber sets in a dep set |

### Flush Pipeline

| Function | Purpose |
|----------|---------|
| `flushEffects` | Non-recursive while loop draining `pendingEffects` |
| `runPendingEffectBatch` | Snapshots + clears `pendingEffects`, runs each via `runEffectIfActive` |
| `runEffectIfActive` | Guards against disposed effects (checks `effectDependencies`) |

### Subscriber Storage

| Function | Purpose |
|----------|---------|
| `getSubscribers` | Resolves subscriber set: `subscriberCache` → `[SUBSCRIBERS]` symbol → `proxyCacheSubs` → create new |
| `storeSubscriberSet` | Stores via `Object.defineProperty` (extensible) or `proxyCacheSubs` WeakMap (frozen) |
| `findSubscribers` | Read-only lookup: `[SUBSCRIBERS]` symbol or `proxyCacheSubs` |

### Batch Internals

| Function | Purpose |
|----------|---------|
| `batch()` | Public API — increments `batchDepth`, runs fn, flushes at outermost boundary |
| `flushDirtyTargets` | Processes deferred writes from `dirtyTargets` at `batchDepth === 1` |
| `flushBatchEffects` | Runs deferred effect creations, then flushes pending effects |
| `runDeferredEffects` | Executes effects created during batch |
| `clearBatchState` | Emergency cleanup — clears all pending state |
| `handleBatchError` | Decrements depth, fires error hook, clears state at outermost |

### Derive Internals

| Function | Purpose |
|----------|---------|
| `derive()` | Public API — creates `internalState` + reactive proxy with custom get/set traps |
| `runDeriveComputation` | Calls `computeFn`, updates `internalState.lastValue` + reactive internal if changed |
| `runDeriveWithErrorHandling` | Wraps computation with try/catch/finally for `onError` hook + `isComputing` reset |
| `resolveDeriveValue` | Returns reactive internal's value (inside effect) or direct value (outside) |
| `toggleDeriveReactivity` | Creates/disposes internal effect when `reactive` property changes |

### Proxy Setup

| Function | Purpose |
|----------|---------|
| `defineProxyProperties` | Stores `[PROXY]` and `[HOOKS]` symbols on target (extensible) or WeakMap (frozen) |
| `definePropertyOnTarget` | `Object.defineProperty` for `PROXY` and `HOOKS` symbols |
| `storeHooksForFrozenTarget` | Falls back to `frozenHooksCache` WeakMap |

### Utilities

| Function | Purpose |
|----------|---------|
| `callHookSafe` | Invokes hook in try-catch — hook errors never propagate to core |
| `didEffectReadProp` | Checks if effect read a specific property (for infinite loop detection) |
| `unwrapIfObject` | Passes objects through `tryUnwrap`, returns primitives as-is |
| `tryUnwrap` | Returns value unchanged if already proxied (checks `[PROXY]` symbol) |
| `depsMatch` | Compares two dep sets by size + per-target property sets |

## Critical Invariants

1. **Proxy deduplication**: Never create two Proxies for the same target. Always check `proxyCache` and `[PROXY]` symbol first.
2. **Effect re-entrancy guard**: `__active` boolean on EffectFunction prevents an effect from running while already running.
3. **Batch depth counting**: `batchDepth` must always return to 0. Incremented before `fn()`, decremented in all paths (success + error).
4. **Cleanup order**: `cleanupEffect` removes from subscribers and clears `__prevDeps`/`__prevReads`. `cleanupEffectCompletely` also handles children iteratively (not recursively — avoids stack overflow).
5. **`flushEffects` non-recursion**: Uses a while loop draining `pendingEffects`. New effects triggered during flush are added to `pendingEffects` and processed in the same loop iteration.
6. **Infinite loop detection scope**: Only blocks direct self-mutation (effect reads prop X then writes prop X on same target). Indirect cycles through different effects are allowed. Nested child effects are exempt (they have a `parentEffect`).
7. **Stable dependency skip**: `updateEffectSubscriptions` compares deps after execution via `tryRestoreStableDeps`. If stable, restores previous tracking structures (skips subscriber teardown/rebuild). If changed, only removes stale subscriber sets.
8. **Batch dirty target processing**: `dirtyTargets` processed at `batchDepth === 1` (before decrement), so `scheduleSubscribersForTarget` sees `batchDepth > 0` and defers flushing. Processing after decrement would cause premature per-property flushing.
9. **Tracking-only re-runs**: On effect re-execution, `isTrackingOnly = true` causes `trackDependency` to use `trackReadSilently` instead of `registerEffectRead` — skips subscriber set mutation and hook calls, only records reads for dep comparison.

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
