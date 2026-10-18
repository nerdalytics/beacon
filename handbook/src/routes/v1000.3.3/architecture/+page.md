---
title: Architecture
description: How Beacon works internally
---

<script>
import Version from '#lib/components/Version.svelte'
</script>

Beacon <Version /> is about 489 lines of TypeScript, organized as standalone top-level functions. This release eliminates the `StateImpl` class from prior versions entirely. This page covers the internals.

## Standalone functions

All logic is in top-level functions rather than a class. The internal functions are:

- `createState` creates a readable and writable signal
- `createEffect` registers a reactive side effect
- `createDerive` computes a read-only value from other signals
- `executeBatch` groups updates so effects run once
- `createSelect` subscribes to a computed slice of state
- `createLens` creates a two-way binding to a nested property
- `createProtectedState` separates read and write into a tuple
- `createReadonlyState` hides the write methods on a state

Public API exports use aliasing:

```typescript
export { createState as state, createDerive as derive, createEffect as effect,
         executeBatch as batch, createSelect as select, createLens as lens,
         createProtectedState as protectedState, createReadonlyState as readonlyState }
```

The motivation is tree-shaking. Bundlers can statically analyze standalone function exports and eliminate any that are unused. A class with static methods cannot be split. The entire class ships regardless of which methods the consumer calls.

## Module-level tracking

Tracking state lives in top-level `let`/`const` declarations instead of class static properties:

```typescript
let currentSubscriber: Subscriber | null = null    // the effect currently executing
let batchDepth: number = 0                          // nested batch counter
let pendingSubscribers: Set<Subscriber>              // effects waiting to run
const activeSubscribers: Set<Subscriber>             // effects currently running (re-entrance guard)
const subscriberDependencies: WeakMap<Subscriber, Set<Set<Subscriber>>>
let deferredEffects: Array<() => void>               // effects created inside a batch
```

- Beacon sets `currentSubscriber` during effect execution, so signals know which effect to register as a subscriber.
- Beacon increments `batchDepth` on batch entry and decrements it on exit. Effects flush only when it reaches 0.
- `pendingSubscribers` collects the effects that signal writes schedule during a batch.
- `activeSubscribers` tracks which effects are currently executing, to prevent re-entrance.
- `subscriberDependencies` maps each effect to the subscriber sets it joined, so cleanup can find them.
- `deferredEffects` queues `effect()` calls made inside a `batch()` for execution after the batch completes.

## Signal anatomy

Each signal is a closure over three things:

1. `value` holds the current value.
2. `subscribers` holds a `Set<Subscriber>` of the effects that depend on this signal.
3. `read`, `write`, and `update` are the public API functions.

`read()` checks `currentSubscriber` and, if present, adds it to `subscribers`. `write()` compares using `equalityFn(value, newValue)`, updates the value, and calls `notifySubscribers()`. The signal itself is `Object.assign(read, { set: write, update })`. It is a function with methods.

### Custom equality

`createState` accepts an optional `equalityFn` parameter, defaulting to `Object.is`. The `set()` closure calls `equalityFn(value, newValue)` to decide whether to notify. When `state()` or `protectedState()` receives an equality function, it passes that function to `createState`.

## Effect lifecycle

1. **Creation.** `createEffect(fn)` wraps `fn` in a `runEffect` closure.
2. **First run.** Beacon calls `runEffect()` immediately. Inside a batch, Beacon defers the call instead:
   - Cleans up prior subscriptions with `cleanupEffect`
   - Adds `runEffect` to `activeSubscribers` (re-entrance guard)
   - Sets `currentSubscriber = runEffect`
   - Executes `fn()`. Any signal reads register `runEffect` as a subscriber.
   - Removes `runEffect` from `activeSubscribers`
   - Restores previous `currentSubscriber`
3. **Re-run.** When a dependency changes, Beacon adds `runEffect` to `pendingSubscribers` and processes it.
4. **Disposal.** The returned unsubscribe function calls `cleanupEffect`, which removes the effect from all subscriber sets.

