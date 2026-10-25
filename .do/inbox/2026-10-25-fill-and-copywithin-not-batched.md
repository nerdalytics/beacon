# `fill` and `copyWithin` are mutating array methods that are not batched

**Category:** enhancement
**Status:** ready-for-agent
**Change:** wrap-fill-and-copywithin

`MUTATING_ARRAY_METHODS` in `src/index.ts` at commit 18931ce lists `push`, `pop`, `shift`, `unshift`, `splice`, `sort` and `reverse`. `Array.prototype.fill` and `Array.prototype.copyWithin` also mutate in place and are not in the set, so they run unwrapped with the Proxy as receiver: every element write passes the set trap on its own, outside any batch. A probe on 2026-10-25 (`probe-object2.mjs`, session scratchpad) with an effect reading all three indices of a reactive `[1, 2, 3]`: `fill(9)` re-ran the effect 3 times, `copyWithin(0, 1)` 2 times, `reverse()` once. Hooks and loop detection already see them because the writes go through the traps; only the one-wake-per-call promise of the `array-mutation` spec does not hold for them, and the spec names only the seven methods. Adding the two names to the set gives them the five-method wrapper (`applyInBatch` through the Proxy) with no other code change; the spec's method list and `AGENTS.md` would name nine methods. Benchmark impact: none expected on the seven existing cases, since the set lookup happens once per method name in the get trap and the result is cached in `arrayMethodCache`; a new case for `fill` would need a trunk number before judgement (Q66 d).

**Follow-up:** step 2 of 3 in the object-side chain proposed on 2026-10-25. Order: (1) `2026-10-25-drop-unread-hooks-slot-on-objects.md`, (2) this note, (3) `2026-10-25-define-property-and-prototype-writes-bypass-traps.md`. No code dependency on step 1; it sits second because it is one line in `MUTATING_ARRAY_METHODS` plus the spec and doc lists, and it changes a consumer-visible wake count, fewer wakes per `fill` or `copyWithin` call, the same class of change the PR 186 description lists as breaking under ruling Q35 c. So it rides in the breaking release with PR 186, not on its own. Bundle its spec edit with the one `2026-10-23-per-property-wake-inside-effects.md` asks for, since both rewrite the "One wake per method call" requirement of `openspec/specs/array-mutation/spec.md`, and one change to that requirement is easier to review than two.

## Triage notes

Triaged on 2026-10-25 against trunk at 18f5a71 on Node 24.21.0. The claim reproduced: with an effect reading all three indices of a reactive `[1, 2, 3]`, `fill(9)` re-ran the effect 3 times, `copyWithin(0, 1)` 2 times and `reverse()` once, on hookless and on hooked state alike. Neither name appears in the library source, the tests, the handbook or the `array-mutation` spec, and `.do/out-of-scope/` holds nothing related, so this is neither implemented nor previously rejected.

One correction to the report: loop detection does not treat the two methods like the seven. The spec's rule is that a method throws in a synchronous top-level effect because it reads the properties it writes. `fill` reads only `length` and writes indices, so `fill(9)` alone in such an effect does not throw; it throws only when the effect also read an index it fills. `copyWithin` throws only when its source and target ranges overlap (`copyWithin(0, 1)` on three elements throws, `copyWithin(2, 0, 1)` does not). That is the existing rule applied consistently, not a defect, and the brief keeps it.

Rulings: Q85 (a) enhancement, ready-for-agent. Q86 (a) this issue stands alone; the per-property-wake issue of 2026-10-23 stays separate and may later reword the inside-effect semantics for all nine methods. At propose on the same day: Q87 (a) four tickets, Q88 (a) a straight chain, Q89 (a) one `fill` benchmark case on hookless state. The user also ruled that the benchmark case lands and is measured on the unchanged library before any library change, the same order Q66 d set for the previous change.

## Agent brief

**Summary:** `fill` and `copyWithin` join the set of mutating array methods that run through the Proxy inside a batch, so each wakes every subscriber of the array at most once per call, on both kinds of state, with a benchmark number taken on the unchanged library first.

