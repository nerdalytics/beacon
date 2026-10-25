# Design

## Context

See proposal.md, Why. Verified on trunk `18f5a71` on 2026-10-25; the reproduction is in the triage notes of `.do/inbox/2026-10-25-fill-and-copywithin-not-batched.md`. What shapes the approach:

- The get trap asks a lookup for a wrapper whenever an array target hands out a function. The lookup checks the method cache first, keyed by native method, and only on a miss checks the property name against the set of mutating names. A name in the set is wrapped once; the wrapper applies the native method to its call receiver, the Proxy, inside the batch depth bookkeeping, so every read and write passes the traps and the batch boundary delivers at most one wake per subscriber. `push` and `pop` are the only names with a direct path.
- `fill` reads `length` and writes the indices in its range; it reads no element. `copyWithin` reads `length`, reads the source range and writes the target range. Both already go through the traps today because the Proxy is the receiver of the unwrapped call; what they lack is the batch around the call. Hooks therefore already see them, and loop detection already applies its read-then-write rule to them, which is why `fill` alone never throws and `copyWithin` throws only on overlapping ranges.
- The lookup body is a read-path hot spot: the previous change measured 2 to 5% on the read benchmark for any change to it. Adding two names to the set changes nothing in that body; the set is consulted once per native method, after which the cache hit answers.
- The previous change's gate was re-measured under Q84: a 1% per-case ceiling on slowdowns against the baseline run, no limit on speedups, with 3-cycle runs too noisy to resolve 1% on small cases and 10-cycle alternating runs used to settle the two cases over the line.

## Goals / Non-Goals

**Goals:**
- `fill` and `copyWithin` behave like the seven wrapped methods under every requirement of the `array-mutation` spec, on both kinds of state.
- A trunk number for `fill` before the library changes, and no existing case slower by more than the accepted noise after it.
- Loop detection unchanged in code; the spec states what the existing rule means for the two methods.

**Non-Goals:**
- A direct fast path for either method.
- Any change to the inside-effect wake set, to the lookup body, to the cache shape or to `applyInBatch`.
- The handbook, the version, and writes that bypass the traps.

## Decisions

- **Two names in the existing set, nothing else in the library.** The cached Proxy-receiver wrapper is exactly what the spec asks for and already serves five methods. Alternative: a direct path like push and pop, reproducing the trap sequence by hand; rejected because the previous change limited the direct path to the two methods whose read and write pattern is fixed, and `fill` and `copyWithin` take ranges, so their pattern depends on the arguments, which is where correctness would be guessed. Alternative: a per-call wake without the batch; rejected because the batch is the one mechanism and composes with user batches.
- **Loop detection keeps its rule; the spec gains a sentence and scenarios, not an exemption.** The rule is "a write to a property the effect read raises"; `fill` and `copyWithin` write properties their own call did not necessarily read, so the outcome depends on what else the effect read or on range overlap. Stating that in the spec keeps the unconditional scenario honest for the seven and pins the conditional behavior for the two. Alternative: force the loop error on any `fill` or `copyWithin` inside a synchronous top-level effect; rejected because it needs a new check in the trap for no observed defect and the spec forbids a new exemption or counter.
- **The main spec's Purpose line is edited by the ticket that lands the library change, not at planning time.** Archive copies delta requirements into the main spec but ignores a delta's Purpose, and the Purpose names the seven methods. Editing it now would make the main spec claim nine before the code does; editing it in the same commit as the set keeps spec and code in step. The agent docs follow the same rule.
- **Benchmark case: one subscribed effect, a loop of `fill` over a short array, hookless state, shaped like the push/pop case, committed and measured on the unchanged library first (user ruling at triage, Q66 d order).** `fill` is the cheaper of the two to time and its every call changes every element, so the case measures the batch wrapper against the unbatched trap writes it replaces; a `copyWithin` case would measure the same wrapper. One kind of state, because the change does not differ between kinds and the wrapper has no hook-dependent branch. Alternative: both kinds, as the push/pop case does; not needed here and can be added if a number is ever wanted.
- **Gate: the per-case rule of Q84, measured against ticket 01's run.** No existing case may be slower by more than 1%; the new case is reported before and after, and is expected to get faster since one wake replaces several. If a 3-cycle pairing leaves a case over the line, the gate ticket re-measures that case at 10 cycles in alternating order before judging, as the previous change did. Alternative: grand-total gate of the first array change; superseded by Q84.

## Risks / Trade-offs

- [A consumer relied on per-element wakes from `fill` or `copyWithin`] → undocumented; the handbook describes wakes as reactions to a method call. Called out in the notes of the release that carries the behavior, with PR 186's change of the same class.
- [`fill` on a frozen array now raises inside the batch wrapper] → `applyInBatch` aborts the batch and rethrows; the spec scenario pins the native `TypeError` and that the system stays usable, as the sealed-push scenario does.
- [The 3-cycle benchmark run cannot resolve 1% on the small cases] → the gate ticket follows the Q84 procedure for any case over the line; identical code was measured spreading 2.6% on those cases.
- [A loop-detection scenario encodes a native read pattern that a future engine could change] → the scenarios use the ranges the ECMAScript algorithms define (`fill` reads no element; `copyWithin` reads exactly its source range), checked on Node 24.21.0 at planning time.

## Migration Plan

No version bump (Q35 c): the wake-count change ships with the next breaking release beside PR 186. Order inside the change: the benchmark case, then the set and the notification tests, then the loop and hook assertions with the spec Purpose and agent docs, then the gate, so every commit on the branch is green. Rollback: revert the squash commit; no data or API shape changes.
