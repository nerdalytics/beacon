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

### 10. Dynamic Dependency Tracking Under Arbitrary Branch Sequences

**Gap**: `state-effect.test.ts:62-116` tests one condition flip (`true` → `false`).

**Property**: For any sequence of boolean toggles, an effect with a conditional branch only fires when the
currently-tracked dependency changes — never on updates to the inactive branch's dependency.

**Value**: Rapidly toggling conditions exercises the `tryRestoreStableDeps` optimization path. Sequences like
`[true, false, true, false, true]` test whether stale subscriber sets are properly cleaned up and re-established.

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
