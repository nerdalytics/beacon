# Property-Based Testing Opportunities

Analysis of the Beacon test suite identifying scenarios where property-based testing (PBT) with
[fast-check](https://fast-check.dev/) would provide stronger guarantees than hand-picked unit tests.

## Why PBT for Beacon?

Beacon's reactive system has universal invariants that must hold for **all** inputs — not just the handful of
examples currently tested. PBT generates hundreds of random inputs per run and automatically shrinks failing
cases to minimal reproductions.

## Opportunities (ordered by ROI)

### 1. Array Mutation Equivalence (Model-Based Testing) — Done

Implemented in `property-array-mutations.test.ts`.

---

### 2. Same-Value Optimization Across Types — Done

Implemented in `property-same-value.test.ts`.

---

### 3. Batch Effect Deduplication — Done

Implemented in `property-batch-dedup.test.ts`.

---

### 4. Derive Consistency (Referential Transparency) — Done

Implemented in `property-derive-consistency.test.ts`.

---

### 5. Proxy Identity Invariant — Done

Implemented in `property-proxy-identity.test.ts`.

---

### 6. Cleanup Completeness Under Arbitrary Disposal Order — Done

Implemented in `property-cleanup.test.ts`.

---

### 7. Infinite Loop Detection Boundary — Done

Implemented in `property-infinite-loop.test.ts`.

---

### 8. Deep Reactivity at Arbitrary Nesting Depths — Done

Implemented in `property-deep-reactivity.test.ts`.

---

### 9. Batch Error Recovery (Depth Invariant) — Done

Implemented in `property-batch-error.test.ts`.

---

### 10. Dynamic Dependency Tracking Under Arbitrary Branch Sequences — Done

Implemented in `property-dynamic-deps.test.ts`.

---

### 11. Frozen/Sealed Object Reactivity (WeakMap Fallback Paths) — Done

Implemented in `property-frozen-sealed.test.ts`. Two suites: synthetic root-level sealed/frozen
objects (8 properties exercising proxyCacheSubs, frozenMethodCache, proxyCache WeakMap paths), and
real-use-case frozen children of extensible parents (7 properties: replacement triggers effects,
read-through returns correct values, proxy identity stable across reads, derive updates on
replacement, batch replacement deduplicates, all primitive properties readable, same-ref is no-op).

---

## Summary

| # | Scenario | PBT Technique | Current Gap |
|---|----------|---------------|-------------|
| 1 | Array mutation equivalence | Model-based (plain Array oracle) | 1 fixed sequence |
| 2 | Same-value no-op | Edge-case generation (`NaN`, `-0`) | 2 hard-coded values |
| 3 | Batch deduplication | Arbitrary write sequences | Fixed patterns |
| 4 | Derive consistency | Arbitrary functions + values | Specific formulas |
| 5 | Proxy identity | Arbitrary object shapes | 2 specific objects |
| 6 | Cleanup correctness | Arbitrary disposal orderings | 1 interleaving |
| 7 | Infinite loop boundary | Arbitrary property names | Fixed names |
| 8 | Deep reactivity | Arbitrary nesting depths | Depth 1–2 |
| 9 | Batch error recovery | Arbitrary throw-at-depth | Depth 3 |
| 10 | Dynamic dependencies | Arbitrary toggle sequences | Single flip |
| 11 | Frozen/sealed reactivity | Arbitrary sealed/frozen objects + children | No coverage |
