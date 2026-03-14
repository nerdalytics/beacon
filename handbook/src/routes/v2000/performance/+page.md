---
title: Performance
description: Performance characteristics and optimization tips
---

# Performance

Beacon is a ~900-line reactive system with zero external dependencies. No virtual DOM diffing, no compiler pass, no framework overhead. Updates propagate through a dependency graph directly to the effects that need them.

## What makes Beacon fast

### Fine-grained tracking

Dependencies are tracked at the property level. When `state.count` changes, only effects that read `count` re-run — not effects that read `name` or `age` on the same object.

### Direct property access

Beacon uses direct property access instead of `Reflect.get`/`Reflect.set`:

```typescript
// Slow (~100x overhead)
Reflect.get(target, prop, receiver)
Reflect.set(target, prop, value, receiver)

// Fast (what Beacon uses)
target[prop]
target[prop] = value
```

### Value equality checks

Every mutation is compared with `Object.is()`. If the value hasn't changed, nothing happens — no subscriber notifications, no effect re-runs.

### Proxy caching

Each object gets exactly one Proxy. Passing the same object to `state()` twice returns the same Proxy instance.

## Batch optimization

Without batch, each mutation triggers its own propagation cycle:

```typescript
s.a = 1  // effects run
s.b = 2  // effects run again
s.c = 3  // effects run a third time
```

With batch, all mutations apply first, then effects run once:

```typescript
batch(() => {
  s.a = 1
  s.b = 2
  s.c = 3
})
// effects run once with final state
```

### Batch fast path

During batch, the set handler takes a fast path when there are no write hooks and no active effect:

1. Skip subscriber scheduling entirely
2. Track dirty target-property pairs in `dirtyTargets`
3. At batch end, call `scheduleSubscribersForTarget` once per unique property
4. Run all deferred effects, then flush once

This reduces N notification cycles to one.

### Derive + batch interaction

A derive that depends on multiple sources recomputes once per batch, not once per source change:

```typescript
const total = derive(() => s.a + s.b + s.c)

// Without batch: 3 recomputations
s.a = 10
s.b = 20
s.c = 30

// With batch: 1 recomputation
batch(() => {
  s.a = 10
  s.b = 20
  s.c = 30
})
```

## Stable dependency skip

On effect re-runs, dependencies are compared against the previous run. If they haven't changed:

- Previous tracking structures are restored — no subscriber set teardown or rebuild
- Subsequent runs use `trackingOnly` mode, skipping `getSubscribers` + `Set.add` in proxy handlers

This matters for effects with stable dependency patterns that re-run frequently.

## Memory considerations

### WeakMap-based storage

All tracking maps use WeakMaps. When a state object is garbage collected, its tracking data goes with it. No manual cleanup needed.

### Non-enumerable metadata

Internal metadata uses Symbols, so it doesn't appear in `Object.keys()`, `JSON.stringify()`, or `for...in` loops.

### Subscription cleanup

When an effect is disposed:

- `cleanupEffect()` removes it from all subscriber sets and clears previous dependency snapshots
- `cleanupEffectCompletely()` also recursively cleans up child effects
- Nested effects are automatically cleaned up when parent effects re-run

### Derive disposal

Each `derive()` creates an internal state + effect pair. Undisposed derives leak memory. Always call the dispose function when a derived value is no longer needed.

## Inherent trade-offs

Proxy-based reactivity has a fixed overhead:

- Every property access goes through a proxy trap (~12x slower than direct access)
- V8 JIT cannot optimize away proxy traps
- Polymorphic handlers cause deoptimization in hot paths

For most applications, this overhead is negligible. If you're doing millions of property accesses in a tight loop, consider reading the value once into a local variable.

| Metric | v1000 (Function-based) | v2000 (Proxy-based) |
|--------|------------------------|---------------------|
| Batch (1M updates) | 19ms | 36ms |
| Unbatched (1M updates) | 362ms | 671ms |
| Syntax | `state()`, `state.set()` | `state.value` |
