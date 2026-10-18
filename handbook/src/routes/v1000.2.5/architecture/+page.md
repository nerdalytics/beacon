---
title: Architecture
description: How Beacon works internally
---

<script>
import Version from '#lib/components/Version.svelte'
</script>

Beacon <Version /> is ~633 lines of TypeScript, organized as a `StateImpl` class with static methods. This page covers the internals.

## StateImpl class

A single class holds all tracking state as static properties and exposes static factory methods for signals, effects, and derived values.

## Module-level tracking

Several static properties drive the reactive system:

```typescript
static currentSubscriber: Subscriber | null = null   // the effect currently executing
static batchDepth: number = 0                         // nested batch counter
static pendingSubscribers: Set<Subscriber>             // effects waiting to run
static activeSubscribers: Set<Subscriber>              // effects currently running (re-entrance guard)
static subscriberDependencies: WeakMap<Subscriber, Set<Set<Subscriber>>>
static deferredEffects: Array<() => void>              // effects created inside a batch
```

- `currentSubscriber` is set during effect execution, so signals know which effect to register as a subscriber.
- `batchDepth` is incremented on batch entry and decremented on exit. Effects flush only at 0.
- `pendingSubscribers` collects effects scheduled by signal writes during a batch.
- `activeSubscribers` tracks which effects are currently executing, to prevent re-entrance.
- `subscriberDependencies` maps each effect to the subscriber sets it joined. This mapping enables cleanup.
- `deferredEffects` queues `effect()` calls made inside a `batch()` to run after the batch completes.

## Signal anatomy

Each signal is a closure over three things:

1. **`value`.** The current value.
2. **`subscribers`.** A `Set<Subscriber>` of effects that depend on this signal.
3. **`read`/`write`/`update`.** The public API.

`read()` checks `currentSubscriber` and, if present, adds it to `subscribers`. `write()` compares using `this.equalityFn(this.value, newValue)`, updates the value, and calls `notifySubscribers()`. `Object.assign(read, { set: write, update })` builds the signal: a function with methods.

### Custom equality in StateImpl

`StateImpl` stores `equalityFn` as an instance property, defaulting to `Object.is`. The `set()` method calls `this.equalityFn(this.value, newValue)` instead of the previously hardcoded `Object.is`. When `state()` or `protectedState()` receives an equality function, it passes that function to the `StateImpl` constructor.

## Effect lifecycle

1. **Creation.** `effect(fn)` wraps `fn` in a `runEffect` closure
2. **First run.** Beacon calls `runEffect()` immediately, except inside a batch, which defers the call:
   - Cleans up any prior subscriptions (`cleanupEffect`)
   - Adds `runEffect` to `activeSubscribers` (re-entrance guard)
   - Sets `currentSubscriber = runEffect`
   - Executes `fn()`. Any signal reads register `runEffect` as a subscriber.
   - Removes `runEffect` from `activeSubscribers`
   - Restores previous `currentSubscriber`
3. **Re-run.** When a dependency changes, Beacon adds `runEffect` to `pendingSubscribers` and processes it
4. **Disposal.** The returned unsubscribe function calls `cleanupEffect`, which removes the effect from all subscriber sets

## Re-entrance prevention

Before executing an effect, Beacon checks `activeSubscribers`. If the effect is already in the set, execution is skipped. This prevents infinite recursion when an effect indirectly triggers itself.

## Infinite loop detection

Beacon checks whether the caller of a signal's `write()` method is an effect that subscribes to that signal. If so, it throws:

```
"Infinite loop detected: effect() cannot update a state() it depends on!"
```

This catches the pattern where an effect reads a signal and then writes to it, which would otherwise create an infinite re-run cycle.

## Parent-child effect tracking

When an `effect()` is created inside another running effect, Beacon registers the inner effect as a child of the outer effect. Beacon disposes all child effects when the outer effect re-runs or is disposed. This stops the duplicate inner effects that accumulated in v1.0.0.

## Effect cleanup

Before each re-run, `cleanupEffect(effect)` removes the effect from every subscriber set it belongs to, disposes child effects, then clears the dependency record. A run that reads different signals then leaves no stale subscriptions.

## Subscriber notification

`notifySubscribers()` drains the `pendingSubscribers` set in a while loop:

Key properties:

- **Non-recursive.** The while loop prevents stack overflow from cyclic dependencies.
- **Convergent.** If effect A writes to a signal that effect B reads, B is added to `pendingSubscribers` and processed in the next iteration.
- **Guarded.** `activeSubscribers` prevents re-entrant calls.
- **Deferred awareness.** Effects created inside a batch wait in `deferredEffects` and run only when the outermost batch completes.

## Batch mechanics

`batch()` increments `batchDepth` before running its callback and decrements after. Signal writes still add to `pendingSubscribers`, but `notifySubscribers()` only runs when `batchDepth` reaches 0.

When the outermost batch completes, two things happen in order:

1. Deferred effects (from `effect()` calls inside the batch) are initialized
2. Pending subscribers are flushed

Both steps swap the current collection reference (`deferredEffectCreations` array or `pendingSubscribers` Set) for a fresh empty one, then iterate the old one directly. This avoids the `[...spread]` and `Array.from()` allocations that the previous implementation made during flush. The optimization matters most in batches that create many effects or notify many subscribers.

On an error at the outermost batch level, Beacon clears pending effects and deferred effects.

## Derive internals

`derive(computeFn)` creates an internal signal and an effect that keeps it in sync. Key differences from v1.0.0:

- **Lazy initialization.** The computation does not run until the derived value is first read or a dependency change triggers an update
- **Read-only.** The returned signal exposes only the read function, not `.set()` or `.update()`.
- **Same-value optimization.** If the recomputed value is identical (via `Object.is()`), Beacon does not notify downstream subscribers.

## WeakMap-based dependency tracking

`subscriberDependencies` is a `WeakMap`. When the garbage collector reclaims an effect, it also reclaims that effect's dependency data. Long-lived applications that create and dispose many effects over time do not leak memory.

## Lens internals

`lens(source, accessor)` creates a writable `State<K>` bound to a nested property of `source`. The implementation has three parts:

### Proxy-based path extraction

At creation time, `lens()` passes a `Proxy` to the accessor function. The Proxy intercepts property accesses and records the path (e.g., `['server', 'host']`). Beacon captures the path once and reuses it for all later reads and writes.

Array index access works the same way. `(s) => s.items[1]` captures the path `['items', 1]`.

### Bidirectional sync

An internal effect watches the source and updates the lens state whenever the value at the captured path changes. A `.set()` call on the lens rebuilds the source object immutably, from the leaf to the root, and sets the new value at the captured path.

### Circular update guard

An `isUpdating` flag prevents the source-to-lens sync effect from firing when the lens itself initiated the source update. Without this guard, writing to the lens would trigger the sync effect, which would detect a "change" and attempt to update the lens again.
