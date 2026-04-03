---
title: Architecture
description: How Beacon works internally
---

Beacon is a single file under 200 lines of TypeScript. This page explains the internal design.

## Module-level state

Four module-level variables drive the reactive system:

```typescript
let currentEffect: Subscriber | null = null    // the effect currently executing
let batchDepth = 0                              // nested batch counter
const pendingEffects = new Set<Subscriber>()    // effects waiting to run
const subscriberDependencies = new WeakMap<Subscriber, Set<Set<Subscriber>>>()
```

- `currentEffect` — set during effect execution so signals know who to register as a subscriber
- `batchDepth` — incremented on batch entry, decremented on exit; effects flush only at 0
- `pendingEffects` — collects effects scheduled by signal writes during a batch
- `subscriberDependencies` — maps each effect to the subscriber sets it joined, enabling cleanup

## Signal anatomy

Each signal is a closure over three things:

1. **`value`** — the current value
2. **`subscribers`** — a `Set<Subscriber>` of effects that depend on this signal
3. **`read`/`write`/`update`** functions — the public API

`read()` checks `currentEffect` and, if present, adds it to `subscribers`. `write()` compares with `Object.is()`, updates the value, copies subscribers to `pendingEffects`, and calls `processEffects()` if not inside a batch.

The signal itself is `Object.assign(read, { set: write, update })` — a function with methods.

## Effect lifecycle

1. **Creation** — `effect(fn)` wraps `fn` in a `runEffect` closure
2. **First run** — `runEffect()` is called immediately:
   - Cleans up any prior subscriptions (`cleanupEffect`)
   - Sets `currentEffect = runEffect`
   - Executes `fn()` — any signal reads register `runEffect` as a subscriber
   - Restores previous `currentEffect`
3. **Re-run** — when a dependency changes, `runEffect` is added to `pendingEffects` and processed
4. **Disposal** — the returned unsubscribe function calls `cleanupEffect`, removing the effect from all subscriber sets

## Effect cleanup

Before each re-run, `cleanupEffect(effect)` removes the effect from every subscriber set it belongs to, then clears the dependency record. This ensures that if the effect reads different signals on the next run, it doesn't keep stale subscriptions.

```typescript
const cleanupEffect = (effect: Subscriber): void => {
  const deps = subscriberDependencies.get(effect)
  if (deps) {
    for (const subscribers of deps) {
      subscribers.delete(effect)
    }
    deps.clear()
  }
}
```

## Effect processing

`processEffects()` drains the `pendingEffects` set in a while loop:

```typescript
const processEffects = (): void => {
  if (pendingEffects.size === 0 || updateInProgress) return
  updateInProgress = true
  while (pendingEffects.size > 0) {
    const currentEffects = [...pendingEffects]
    pendingEffects.clear()
    for (const effect of currentEffects) {
      effect()
    }
  }
  updateInProgress = false
}
```

Key properties:

- **Non-recursive** — the while loop prevents stack overflow from cyclic dependencies
- **Convergent** — if effect A writes to a signal that effect B reads, B is added to `pendingEffects` and processed in the next iteration
- **Guarded** — `updateInProgress` prevents re-entrant calls

## Batch mechanics

`batch()` increments `batchDepth` before running its callback and decrements after. Signal writes still add to `pendingEffects`, but `processEffects()` only runs when `batchDepth` reaches 0.

On error at the outermost batch level (`batchDepth === 1`), pending effects are cleared to prevent stale side effects from executing.

## Derived internals

`derived(fn)` creates a `state(fn())` then an `effect(() => signal.set(fn()))`. This means:

- The derived value is eagerly computed (not lazy)
- It participates in the same subscription/notification system as regular signals
- Chained derived values work because the inner effect is a subscriber to its dependencies