**Current behavior:**
Reactive state intercepts seven mutating array methods (`push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`): a read of one of those names on a reactive array returns a cached wrapper that runs the native method with the Proxy as receiver inside a batch, so every subscriber wakes at most once after the method returns. `Array.prototype.fill` and `Array.prototype.copyWithin` also mutate in place but are not in that set, so a read of either name returns the native function unwrapped. Each element write then passes the set trap on its own and wakes subscribers immediately: an effect reading every index of a three-element array re-runs three times for `fill(9)` and twice for `copyWithin(0, 1)`, where `reverse()` wakes it once. State hooks already observe both methods, because their reads and writes go through the traps.

**Desired behavior:**
Both methods behave like the existing seven under every requirement of the `array-mutation` spec: one wake per subscriber per call from outside a batch, no wake when the call changes nothing, wakes deferred to the outermost boundary inside a user batch, loop detection by the existing rule with no new exemption, hooks seeing the method name and every property read and written, and return value and contents equal to the native method. The two names ship through the same cached-wrapper mechanism; no second mechanism and no direct fast path like the one push and pop have.

Loop detection keeps its rule unchanged, and the spec says so explicitly for the two new names: `fill` writes properties it does not read, so it raises the loop error in a synchronous top-level effect only when that effect also read an index the call writes; `copyWithin` raises it only when its source and target ranges overlap, because only then does it write an index it read. The scenario that lists the methods which throw unconditionally does not gain the two names; a new scenario pins the conditional behavior for both.

The benchmark suite gains one case for `fill` on a reactive array with one subscribed effect, shaped like the existing `array push/pop` cases, and it is committed and run on the unchanged library before the library change, so the change has a trunk number to compare against. The library change is then gated the usual way: no existing benchmark case regresses beyond the project's per-case threshold against the base commit, and the new case is reported before and after.

**Key interfaces:**
- The set of method names the array method lookup consults in the get trap: gains `fill` and `copyWithin`; the lookup, the cache keyed by native method, and the batch-running wrapper are unchanged
- The `array-mutation` spec: its purpose and every method list name nine methods; the loop-detection requirement gains the conditional scenario above
- Root `AGENTS.md`, key behaviors: the sentence listing the intercepted methods names nine
- The benchmark script: one new case named in the style of the existing array cases
- Tests for array methods, their property-based counterpart, and the loop-detection tests: cover the two names on both kinds of state

**Acceptance criteria:**
- [ ] A benchmark case for `fill` on a subscribed reactive array exists, and its first commit touches only the benchmark script; the full benchmark output from that commit, including the grand total line, is in that ticket's report
- [ ] From outside any batch, an effect reading every index of a reactive `[1, 2, 3]` re-runs exactly once after `fill(9)` and exactly once after `copyWithin(0, 1)`, on state created without hooks and on state created with hooks
- [ ] `fill` with the value every element already holds, and `copyWithin` whose copy changes no element, wake no subscriber
- [ ] Inside a user batch, neither method wakes a subscriber before the batch ends, and each subscriber wakes at most once after it
- [ ] In a synchronous top-level effect, `fill` raises the infinite-loop error when the effect read an index the call writes and raises nothing otherwise; `copyWithin` raises it when its source and target ranges overlap and raises nothing otherwise; a child effect and a microtask effect raise nothing for either
- [ ] On state with hooks, `onRead` sees the method name and every property the method reads, and `onWrite` sees every property the method writes with the same arguments a direct access produces
- [ ] Return value and contents after the call equal the native method on a plain array with the same contents and arguments, for the argument shapes both methods accept, including negative and out-of-range indices; a non-extensible array raises the native error unchanged
- [ ] The `array-mutation` spec and the root agent doc name nine methods, and the spec carries the conditional loop-detection scenario
- [ ] No existing benchmark case regresses beyond the project's per-case threshold against the base commit, and the new case's before and after figures are in the report

**Out of scope:**
- A direct fast path for `fill` or `copyWithin` like the one push and pop have
- Any change to the inside-effect wake semantics; that is the per-property-wake issue of 2026-10-23
- Writes that bypass the traps, such as `Object.defineProperty` or prototype writes; that is a separate inbox issue
- A version bump: the change rides the next breaking release under Q35 c
- Handbook pages: they wait for the release tree, as recorded for the previous array change
