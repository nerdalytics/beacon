# src/ — Beacon Core

Single file: `index.ts`. The entire reactive system. Do not split into modules.

## Exports

Functions: `state`, `effect`, `batch`, `derive`, `onIdle`, `until`

Types: `Unsubscribe`, `EffectCallback`, `EffectName`, `DerivedValue`, `EffectSchedule`, `EffectOptions`, `UntilOptions`, `IdleCallback`

## Internal State (Module-Level)

Global mutable state driving the reactive system:

| Variable | Type | Purpose |
|----------|------|---------|
| `currentEffect` | `EffectFunction \| null` | Currently executing effect (for dependency tracking) |
| `batchDepth` | `number` | Nesting depth counter for batch operations |
| `isNotifying` | `boolean` | Prevents re-entrant `flushEffects` calls; also set while idle callbacks run, so their writes queue |
| `isTrackingOnly` | `boolean` | When true, get/has/ownKeys handlers skip subscriber registration (re-run optimization) |
| `pendingEffects` | `Set<EffectFunction>` | Sync effects queued for execution |
| `pendingMicroEffects` | `Set<EffectFunction>` | `schedule: 'microtask'` effects waiting for the next microtask flush |
| `microtaskFlushArmed` | `boolean` | A microtask flush is already queued |
| `microtaskFlushing` | `boolean` | Set while the microtask callback runs `flushEffects`; effect errors are reported instead of rethrown |
| `microtaskFlushChain` | `number` | Consecutive microtask flushes each armed while the previous one ran; reset to 0 when armed from outside a microtask flush |
| `effectErrorHandled` | `boolean` | Set by `runEffectSafely` on a throw: whether the effect had an `onError` hook |
| `effectQueue` | `EffectFunction[]` | Reused array `runPendingEffectBatch` drains when more than one effect is pending |
| `deferredEffectCreations` | `EffectFunction[]` | Effects created inside batch (deferred until batch end) |
| `dirtyTargets` | `Map<object, Set<PropertyKey>>` | Batch fast path: tracks dirty target-property pairs for deferred scheduling |
| `rerunReadList`, `rerunReadIndex`, `rerunStable` | | Re-run fast path: replays the effect's `__readList` and advances while reads match |
| `rerunTempDeps`, `rerunTempReads`, `buildingReadList` | | Re-run slow path: collect fresh deps/reads and build a new read list |
| `idleCallbacks` | `Set<IdleCallback>` | `onIdle` subscribers |
| `flushProcessed`, `settleProcessed` | `boolean` | Work happened since the last idle notification (a flush ran, or an async derive settled) |
| `untilEvaluating`, `untilSawPending` | `boolean` | Set while an `until` predicate runs; records whether it read a pending derive |
| `hasFallbackSubs` | `boolean` | Armed when a target that carries `[PROXY]` (extensible at `state()` time) gets its subscriber set stored in `proxyCacheSubs`, i.e. it was sealed or frozen after `state()`; makes the fast paths consult the WeakMap for every target without `[SUBSCRIBERS]`. Never reset |

## EffectFunction Properties

Effect tracking data stored directly on the function object (O(1) property access, no WeakMap overhead):

| Property | Type | Purpose |
|----------|------|---------|
| `__active` | `boolean` | Re-entrancy guard — prevents effect from running while already running |
| `__children` | `Set<EffectFunction> \| undefined` | Children of this effect (nested effects) |
| `__deps` | `Set<object> \| undefined` | Which objects this effect depends on |
| `__hooks` | `EffectInternalHooks \| undefined` | Runtime hook callbacks (onDependencyAdd, onDependencyChange, onSchedule); set only when at least one exists |
| `__parent` | `EffectFunction \| undefined` | Parent effect for nested cleanup |
| `__prevDeps` | `Set<object> \| undefined` | Previous deps for stable-dependency optimization |
| `__prevReads` | `Map<object, Set<PropertyKey>> \| undefined` | Previous reads for stable-dependency optimization |
| `__readList` | `(object \| PropertyKey)[] \| undefined` | Flat `[target, prop, ...]` read sequence from the last stable re-run, replayed by the fast path |
| `__reads` | `Map<object, Set<PropertyKey>> \| undefined` | Per-property read tracking (which props read on which targets) |
| `__schedule` | `EffectSchedule \| undefined` | `'microtask'` routes scheduling through `pendingMicroEffects` |
| `effectName` | `string \| undefined` | Optional name for debugging/hooks |

