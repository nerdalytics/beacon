---
title: Architecture
description: How Beacon works internally
---

<script>
import Version from '$lib/components/Version.svelte'
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

`read()` checks `currentSubscriber` and, if present, adds it to `subscribers`. `write()` compares with `Object.is()`, updates the value, and calls `notifySubscribers()`. The signal itself is `Object.assign(read, { set: write, update })` — a function with methods.

## Effect lifecycle

1. **Creation** — `effect(fn)` wraps `fn` in a `runEffect` closure
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

When a signal's `write()` method is called, Beacon checks whether the caller is an effect that subscribes to that signal. If so, it throws:

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

`batch()` increments `batchDepth` before running its callback and decrements after. Signal writes still add to `pendingSubscribers`, but `notifySubscribers()` only runs when `batchDepth` reaches 0.

When the outermost batch completes, two things happen in order:

1. Deferred effects (from `effect()` calls inside the batch) are initialized
2. Pending subscribers are flushed

On error at the outermost batch level, pending effects and deferred effects are both cleared.

## Derive internals

`derive(computeFn)` creates an internal signal and an effect that keeps it in sync. Key differences from v1.0.0:

- **Lazy initialization** — the computation does not run until the derived value is first read or a dependency change triggers an update
- **Read-only** — the returned signal exposes only the read function, not `.set()` or `.update()`
- **Same-value optimization** — if the recomputed value is identical (via `Object.is()`), downstream subscribers are not notified

## WeakMap-based dependency tracking

`subscriberDependencies` is a `WeakMap`. When an effect is garbage collected, its dependency tracking data is collected with it. Long-lived applications that create and dispose many effects over time do not leak memory.

## Lens internals

`lens(source, accessor)` creates a writable `State<K>` bound to a nested property of `source`. The implementation has three parts:

### Proxy-based path extraction

At creation time, `lens()` passes a `Proxy` to the accessor function. The Proxy intercepts property accesses and records the path (e.g., `['server', 'host']`). This happens once — the path is captured and reused for all subsequent reads and writes.

Array index access works the same way. `(s) => s.items[1]` captures the path `['items', 1]`.

### Bidirectional sync

An internal effect watches the source and updates the lens state whenever the value at the captured path changes. When the lens is written to via `.set()`, it immutably reconstructs the source object from the leaf to the root, setting the new value at the captured path.

### Circular update guard

An `isUpdating` flag prevents the source-to-lens sync effect from firing when the lens itself initiated the source update. Without this guard, writing to the lens would trigger the sync effect, which would detect a "change" and attempt to update the lens again.
