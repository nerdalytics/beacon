# Property-Based Testing Opportunities

Analysis of the Beacon test suite identifying scenarios where property-based testing (PBT) with
[fast-check](https://fast-check.dev/) would provide stronger guarantees than hand-picked unit tests.

## Why PBT for Beacon?

Beacon's reactive system has universal invariants that must hold for **all** inputs — not just the handful of
examples currently tested. PBT generates hundreds of random inputs per run and automatically shrinks failing
cases to minimal reproductions.

## Opportunities (ordered by ROI)

### 1. Array Mutation Equivalence (Model-Based Testing)

**Gap**: `state-core.test.ts` tests one fixed mutation sequence (`splice→reverse→sort→truncate`).

**Property**: For any initial array and any sequence of mutating operations (`push`, `pop`, `shift`, `unshift`,
`splice`, `sort`, `reverse`), a reactive array produces the same result as a plain `Array` given the same operations.

**Technique**: Model-based testing — plain `Array` is the oracle.

**Value**: Combinatorial explosion of mutation sequences is impossible to cover by hand. Catches subtle bugs in
length notifications after `splice` with insertion, or `shift`/`unshift` index tracking.

**Status**: Implemented in `property-array-mutations.test.ts`

---

### 2. Same-Value Optimization Across Types

**Gap**: `state-effect.test.ts:118-141` only tests with values `5` and `10`.

**Property**: Setting a state property to its current value never triggers subscribed effects, regardless of value
type — including edge cases like `NaN`, `-0` vs `0`, `Infinity`, empty strings.

**Value**: The `Object.is` semantics used internally have well-known edge cases (`NaN !== NaN` but
`Object.is(NaN, NaN)` is true; `0 === -0` but `Object.is(0, -0)` is false). PBT naturally explores these
boundaries.

---

### 3. Batch Effect Deduplication

**Gap**: `batch-integration.test.ts` tests fixed update patterns only.

**Property**: For any N writes to the same property within a batch, subscribed effects fire at most once when the
batch completes — and only if the final value differs from the initial value.

**Value**: Discovers edge cases like writing the same value multiple times, writing back to the original, or
sequences that return to the initial value via intermediate changes.

---

### 4. Derive Consistency (Referential Transparency)

**Gap**: `derive-core.test.ts` tests specific formulas (`*2`, `+`, string concat).

**Property**: For any pure function `f` and any state value, `derive(() => f(s.value)).value` always equals
`f(s.value)` — both at creation and after any state update.

**Value**: Catches caching bugs where the derived value becomes stale. Arbitrary `initial`/`updated` pairs
exercise cache invalidation and recomputation across a wide input space.

---

### 5. Proxy Identity Invariant

**Gap**: `state-core.test.ts:192-209` tests with two specific objects.

**Properties**:
- `state(obj) === state(obj)` (idempotent wrapping)
- `state(state(obj)) === state(obj)` (already-proxied objects returned as-is)

**Value**: Exercises the `proxyCache` WeakMap and `[PROXY]` symbol check with diverse object shapes — empty
objects, deeply nested, arrays-as-values, etc.

---

### 6. Cleanup Completeness Under Arbitrary Disposal Order

**Gap**: `cleanup.test.ts:204-251` tests one specific interleaving (create 3, dispose middle).

**Property**: For any N effects on the same state, disposing any subset means only non-disposed effects fire on
subsequent updates.

**Value**: Exercises subscriber set removal ordering. Disposing effects in different orders can expose bugs in
subscriber iteration or set mutation during traversal.

---

### 7. Infinite Loop Detection Boundary

**Gap**: `infinite-loop.test.ts` tests ~8 specific patterns with fixed property names.

**Property**: Effect reading property `p` and writing same `p` on same target always throws. Reading `p` and
writing different property `q` never throws.

**Value**: Explores property key handling — numeric-like strings, keys that could collide with internal symbols.

---

### 8. Deep Reactivity at Arbitrary Nesting Depths

**Gap**: Tests exercise nesting at depth 1–2 only.

**Property**: For any nesting depth N, writing to the deepest property triggers an effect reading that path.

**Value**: The proxy wrapping in `resolveValue` → `wrapNestedObject` is recursive. PBT reveals depth-dependent
issues in proxy caching or subscriber tracking.

---

### 9. Batch Error Recovery (Depth Invariant)

**Gap**: `batch-core.test.ts:58-76` tests error propagation at depth 3.

**Property**: After a batch throws at any nesting depth K of N, the system remains functional — subsequent
non-batched writes immediately trigger effects (proving `batchDepth` returned to 0).

**Value**: A bug where `batchDepth` leaks (missing decrement in a specific error path) would leave the system
permanently in batched mode. Hand-picked depths cannot cover all throw-at-depth-K-of-N combinations.

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