## Internal Data Structures (WeakMap-based)

| WeakMap | Type | Purpose |
|---------|------|---------|
| `proxyCache` | `object → object` | Reuse same Proxy for same target |
| `proxyCacheSubs` | `object → Set<EffectFunction>` | Fallback subscriber storage for frozen/sealed objects |
| `arrayMethodCache` | `ArrayMethod → ArrayMethod` | One wrapper per native mutating array method; the wrapper acts on its call receiver, so no per-target entry is needed |
| `frozenHooksCache` | `object → StateHooks` | Hooks storage for non-extensible targets; written, never read (see `HOOKS_TODO.md` C1) |

## Symbols

| Symbol | Purpose |
|--------|---------|
| `OWN_KEYS_SYMBOL` | Tracks key enumeration reads (ownKeys trap) |
| `SUBSCRIBERS` | Stores the subscriber Set on target objects; absent until the first subscription and on targets that cannot take it (those keep the set in `proxyCacheSubs`) |
| `PROXY` | Stores Proxy reference on target objects |
| `HOOKS` | Stores StateHooks on extensible target objects; defined but never read (nested propagation is by closure) |

## Internal Function Architecture

### Proxy Handlers

Five handler factories, each returns a ProxyHandler method. `state()` without hooks shares one prebuilt `HOOKLESS_HANDLER`; the get factory returns a leaner variant when no hooks are passed, the set factory returns one trap for every state object.

| Handler | Traps | Key behavior |
|---------|-------|-------------|
| `createGetHandler()` | `get` | Delegates to `trackDependency` for reads and `wrapNestedObject` for nested wrapping; both variants route mutating array methods through `getWrappedArrayMethod` before the non-object early return |
| `createSetHandler()` | `set` | One trap for hooked and hookless state: `handleBatchFastPath` during batch from outside any effect, `performUnbatchedWrite` outside any effect, `performWrite` inside an effect; `onWrite` only observes after the raw write on every path |
| `createDeleteHandler()` | `deleteProperty` | Deletion with subscriber notification |
| `createHasHandler()` | `has` | `in` operator tracking via `trackDependency` |
| `createOwnKeysHandler()` | `ownKeys` | Key enumeration tracking via `OWN_KEYS_SYMBOL` |

Handler helpers:

| Function | Purpose |
|----------|---------|
| `trackDependency` | First run: adds `currentEffect` to the target's subscribers, then `recordEffectRead`. Re-run (`isTrackingOnly`): `recordEffectRead` in silent mode |
| `recordEffectRead` | Non-silent: records into `__deps`/`__reads` + fires `onDependencyAdd`. Silent: advances the read-list replay while it matches, else replays the prefix into temp collections and falls back to `recordSilentRead` |
| `recordSilentRead` | Records into `rerunTempDeps`/`rerunTempReads` (and `buildingReadList`) without hooks or subscriber registration |
| `readListMatchesRead` | Checks the next `[target, prop]` pair of the replayed read list |
| `replayReadListToTempCollections` | Copies the matched read-list prefix into fresh temp collections when the fast path breaks |
| `wrapNestedObject` | Returns the cached proxy for a nested object, or wraps it via `state()` |
| `isInternalSymbol` | Guards access to `SUBSCRIBERS`, `PROXY`, `HOOKS` symbols |
| `getWrappedArrayMethod` | Returns the wrapper for a mutating array method read from an array target (`Array.isArray` first, so plain-object reads pay one call and one check) |
| `wrapArrayMethod` | Wraps a native mutating array method once, cached in `arrayMethodCache`: applies it to the call receiver (the Proxy) inside `batch()`, so every read and write passes the traps and each subscriber wakes at most once per call |
| `performUnbatchedWrite` | Outside any effect and batch: compares via `Object.is`, skips scheduling when the target has no subscribers, else notifies per property |
| `performWrite` | Checks infinite loop, compares via `Object.is`, notifies subscribers |
| `checkInfiniteLoop` | Throws if effect writes to a property it read (exempt: child effects, microtask effects) |
| `handleBatchFastPath` | Defers writes to `dirtyTargets` during batch (calls `onWrite`, skips the loop check); inlines the `findSubscribers` lookup |
| `getArrayLengthBeforeMutation` | Captures array length before index assignment |
| `notifyLengthChangeIfNeeded` | Notifies `length` subscribers if array grew/shrank |