## Re-entrance prevention

Before executing an effect, Beacon checks `activeSubscribers`. If the effect is already in the set, Beacon skips execution. This prevents infinite recursion when an effect indirectly triggers itself.

## Infinite loop detection

When a signal's `write()` closure is called, Beacon checks whether the caller is an effect that subscribes to that signal. If so, it throws:

```
"Infinite loop detected: effect() cannot update a state() it depends on!"
```

This catches the pattern where an effect reads a signal and then writes to it, which would otherwise create an infinite re-run cycle.

## Parent-child effect tracking

When an `effect()` is created inside another running effect, the inner effect is registered as a child of the outer effect. When the outer effect is cleaned up (either by re-run or disposal), Beacon also disposes all child effects. This prevents the accumulation of duplicate inner effects that occurred in v1.0.0.

## Effect cleanup

Before each re-run, `cleanupEffect(effect)` removes the effect from every subscriber set it belongs to, disposes child effects, then clears the dependency record. So an effect that reads different signals on its next run does not keep stale subscriptions.

## Subscriber notification

`notifySubscribers()` drains the `pendingSubscribers` set in a while loop:

Key properties:

- **Non-recursive.** The while loop prevents stack overflow from cyclic dependencies.
- **Convergent.** If effect A writes to a signal that effect B reads, Beacon adds B to `pendingSubscribers`, and the next iteration processes it.
- **Guarded.** `activeSubscribers` prevents re-entrant calls.
- **Deferred awareness.** Effects created inside a batch are held in `deferredEffects` and run only when the outermost batch completes.

## Batch mechanics

`executeBatch()` increments `batchDepth` before running its callback and decrements it after. Signal writes still add to `pendingSubscribers`, but `notifySubscribers()` only runs when `batchDepth` reaches 0.

When the outermost batch completes, two things happen in order:

1. Beacon initializes the deferred effects (from `effect()` calls inside the batch).
2. Beacon flushes the pending subscribers.

Both steps use a swap-instead-of-copy pattern. Each step swaps the current collection (the `deferredEffects` array or the `pendingSubscribers` Set) for a fresh empty one. It then iterates the old one directly. This avoids the `[...spread]` and `Array.from()` allocations that the previous implementation used during flush. The gain is largest in batches that create many effects or notify many subscribers.

If the callback throws at the outermost batch level, Beacon clears both the pending effects and the deferred effects.

## Derive internals

`createDerive(computeFn)` creates an internal signal and an effect that keeps it in sync. Key differences from v1.0.0:

- **Lazy initialization.** The computation does not run until the derived value is first read or a dependency change triggers an update.
- **Read-only.** The returned signal exposes only the read function, not `.set()` or `.update()`.
- **Same-value optimization.** If the recomputed value is identical by `Object.is()`, Beacon does not notify downstream subscribers.

## WeakMap-based dependency tracking

`subscriberDependencies` is a `WeakMap`. When the garbage collector reclaims an effect, it also reclaims that effect's dependency tracking data. Long-lived applications that create and dispose many effects do not leak memory.

## Lens internals

`createLens(source, accessor)` creates a writable `State<K>` bound to a nested property of `source`. The implementation has three parts.

### Proxy-based path extraction

At creation time, `createLens()` passes a `Proxy` to the accessor function. The Proxy intercepts property accesses and records the path, such as `['server', 'host']`. This happens once. Beacon captures the path and reuses it for all later reads and writes.

Array index access works the same way. `(s) => s.items[1]` captures the path `['items', 1]`.

### Bidirectional sync

An internal effect watches the source and updates the lens state whenever the value at the captured path changes. When code calls `.set()` on the lens, Beacon rebuilds the source object immutably from the leaf to the root. It sets the new value at the captured path.

### Circular update guard

An `isUpdating` flag prevents the source-to-lens sync effect from firing when the lens itself initiated the source update. Without this guard, writing to the lens would trigger the sync effect. That effect would detect a "change" and try to update the lens again.
