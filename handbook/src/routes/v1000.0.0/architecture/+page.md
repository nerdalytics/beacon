---
title: Architecture
description: How Beacon works internally
---

<script>
import Version from '#lib/components/Version.svelte'
</script>

Beacon <Version /> is about 427 lines of TypeScript. It uses a `StateImpl` class with static methods. This page covers the internals.

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

- Beacon sets `currentSubscriber` while an effect runs, so signals know which effect to register as a subscriber.
- Beacon increments `batchDepth` on batch entry and decrements it on exit. Effects flush only when it reaches 0.
- `pendingSubscribers` collects effects scheduled by signal writes during a batch.
- `activeSubscribers` tracks running effects, which blocks re-entrance.
- `subscriberDependencies` maps each effect to the subscriber sets it joined, so cleanup can find them.
- `deferredEffects` queues `effect()` calls made inside a `batch()` for execution after the batch completes.

## Signal anatomy

Each signal is a closure over three things:

1. `value` holds the current value.
2. `subscribers` is a `Set<Subscriber>` that holds the effects depending on this signal.
3. `read`, `write`, and `update` are the public API functions.

`read()` checks `currentSubscriber`. If one is set, it adds that subscriber to `subscribers`. `write()` compares values with `Object.is()`, updates the value, and calls `notifySubscribers()`. The signal is `Object.assign(read, { set: write, update })`, which makes it a function with methods.

## Effect lifecycle

1. **Creation.** `effect(fn)` wraps `fn` in a `runEffect` closure.
2. **First run.** Beacon calls `runEffect()` immediately, unless a batch is open. In that case Beacon defers the call:
   - Cleans up any prior subscriptions (`cleanupEffect`)
   - Adds `runEffect` to `activeSubscribers` (re-entrance guard)
   - Sets `currentSubscriber = runEffect`
   - Executes `fn()`. Any signal reads register `runEffect` as a subscriber.
   - Removes `runEffect` from `activeSubscribers`
   - Restores previous `currentSubscriber`
3. **Re-run.** When a dependency changes, Beacon adds `runEffect` to `pendingSubscribers` and processes it.
4. **Disposal.** The returned unsubscribe function calls `cleanupEffect`, which removes the effect from all subscriber sets.

## Re-entrance prevention

Before running an effect, Beacon checks `activeSubscribers`. If the effect is already in the set, Beacon skips the run. This prevents infinite recursion when an effect triggers itself indirectly.

## Infinite loop detection

When a signal's `write()` method is called, Beacon checks whether the caller is an effect that subscribes to that signal. If so, it throws:

```
"Infinite loop detected: effect() cannot update a state() it depends on!"
```

This catches an effect that reads a signal and then writes to it. Without this check, the effect would re-run forever.

## Parent-child effect tracking

When Beacon creates an `effect()` inside a running effect, it registers the inner effect as a child of the outer one. Cleaning up the outer effect, on re-run or on disposal, also disposes all of its child effects. This prevents the duplicate inner effects that piled up in v1.0.0.

## Effect cleanup

Before each re-run, `cleanupEffect(effect)` removes the effect from every subscriber set it belongs to, disposes child effects, then clears the dependency record. This ensures the effect keeps no stale subscriptions when it reads different signals on the next run.

## Subscriber notification

`notifySubscribers()` drains the `pendingSubscribers` set in a while loop:

Key properties:

- **Non-recursive.** The while loop prevents a stack overflow from cyclic dependencies.
- **Convergent.** If effect A writes to a signal that effect B reads, Beacon adds B to `pendingSubscribers`, and the next loop iteration processes it.
- **Guarded.** `activeSubscribers` prevents re-entrant calls.
- **Deferred.** Beacon holds effects created inside a batch in `deferredEffects`. It runs them only when the outermost batch completes.

## Batch mechanics

`batch()` increments `batchDepth` before running its callback and decrements after. Signal writes still add to `pendingSubscribers`, but `notifySubscribers()` only runs when `batchDepth` reaches 0.

When the outermost batch completes, Beacon does two things in order:

1. It initializes the deferred effects, which come from `effect()` calls inside the batch.
2. It flushes the pending subscribers.

If the outermost batch throws, Beacon clears both the pending effects and the deferred effects.

## Derive internals

`derive(computeFn)` creates an internal signal and an effect that keeps it in sync. Key differences from v1.0.0:

- **Lazy initialization.** The computation does not run until something first reads the derived value or a dependency change triggers an update.
- **Read-only.** The returned signal exposes only the read function, not `.set()` or `.update()`.
- **Same-value check.** If the recomputed value is identical by `Object.is()`, Beacon does not notify downstream subscribers.

## WeakMap-based dependency tracking

`subscriberDependencies` is a `WeakMap`. When an effect is garbage collected, its dependency tracking data is collected with it. Long-lived applications that create and dispose many effects over time do not leak memory.