### Subscriber Scheduling Pipeline

```
scheduleSubscribersForTarget(target, prop?)
  → findSubscribers(target)
  → for each subscriber:
      prop undefined → addPendingEffect(subscriber)
      prop defined   → scheduleSubscriberWithProp(subscriber, target, prop)
                         → checks subscriber.__reads for matching prop or OWN_KEYS_SYMBOL
                         → addPendingEffect(subscriber), then onDependencyChange hook
  → flushEffects() if batchDepth === 0 && !isNotifying

addPendingEffect(subscriber)
  → __schedule === 'microtask' → pendingMicroEffects + armMicrotaskFlush()
  → otherwise                   → pendingEffects
  → onSchedule hook only when the effect was newly queued
```

### Effect Lifecycle

| Function | Purpose |
|----------|---------|
| `effect()` | Public API — composes hooks, creates `runEffect` closure, registers as child |
| `runEffectSafely` | Saves/restores `currentEffect` + `isTrackingOnly`, delegates to `executeEffectBody` |
| `executeEffectBody` | Sets `isTrackingOnly` on re-runs, disposes children, picks the read-list fast path or temp-collection slow path, runs `fn()`, then `handleRerunResult` / `updateEffectSubscriptions` |
| `handleRerunResult` | Re-run outcome: full read-list match or matching temp deps (via `depsMatch` → `allDepsPropsMatch` → `propsMatch` → `setContainsAll`) → keep subscriptions (store the new read list); otherwise swap in the temp deps/reads |
| `handleReadListMismatch` | Drops `__readList` when the replay did not consume it exactly |
| `clearRerunState` | Resets all `rerun*` / `buildingReadList` module state |
| `disposeChildEffects` | Cleans up all child effects before re-running parent |
| `updateEffectSubscriptions` | First run or changed re-run: removes stale subscriber sets, registers new ones, reindexes reads, stores the deps/reads as previous; returns early when the effect's own dispose ran inside the body and cleared `__deps`/`__reads` |
| `removeStaleSubscribers` | Removes effect from targets no longer depended on |
| `registerNewSubscribers` | Adds effect to newly depended-on targets |
| `registerChildEffect` | Links effect to `currentEffect` via `__parent`/`__children` properties |

### Effect Cleanup

| Function | Purpose |
|----------|---------|
| `cleanupEffect` | Removes from subscribers, then `resetEffectTracking` |
| `resetEffectTracking` | Dequeues from both pending sets, clears `__deps`/`__reads`/`__readList`/`__prevDeps`/`__prevReads` |
| `cleanupEffectCompletely` | One iterative loop over the effect and all descendants: `cleanupEffect`, unlink parent/children, deactivate (avoids stack overflow) |
| `cleanupEffectOnError` | Emergency cleanup on error — removes from all subscriber sets |
| `removeEffectFromSubscribers` | Removes effect from all subscriber sets in a dep set |

### Flush Pipeline

