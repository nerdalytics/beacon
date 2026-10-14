---
title: Performance
description: Performance characteristics and optimization tips
---


Beacon is a reactive system with zero external dependencies. Updates propagate through a dependency graph directly to the effects that need them.

## Benchmark results

All numbers below are real: 1,000,000 iterations, 10 cycles × 7 measurement samples, median reported. Run on the same machine, back-to-back.

### End-to-end scenarios

| Scenario | v1000 med | v2000 med | Δ |
|---|---|---|---|
| classic loop | 3.82ms | 4.41ms | +15% (baseline noise) |
| state no subs | 14.08ms | 93.43ms | +563% — v2000 slower |
| state + derive | 820.78ms | 572.24ms | −30% — v2000 faster |
| state + derive + 2 effects | 1864.10ms | 1088.68ms | −42% — v2000 faster |
| batch + derive | 28.06ms | 117.50ms | +319% — v2000 slower |
| batch + derive + 2 effects | 35.45ms | 116.51ms | +229% — v2000 slower |

### Targeted operations

| Operation | v1000 med | v2000 med | Δ |
|---|---|---|---|
| state creation | 10.10ms | 55.65ms | +451% — v2000 slower |
| state read (no effect) | 4.40ms | 36.91ms | +739% — v2000 slower |
| state write 1 sub | 81.44ms | 45.82ms | −44% — v2000 faster |
| state write 100 subs | 482.55ms | 233.25ms | −52% — v2000 faster |
| effect triggers | 29.09ms | 28.25ms | −3% (within noise) |
| many dependencies | 3.49ms | 4.84ms | +39% — v2000 slower |
| derive chain depth 10 | 8.27ms | 9.71ms | +17% — v2000 slower |
| 100 states individual | 151.20ms | 63.17ms | −58% — v2000 faster |
| 100 states batched | 3.38ms | 4.40ms | +30% — v2000 slower |
| 100 subs disjoint props | 656.61ms | 48.78ms | −93% — v2000 faster |

**Total benchmark time: v1000 = 290.8s, v2000 = 174.6s (−40%)**

### Memory

v2000 batch memory usage is dramatically lower. Where v1000 holds 14,444–14,525kb on the heap during batch + derive scenarios, v2000 holds 18–22kb. That is not a rounding error.

## What this means in practice

v2000 is faster where it matters most for reactive workloads: write propagation, effect scheduling, and bulk state updates. The `state write 100 subs` result (483ms → 233ms) and `100 states individual` (151ms → 63ms) show the architecture pays off under real fan-out pressure. The `100 subs disjoint props` result (657ms → 49ms, −93%) is the clearest win — fine-grained per-property tracking means effects that read different properties on the same object no longer interfere.

The regressions are real and you should know about them:

- **State creation** is ~5.5× slower in v2000. If you create thousands of state objects in a hot path, that will show.
- **State reads outside effects** are ~8.4× slower. Bare property reads on reactive objects cost more. If you read millions of reactive values in a tight loop with no subscribers, consider reading into a local variable first.
- **State with no subscribers** is ~6.6× slower. v2000 pays a baseline proxy cost even when there is nothing to notify.
- **Batch + derive** is ~4.2× slower in the median. v1000's batch path was simpler (no dirty-target tracking, no deferred scheduling), so the raw overhead is higher even though the mechanism is more correct.

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

The benchmark confirms this. `100 states individual` vs `100 states batched` in v1000: 151ms vs 3.38ms. In v2000: 63ms vs 4.40ms. Batching is not an optimization — it is the correct usage pattern for bulk writes.

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

- `cleanupEffect()` removes it from all subscriber sets and resets tracking state
- `cleanupEffectCompletely()` also iteratively cleans up child effects (no recursion — avoids stack overflow)
- Nested effects are automatically cleaned up when parent effects re-run

### Derive disposal

Each `derive()` creates an internal state + effect pair. Undisposed derives leak memory. Always call the dispose function when a derived value is no longer needed.

## Inherent trade-offs

Proxy-based reactivity has a fixed overhead:

- Every property access goes through a proxy trap
- V8 JIT cannot optimize away proxy traps
- Polymorphic handlers cause deoptimization in hot paths

For most applications, this overhead is negligible. If you're doing millions of property accesses in a tight loop, consider reading the value once into a local variable.
