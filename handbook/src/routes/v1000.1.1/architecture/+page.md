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

- Beacon sets `currentSubscriber` during effect execution, so signals know which effect to register as a subscriber.
- Beacon increments `batchDepth` on batch entry and decrements it on exit. Effects flush only when it reaches 0.
- `pendingSubscribers` collects effects scheduled by signal writes during a batch.
- `activeSubscribers` tracks which effects are currently executing, which prevents re-entrance.
- `subscriberDependencies` maps each effect to the subscriber sets it joined, which enables cleanup.
- `deferredEffects` queues `effect()` calls made inside a `batch()` for execution after the batch completes.

## Signal anatomy

Each signal is a closure over three things:

1. The current `value`.
2. `subscribers`, a `Set<Subscriber>` of effects that depend on this signal.
3. The `read`, `write`, and `update` functions, which form the public API.

`read()` checks `currentSubscriber` and, if present, adds it to `subscribers`. `write()` compares with `Object.is()`, updates the value, and calls `notifySubscribers()`. The signal itself is `Object.assign(read, { set: write, update })`, a function with methods.

## Effect lifecycle

1. **Creation.** `effect(fn)` wraps `fn` in a `runEffect` closure.
2. **First run.** `runEffect()` is called immediately, unless it runs inside a batch, where it is deferred:
   - Cleans up any prior subscriptions (`cleanupEffect`)
   - Adds `runEffect` to `activeSubscribers` (re-entrance guard)
   - Sets `currentSubscriber = runEffect`
   - Executes `fn()`. Any signal reads register `runEffect` as a subscriber.
   - Removes `runEffect` from `activeSubscribers`
   - Restores the previous `currentSubscriber`
3. **Re-run.** When a dependency changes, `runEffect` is added to `pendingSubscribers` and processed.
4. **Disposal.** The returned unsubscribe function calls `cleanupEffect`, which removes the effect from all subscriber sets.

## Re-entrance prevention

Before executing an effect, Beacon checks `activeSubscribers`. If the effect is already in the set, execution is skipped. This prevents infinite recursion when an effect indirectly triggers itself.

## Infinite loop detection

When a signal's `write()` method is called, Beacon checks whether the caller is an effect that subscribes to that signal. If so, it throws:

```
"Infinite loop detected: effect() cannot update a state() it depends on!"
```

This catches the pattern where an effect reads a signal and then writes to it. Without the check, that pattern creates an infinite re-run cycle.

## Parent-child effect tracking

When an `effect()` is created inside another running effect, Beacon registers the inner effect as a child of the outer effect. When the outer effect is cleaned up, by a re-run or by disposal, Beacon also disposes all child effects. This prevents the accumulation of duplicate inner effects that occurred in v1.0.0.

## Effect cleanup

Before each re-run, `cleanupEffect(effect)` removes the effect from every subscriber set it belongs to, disposes child effects, then clears the dependency record. If the effect reads different signals on the next run, it does not keep stale subscriptions.

## Subscriber notification

`notifySubscribers()` drains the `pendingSubscribers` set in a while loop:

Key properties:

- **Non-recursive.** The while loop prevents stack overflow from cyclic dependencies.
- **Convergent.** If effect A writes to a signal that effect B reads, B is added to `pendingSubscribers` and processed in the next iteration.
- **Guarded.** `activeSubscribers` prevents re-entrant calls.
- **Deferred awareness.** Effects created inside a batch are held in `deferredEffects` and run only when the outermost batch completes.

## Batch mechanics

`batch()` increments `batchDepth` before running its callback and decrements it after. Signal writes still add to `pendingSubscribers`, but `notifySubscribers()` runs only when `batchDepth` reaches 0.

When the outermost batch completes, two things happen in order:

1. Deferred effects (from `effect()` calls inside the batch) are initialized.
2. Pending subscribers are flushed.

On an error at the outermost batch level, Beacon clears both pending effects and deferred effects.

## Derive internals

`derive(computeFn)` creates an internal signal and an effect that keeps it in sync. Key differences from v1.0.0:

- **Lazy initialization.** The computation does not run until the derived value is first read or a dependency change triggers an update.
- **Read-only.** The returned signal exposes only the read function, not `.set()` or `.update()`.
- **Same-value optimization.** If the recomputed value is identical (via `Object.is()`), downstream subscribers are not notified.

## WeakMap-based dependency tracking

`subscriberDependencies` is a `WeakMap`. When an effect is garbage collected, its dependency tracking data is collected with it. Long-lived applications that create and dispose many effects over time do not leak memory.

## Lens internals

`lens(source, accessor)` creates a writable `State<K>` bound to a nested property of `source`. The implementation has three parts:

### Proxy-based path extraction

At creation time, `lens()` passes a `Proxy` to the accessor function. The Proxy intercepts property accesses and records the path (e.g., `['server', 'host']`). This happens once. `lens()` reuses that path for all subsequent reads and writes.

Array index access works the same way. `(s) => s.items[1]` captures the path `['items', 1]`.

### Bidirectional sync

An internal effect watches the source and updates the lens state whenever the value at the captured path changes. When you call `.set()` on the lens, Beacon immutably reconstructs the source object from the leaf to the root and sets the new value at the captured path.

### Circular update guard

An `isUpdating` flag prevents the source-to-lens sync effect from firing when the lens itself initiated the source update. Without this guard, writing to the lens would trigger the sync effect, which would detect a "change" and attempt to update the lens again.