| Function | Purpose |
|----------|---------|
| `addPendingEffect` | Queues into `pendingEffects` or `pendingMicroEffects` by `__schedule` |
| `armMicrotaskFlush` | Counts `microtaskFlushChain`, queues one microtask that moves `pendingMicroEffects` into `pendingEffects`, flushes, then `notifyIdleOutsideFlush`; at `MAX_MICROTASK_FLUSH_CHAIN` (100) the microtask drops `pendingMicroEffects` and calls `console.error` instead |
| `flushEffects` | Per cycle: drain `pendingEffects` in a while loop, then `notifyIfIdle`; repeats while callbacks scheduled effects, up to `MAX_IDLE_CYCLES` (100), then drops them and throws (microtask flush: `console.error`) |
| `runPendingEffectBatch` | Single pending effect runs directly; otherwise copies into `effectQueue`, clears `pendingEffects`, runs each via `runEffectIfActive` |
| `runEffectIfActive` | Guards against disposed effects (checks `effect.__deps`). On a throw: inside a microtask flush, `console.error` unless `onError` ran, then continue; otherwise clear `pendingEffects` and `effectQueue` and rethrow |

### Subscriber Storage

| Function | Purpose |
|----------|---------|
| `getSubscribers` | Resolves subscriber set: `[SUBSCRIBERS]` symbol → `proxyCacheSubs` → create new |
| `storeSubscriberSet` | Stores via `Object.defineProperty` (extensible) or `proxyCacheSubs` WeakMap (non-extensible, or a Proxy target rejecting the define); arms `hasFallbackSubs` when a target that carries `[PROXY]` lands in the WeakMap |
| `findSubscribers` | Read-only lookup: `[SUBSCRIBERS]` symbol, else `proxyCacheSubs` only when `hasFallbackSubs` is set or the target has no `[PROXY]` (it never took symbols) |

### Batch Internals

| Function | Purpose |
|----------|---------|
| `batch()` | Public API — increments `batchDepth`, runs fn, flushes at outermost boundary |
| `flushDirtyTargets` | Processes deferred writes from `dirtyTargets` at `batchDepth === 1` |
| `flushBatchEffects` | Runs deferred effect creations, flushes pending effects, then `notifyIdleOutsideFlush` |
| `runDeferredEffects` | Executes effects created during batch |
| `clearBatchState` | Emergency cleanup — clears both pending sets, deferred creations, dirty targets |
| `handleBatchError` | Decrements depth, fires error hook, clears state at outermost |

### Derive Internals

| Function | Purpose |
|----------|---------|
| `derive()` | Public API — overloaded for sync and `Promise` compute functions; creates `internalState` + Proxy with custom get/set traps |
| `computeDerive` | Fires `onCompute`, calls `computeFn`, routes thenables to the async handler, otherwise `writeDeriveValue`; `onError` + `isComputing` reset via catch/finally |
| `writeDeriveValue` | Writes `lastValue` and the reactive internal's `value` when changed (`Object.is`) |
| `setDerivePending` | Writes `pending` through the reactive proxy so the change notifies |
| `isThenable` | Detects a `then` function on the compute result |

### Settle Observation

| Function | Purpose |
|----------|---------|
| `onIdle()` | Public API — adds a callback to `idleCallbacks`, returns an unsubscribe |
| `notifyIfIdle` | Calls idle callbacks (errors swallowed) when the graph is idle (no effect queued, no microtask flush armed) and work happened since the last call; a pending async derive does not block it |
| `notifyIdleOutsideFlush` | Notify entry outside `flushEffects`: sets `isNotifying` around `notifyIfIdle` so callback writes queue, then `flushEffects` |
| `until()` | Public API — throws inside a reactive scope, rejects at once on an aborted signal, else wraps `runUntil` in a Promise |
| `runUntil` | Runs the predicate in an effect; resolves on a microtask once it is truthy and no read derive was pending; `timeout`/`signal` reject; a throwing predicate rejects with its error on a microtask instead of propagating to the writer; disposes its effect, timer and abort listener on resolve or reject |

### Proxy Setup

| Function | Purpose |
|----------|---------|
| `defineProxyProperties` | Stores `[PROXY]` and `[HOOKS]` symbols on extensible targets; falls back to `storeHooksForFrozenTarget` otherwise |
| `definePropertyOnTarget` | `Object.defineProperty` for `PROXY` and `HOOKS` symbols |
| `storeHooksForFrozenTarget` | Writes hooks to `frozenHooksCache` for non-extensible targets |

### Utilities

