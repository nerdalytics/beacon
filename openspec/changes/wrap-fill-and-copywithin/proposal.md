# Proposal

## Why

`Array.prototype.fill` and `Array.prototype.copyWithin` mutate an array in place like the seven methods the `array-mutation` spec covers, but they are not in the set of names the get trap wraps, so a reactive array hands them out unwrapped and every element they write wakes subscribers on its own, outside any batch. Reproduced on trunk `18f5a71` on 2026-10-25: an effect reading every index of a reactive `[1, 2, 3]` re-ran 3 times for `fill(9)` and 2 times for `copyWithin(0, 1)`, where `reverse()` woke it once, on both kinds of state. Triaged from `.do/inbox/2026-10-25-fill-and-copywithin-not-batched.md`; the reproduction, the loop-detection correction and the rulings Q85 and Q86 are recorded there.

## What Changes

- A benchmark case for `fill` on a reactive array with one subscribed effect, shaped like the existing `array push/pop` cases, committed and run on the unchanged library first so the change has a trunk number (user ruling at triage, the order Q66 d set for the previous change).
- `fill` and `copyWithin` join the set of mutating method names the get trap wraps. Both get the existing cached wrapper that applies the native method to the Proxy receiver inside a batch; no second mechanism, no direct fast path.
- Consumer-visible: a `fill` or `copyWithin` call from outside a batch wakes each subscriber of the array at most once instead of once per written element, and a call that changes no element wakes nobody. That is the same class of wake-count change PR 186 shipped, so it rides the next breaking release with it (Q35 c); no version bump here.
- Loop detection keeps its rule unchanged and the spec says what it means for the two names: `fill` writes indices it does not read, so it raises the loop error in a synchronous top-level effect only when that effect also read an index the call writes; `copyWithin` raises it only when its source and target ranges overlap.
- The `array-mutation` spec and the root `AGENTS.md` name nine methods; `src/AGENTS.md` stops counting "the other five" wrappers.
- Tests cover both names on both kinds of state: wake count, no-change silence, batch composition, the conditional loop behavior, hook observation and native-equal results.

Out of scope, by decision in triage: a direct fast path for the two methods; the inside-effect wake semantics (`.do/inbox/2026-10-23-per-property-wake-inside-effects.md`, Q86 a); writes that bypass the traps (`.do/inbox/2026-10-25-define-property-and-prototype-writes-bypass-traps.md`); a version bump; the handbook pages, which wait for the release tree.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `array-mutation`: the purpose and every requirement that names the methods cover nine instead of seven; the loop-detection requirement gains a scenario for the two methods whose write set is not a subset of their read set; the "results equal the native method" requirement gains scenarios for `fill` and `copyWithin` argument shapes.

## Impact

- `src/index.ts`: two names in `MUTATING_ARRAY_METHODS`; the lookup, the cache and `applyInBatch` are unchanged. One comment that counts the Proxy-receiver wrappers.
- `scripts/benchmark.ts`: one new case.
- `tests/array-methods.test.ts`, `tests/property-array-mutations.test.ts`, `tests/infinite-loop.test.ts`, `tests/state-hooks.test.ts`: new assertions for the two names.
- `openspec/specs/array-mutation/spec.md` via the delta; `AGENTS.md` key behaviors; `src/AGENTS.md` function table.
- `package.json`, `jsr.json`, the handbook: unchanged.
- Consumers: fewer wakes per `fill` or `copyWithin` call; no other observable change, since hooks and the loop check already saw these writes.
