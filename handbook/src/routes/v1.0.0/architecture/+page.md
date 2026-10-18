---
title: Architecture
description: How Beacon works internally
---

Beacon is one TypeScript file under 200 lines. This page explains how the internals work.

## Module-level state

Four module-level variables drive the reactive system:

```typescript
let currentEffect: Subscriber | null = null    // the effect currently executing
let batchDepth = 0                              // nested batch counter
const pendingEffects = new Set<Subscriber>()    // effects waiting to run
const subscriberDependencies = new WeakMap<Subscriber, Set<Set<Subscriber>>>()
```

- Beacon sets `currentEffect` during effect execution, so each signal knows which effect to register as a subscriber
- `batchDepth` increases on batch entry and decreases on exit. Effects flush only when it reaches 0
- `pendingEffects` collects effects that signal writes schedule during a batch
- `subscriberDependencies` maps each effect to the subscriber sets it joined. This mapping enables cleanup

## Signal anatomy

Each signal is a closure over three things:

1. **`value`** holds the current value.
2. **`subscribers`** is a `Set<Subscriber>` of effects that depend on this signal.
3. **`read`/`write`/`update`** are the public API functions.

`read()` checks `currentEffect` and, if present, adds it to `subscribers`. `write()` compares the new value with `Object.is()` and updates it. It copies subscribers to `pendingEffects` and calls `processEffects()` if not inside a batch.

The signal itself is `Object.assign(read, { set: write, update })`, a function with methods.

## Effect lifecycle

1. **Creation.** `effect(fn)` wraps `fn` in a `runEffect` closure
2. **First run.** `runEffect()` is called immediately:
   - Cleans up any prior subscriptions (`cleanupEffect`)
   - Sets `currentEffect = runEffect`
   - Executes `fn()`. Any signal reads register `runEffect` as a subscriber
   - Restores previous `currentEffect`
3. **Re-run.** When a dependency changes, `runEffect` is added to `pendingEffects` and processed
4. **Disposal.** The returned unsubscribe function calls `cleanupEffect`, which removes the effect from all subscriber sets

## Effect cleanup

Before each re-run, `cleanupEffect(effect)` removes the effect from every subscriber set it belongs to, then clears the dependency record. This stops stale subscriptions when the effect reads different signals on the next run.

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

`processEffects()` empties the `pendingEffects` set in a while loop:

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

- **Non-recursive.** The while loop prevents stack overflow from cyclic dependencies
- **Convergent.** If effect A writes to a signal that effect B reads, B is added to `pendingEffects` and processed in the next iteration
- **Guarded.** `updateInProgress` prevents re-entrant calls

## Batch mechanics

`batch()` increments `batchDepth` before running its callback and decrements after. Signal writes still add to `pendingEffects`, but `processEffects()` only runs when `batchDepth` reaches 0.

On error at the outermost batch level (`batchDepth === 1`), Beacon clears pending effects to prevent stale side effects from running.

## Derived internals

`derived(fn)` creates a `state(fn())`, then an `effect(() => signal.set(fn()))`. This means:

- The derived value is computed eagerly, not lazily
- It participates in the same subscription/notification system as regular signals
- Chained derived values work because the inner effect is a subscriber to its dependencies
