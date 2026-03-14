---
title: Performance
description: Performance characteristics and optimization tips
---


Beacon is a reactive system with zero external dependencies. Updates propagate through a dependency graph directly to the effects that need them.

## Benchmark results

All numbers below are real: 1,000,000 iterations, 3 warm-up cycles × 7 measurement samples, median reported. Run on the same machine, back-to-back.

### End-to-end scenarios

| Scenario | v1000 med | v2000 med | Δ |
|---|---|---|---|
| classic loop | 4.09ms | 4.20ms | +3% (baseline noise) |
| state no subs | 16.22ms | 73.57ms | +354% — v2000 slower |
| state + derive | 654.22ms | 500.30ms | −24% — v2000 faster |
| state + derive + 2 effects | 1639.16ms | 966.11ms | −41% — v2000 faster |
| batch + derive | 34.63ms | 102.21ms | +195% — v2000 slower |
| batch + derive + 2 effects | 40.62ms | 102.91ms | +153% — v2000 slower |

### Targeted operations

| Operation | v1000 med | v2000 med | Δ |
|---|---|---|---|
| state creation | 11.41ms | 51.66ms | +353% — v2000 slower |
| state read (no effect) | 4.71ms | 38.52ms | +718% — v2000 slower |
| state write 1 sub | 64.26ms | 44.81ms | −30% — v2000 faster |
| state write 100 subs | 525.42ms | 216.39ms | −59% — v2000 faster |
| effect triggers | 32.23ms | 27.03ms | −16% — v2000 faster |
| many dependencies | 3.41ms | 4.62ms | +35% (within noise) |
| derive chain depth 10 | 9.52ms | 8.27ms | −13% — v2000 slightly faster |
| 100 states individual | 160.22ms | 62.91ms | −61% — v2000 faster |
| 100 states batched | 3.36ms | 3.95ms | +18% (within noise) |

**Total benchmark suite time: v1000 = 67.7s, v2000 = 46.2s**

### Memory

v2000 batch memory usage is dramatically lower. Where v1000 holds 13,780–15,596kb on the heap during batch + derive scenarios, v2000 holds 19–23kb. That is not a rounding error.

## What this means in practice

v2000 is faster where it matters most for reactive workloads: write propagation, effect scheduling, and bulk state updates. The `state write 100 subs` result (525ms → 216ms) and `100 states individual` (160ms → 63ms) show the architecture pays off under real fan-out pressure.

The regressions are real and you should know about them:

- **State creation** is 4.5× slower in v2000. If you create thousands of state objects in a hot path, that will show.
- **State reads outside effects** are 8× slower. Bare property reads on reactive objects cost more. If you read millions of reactive values in a tight loop with no subscribers, consider reading into a local variable first.
- **State with no subscribers** is 4.5× slower. v2000 pays a baseline proxy cost even when there is nothing to notify.
- **Batch + derive** is 2–3× slower in the median.

## What makes Beacon fast

### Fine-grained tracking

Dependencies are tracked at the property level. When `state.count` changes, only effects that read `count` re-run — not effects that read `name` or `age` on the same object.

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

The benchmark confirms this. `100 states individual` vs `100 states batched` in v1000: 160ms vs 3.36ms. In v2000: 62.91ms vs 3.95ms. Batching is not an optimization — it is the correct usage pattern for bulk writes.

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

- Every property access goes through a proxy trap
- V8 JIT cannot optimize away proxy traps
- Polymorphic handlers cause deoptimization in hot paths

For most applications, this overhead is negligible. If you're doing millions of property accesses in a tight loop, consider reading the value once into a local variable.
