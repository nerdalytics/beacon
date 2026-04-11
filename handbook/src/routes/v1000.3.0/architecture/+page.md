---
title: Architecture
description: How Beacon works internally
---

<script>
import Version from '$lib/components/Version.svelte'
</script>

Beacon <Version /> is ~544 lines of TypeScript, organized as standalone top-level functions. The `StateImpl` class from prior versions has been eliminated entirely. This page covers the internals.

## Standalone functions

All logic lives in top-level functions rather than a class. The internal functions are:

- `createState` — creates a readable and writable signal
- `createEffect` — registers a reactive side effect
- `createDerive` — computes a read-only value from other signals
- `executeBatch` — groups updates so effects run once
- `createSelect` — subscribes to a computed slice of state
- `createLens` — two-way binding to a nested property
- `createProtectedState` — separates read and write into a tuple
- `createReadonlyState` — hides the write methods on a state

Public API exports use aliasing:

```typescript
export { createState as state, createDerive as derive, createEffect as effect,
         executeBatch as batch, createSelect as select, createLens as lens,
         createProtectedState as protectedState, createReadonlyState as readonlyState }
```

The motivation is tree-shaking. Bundlers can statically analyze standalone function exports and eliminate any that are unused. A class with static methods cannot be split — the entire class ships regardless of which methods the consumer calls.

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

- `currentSubscriber` — set during effect execution so signals know who to register as a subscriber
- `batchDepth` — incremented on batch entry, decremented on exit; effects flush only at 0
- `pendingSubscribers` — collects effects scheduled by signal writes during a batch
- `activeSubscribers` — tracks which effects are currently executing to prevent re-entrance
- `subscriberDependencies` — maps each effect to the subscriber sets it joined, enabling cleanup
- `deferredEffects` — queues `effect()` calls made inside a `batch()` for execution after the batch completes

## Signal anatomy

Each signal is a closure over three things:

1. **`value`** — the current value
2. **`subscribers`** — a `Set<Subscriber>` of effects that depend on this signal
3. **`read`/`write`/`update`** functions — the public API

`read()` checks `currentSubscriber` and, if present, adds it to `subscribers`. `write()` compares using `equalityFn(value, newValue)`, updates the value, and calls `notifySubscribers()`. The signal itself is `Object.assign(read, { set: write, update })` — a function with methods.

### Custom equality

`createState` accepts an optional `equalityFn` parameter, defaulting to `Object.is`. The `set()` closure calls `equalityFn(value, newValue)` to decide whether to notify. When `state()` or `protectedState()` receives an equality function, it is passed through to `createState`.

## Effect lifecycle

1. **Creation** — `createEffect(fn)` wraps `fn` in a `runEffect` closure
2. **First run** — `runEffect()` is called immediately (unless inside a batch, where it is deferred):
   - Cleans up any prior subscriptions (`cleanupEffect`)
   - Adds `runEffect` to `activeSubscribers` (re-entrance guard)
   - Sets `currentSubscriber = runEffect`
   - Executes `fn()` — any signal reads register `runEffect` as a subscriber
   - Removes `runEffect` from `activeSubscribers`
   - Restores previous `currentSubscriber`
3. **Re-run** — when a dependency changes, `runEffect` is added to `pendingSubscribers` and processed
4. **Disposal** — the returned unsubscribe function calls `cleanupEffect`, removing the effect from all subscriber sets

## Re-entrance prevention

Before executing an effect, Beacon checks `activeSubscribers`. If the effect is already in the set, execution is skipped. This prevents infinite recursion when an effect indirectly triggers itself.

## Infinite loop detection

When a signal's `write()` closure is called, Beacon checks whether the caller is an effect that subscribes to that signal. If so, it throws:

```
"Infinite loop detected: effect() cannot update a state() it depends on!"
```

This catches the pattern where an effect reads a signal and then writes to it, which would otherwise create an infinite re-run cycle.

## Parent-child effect tracking

When an `effect()` is created inside another running effect, the inner effect is registered as a child of the outer effect. When the outer effect is cleaned up (either by re-run or disposal), all child effects are also disposed. This prevents the accumulation of duplicate inner effects that occurred in v1.0.0.

## Effect cleanup

Before each re-run, `cleanupEffect(effect)` removes the effect from every subscriber set it belongs to, disposes child effects, then clears the dependency record. This ensures that if the effect reads different signals on the next run, it doesn't keep stale subscriptions.

## Subscriber notification

`notifySubscribers()` drains the `pendingSubscribers` set in a while loop:

Key properties:

- **Non-recursive** — the while loop prevents stack overflow from cyclic dependencies
- **Convergent** — if effect A writes to a signal that effect B reads, B is added to `pendingSubscribers` and processed in the next iteration
- **Guarded** — `activeSubscribers` prevents re-entrant calls
- **Deferred awareness** — effects created inside a batch are held in `deferredEffects` and only executed when the outermost batch completes

## Batch mechanics

`executeBatch()` increments `batchDepth` before running its callback and decrements after. Signal writes still add to `pendingSubscribers`, but `notifySubscribers()` only runs when `batchDepth` reaches 0.

When the outermost batch completes, two things happen in order:

1. Deferred effects (from `effect()` calls inside the batch) are initialized
2. Pending subscribers are flushed

Both steps use a swap-instead-of-copy pattern: the current collection reference (`deferredEffects` array or `pendingSubscribers` Set) is swapped to a fresh empty collection, and the old collection is iterated directly. This avoids `[...spread]` and `Array.from()` allocations that the previous implementation used during flush. The optimization matters most in batches that create many effects or notify many subscribers.

On error at the outermost batch level, pending effects and deferred effects are both cleared.

## Derive internals

`createDerive(computeFn)` creates an internal signal and an effect that keeps it in sync. Key differences from v1.0.0:

- **Lazy initialization** — the computation does not run until the derived value is first read or a dependency change triggers an update
- **Read-only** — the returned signal exposes only the read function, not `.set()` or `.update()`
- **Same-value optimization** — if the recomputed value is identical (via `Object.is()`), downstream subscribers are not notified

## WeakMap-based dependency tracking

`subscriberDependencies` is a `WeakMap`. When an effect is garbage collected, its dependency tracking data is collected with it. Long-lived applications that create and dispose many effects over time do not leak memory.

## Lens internals

`createLens(source, accessor)` creates a writable `State<K>` bound to a nested property of `source`. The implementation has three parts:

### Proxy-based path extraction

At creation time, `createLens()` passes a `Proxy` to the accessor function. The Proxy intercepts property accesses and records the path (e.g., `['server', 'host']`). This happens once — the path is captured and reused for all subsequent reads and writes.

Array index access works the same way. `(s) => s.items[1]` captures the path `['items', 1]`.

### Bidirectional sync

An internal effect watches the source and updates the lens state whenever the value at the captured path changes. When the lens is written to via `.set()`, it immutably reconstructs the source object from the leaf to the root, setting the new value at the captured path.

### Circular update guard

An `isUpdating` flag prevents the source-to-lens sync effect from firing when the lens itself initiated the source update. Without this guard, writing to the lens would trigger the sync effect, which would detect a "change" and attempt to update the lens again.