| Function | Purpose |
|----------|---------|
| `callHookSafe` | Invokes hook in try-catch — hook errors never propagate to core |
| `didEffectReadProp` | Checks if effect read a specific property (for infinite loop detection) |
| `depsMatch` | Compares two dep sets by size + per-target property sets |

## Critical Invariants

1. **Proxy deduplication**: Never create two Proxies for the same target. Always check `proxyCache` and `[PROXY]` symbol first.
2. **Effect re-entrancy guard**: `__active` boolean on EffectFunction prevents an effect from running while already running.
3. **Batch depth counting**: `batchDepth` must always return to 0. Incremented before `fn()`, decremented in all paths (success + error).
4. **Cleanup order**: `cleanupEffect` removes from subscribers and clears `__prevDeps`/`__prevReads`. `cleanupEffectCompletely` also handles children iteratively (not recursively — avoids stack overflow).
5. **`flushEffects` non-recursion**: Uses a while loop draining `pendingEffects`. Effects triggered during a flush are added to `pendingEffects` and picked up by the next loop iteration. Effects triggered by `onIdle` callbacks are picked up by the next idle cycle of the same `flushEffects` call (at most `MAX_IDLE_CYCLES`), or by the `flushEffects` in `notifyIdleOutsideFlush`; callbacks never flush re-entrantly. Re-runs of microtask effects never join a sync flush; they wait for `armMicrotaskFlush`.
6. **Infinite loop detection scope**: Only blocks direct self-mutation (effect reads prop X then writes prop X on same target). Indirect cycles through different effects are allowed. Nested child effects (they have a `__parent`) and `schedule: 'microtask'` effects are exempt. Microtask re-runs are bounded instead: after `MAX_MICROTASK_FLUSH_CHAIN` (100) microtask flushes each armed from inside the previous one, `armMicrotaskFlush` drops `pendingMicroEffects` and reports with `console.error`. This bounds microtask self-writes, microtask cross-effect cycles and onIdle-to-microtask loops; sync cross-effect cycles stay uncapped.
7. **Stable dependency skip**: `handleRerunResult` compares a re-run's deps with the previous run's via `depsMatch`. If stable, keeps the existing tracking structures (skips subscriber teardown/rebuild) and `updateEffectSubscriptions` is not called. If changed, `updateEffectSubscriptions` only removes stale subscriber sets and registers new ones.
8. **Batch dirty target processing**: `dirtyTargets` processed at `batchDepth === 1` (before decrement), so `scheduleSubscribersForTarget` sees `batchDepth > 0` and defers flushing. Processing after decrement would cause premature per-property flushing.
9. **Tracking-only re-runs**: On effect re-execution, `isTrackingOnly = true` makes `trackDependency` call `recordEffectRead` in silent mode — skips subscriber set mutation and hook calls, only replays/records reads for dep comparison. Any throw must go through `clearRerunState` (done in `runEffectSafely`).

## `derive()` Implementation

Creates an internal `state()` + `effect()` pair. Returns a Proxy over `internalState` with custom get/set traps. `value` and `pending` read through the reactive internal when inside an effect (for dependency propagation) or from the raw target otherwise. The `reactive` property controls the effect lifecycle (false → dispose, true → recreate); every other property reads `undefined` and rejects writes.

Async compute: a thenable result sets `pending = true` and bumps a `generation` counter. A synchronous result clears `pending`, and so does dispose. On settle, only the latest generation writes, and only while `pending` is still `true` (a later sync result or a dispose discards the settle, including `onError`): it sets `settleProcessed` and, inside a `batch`, writes the value (on resolve) and clears `pending`. A rejection also fires `onError`.

## Modification Guidelines

- Maintain single-file architecture
- All internal symbols: `unique symbol` typed
- Use WeakMap for any new object→data mappings (GC-safe)
- Follow Biome rules: tabs, sorted keys/properties, no `any`, explicit return types, shorthand array types
- Test every code path — coverage targets: 100% branches, 100% functions

<!-- BEACON-START -->[Source Index]|root: ./src|IMPORTANT: Maintain single-file architecture for core. Hooks are a separate module.|.:{index.ts,types.ts}|hooks:{AGENTS.md}<!-- BEACON-END -->
