# Sealed-object writes outside an effect skip subscribers

**Category:** bug
**Status:** ready-for-agent
**Change:** commit 63eb432 (2026-10-19), now on branch `fix/sealed-writes-notify` in draft PR #178 together with the ceiling follow-up; nothing remains open

Writes to a sealed (non-extensible, writable) object made with `state()` and no `onWrite` hook do not notify subscribers when made outside an effect. The hookless set handler reads `[SUBSCRIBERS]` directly (`src/index.ts:706`), but sealed targets keep their subscriber set in `proxyCacheSubs` (`src/index.ts:161`, looked up by `findSubscribers` at `src/index.ts:302`), so `subs` is undefined and the write returns early at `src/index.ts:707-710`. Reproduced in a scratch script, not in the repo: `state(Object.seal({ a: 1 }))`, an effect reading `s.a`, then `s.a = 2` ran the effect once (expected twice); passing `{ onWrite: () => {} }` ran it twice. The same `[SUBSCRIBERS]` check in the batch fast path (`src/index.ts:670`) may skip dirty-target recording for sealed objects inside `batch()`, which I did not probe. Found during a read-only over-engineering audit (`/ponytail:ponytail-audit beacon src`); a correctness fix needs a normal review pass and a test.

## Triage notes

Triaged 2026-10-19 on trunk `61e62a0`. The line numbers in the report above predate the audit merge and are stale.

**Established:**

- Reproduced with a scratch script. Sealed target, no hooks, an effect reading one property: a direct write outside any effect did not re-run the effect, and a write inside `batch()` did not either. The same scenario with an `onWrite` hook re-ran the effect both times. A plain extensible target without hooks re-ran as expected.
- Two code paths skip the WeakMap fallback: the hookless set handler's out-of-effect branch and the batch fast path. Both test the `SUBSCRIBERS` symbol on the raw target and return early when it is absent. Sealed targets never carry the symbol; `storeSubscriberSet` puts their set in `proxyCacheSubs`, and `findSubscribers` is the lookup that consults both.
- The hooked set handler and in-effect writes go through `performWrite` and `scheduleSubscribersForTarget`, which call `findSubscribers`, so they are unaffected.
- The property test file for frozen and sealed objects documents this gap in its header comment as a known behavior and only covers in-effect reads and cross-effect writes. No existing test asserts a direct write on a sealed target notifies.
- The handbook's "Frozen and sealed objects" section says non-extensible objects "still work" with no exception for direct writes, so the current behavior contradicts the documentation.
- No prior rejection: `.do/out-of-scope/` does not exist. No redundant implementation found.
- The hookless handlers are the deliberately lean variants (`src/AGENTS.md`, "Proxy Handlers"). The maintainer's standing rule: performance changes to the core are benchmark-gated.

**Decision (maintainer, 2026-10-19):** fix it, benchmark-gated. Measure a baseline first, then fix, verify, benchmark, and iterate on the implementation until the benchmark is back at baseline. The noise threshold is 1%: the aggregate (sum of per-benchmark medians, or the reported average per cycle) of the fixed build must be within 1% of the trunk baseline measured on the same machine in the same session.

**Outcome (2026-10-19):** implemented on branch `fix/sealed-writes-notify`, commit `63eb432`, by an Opus 5.5 agent in one round; see the 2026-10-19 inbox entry on the `hasFallbackSubs` flag ceiling for the follow-up it left. Verify passed (258/258 tests). Three interleaved trunk/fix benchmark pairs at 10 cycles: trunk sums 795.82, 807.55, 803.12 ms; fix sums 789.52, 786.91, 787.92 ms. The fixed build was faster in aggregate in every pair, so the 1% gate passed. "state write 100 subs" was about 1% higher on the fix in all three pairs (88.3 to 88.6 ms vs 87.3 to 87.7 ms), at the noise floor but consistent in direction.

## Agent brief

**Summary:** Direct and batched writes to a sealed reactive object must notify its subscribers, without measurable cost to the hookless fast paths.

**Current behavior:**
A `state()` proxy over a sealed target stores its subscriber set in the WeakMap fallback because the target cannot take the `SUBSCRIBERS` symbol property. When no `onWrite` hook is installed and no effect is running, the set handler checks only the symbol, finds nothing, and writes the value without scheduling anyone. Inside `batch()` the fast path makes the same check and never records the target as dirty. Effects that read the sealed object therefore never re-run on those writes. With an `onWrite` hook, or when the write happens inside an effect, notification works.

**Desired behavior:**
Every write path resolves subscribers the same way the scheduling pipeline does, through the lookup that consults the symbol first and the WeakMap fallback second. A write to a sealed target outside an effect re-runs the effects that read the written property. A write to a sealed target inside `batch()` records the dirty property and re-runs those effects once at the batch boundary. Writes with an unchanged value (`Object.is`) still do nothing. Extensible targets behave exactly as before.

**Key interfaces:**
- `findSubscribers(target)`: the existing read-only lookup over the symbol and `proxyCacheSubs`. The two fast paths should use it, or an equivalent that also covers the fallback, instead of reading the symbol directly.
- The hookless `set` handler produced by `createSetHandler(undefined)` and shared via `HOOKLESS_HANDLER`: its out-of-effect branch.
- `handleBatchFastPath`: the early return when the target has no subscribers.
- `scheduleSubscribersForTarget` and `flushDirtyTargets`: no change expected; they already go through `findSubscribers`.

**Process (ordered, mandatory):**
1. Baseline: run the benchmark on unmodified trunk with at least 10 cycles (`node --expose-gc scripts/benchmark.ts -R 10`) twice and keep both outputs. If the two runs differ by more than 1% on the aggregate, the machine is too noisy; record that and increase the cycle count rather than proceed.
2. Write the failing tests first, confirm they fail on trunk for the right reason.
3. Implement the fix. Run `npm run check`, `npm run build`, `npm test`. All must exit 0 with no warnings.
4. Benchmark the fixed build with the same cycle count. Compare the aggregate to the baseline.
5. If the aggregate is more than 1% slower than baseline, change the implementation (not the threshold) and repeat from step 3. Report every attempt with its numbers, including rejected ones.

**Acceptance criteria:**
- [ ] A test in the frozen/sealed property test file (or a sibling test) asserts that a direct write outside any effect to a sealed target re-runs an effect that read the property, with no hooks installed.
- [ ] A test asserts that a write inside `batch()` to a sealed target with no hooks re-runs the subscribed effect exactly once after the batch.
- [ ] A test asserts that writing an unchanged value to a sealed target does not re-run the effect.
- [ ] The header comment of the frozen/sealed property test file no longer describes direct writes to sealed objects as non-notifying.
- [ ] Existing tests pass unchanged; `npm run check`, `npm run build`, `npm test` exit 0 with no warning lines.
- [ ] Coverage of the touched branches is complete (`npm run test:coverage`, 100% branches and functions on `src/index.ts` for the touched functions).
- [ ] Benchmark aggregate of the fixed build is within 1% of the trunk baseline measured in the same session, at 10 or more cycles. Both the baseline and the final run outputs are attached to the report, along with every intermediate attempt.
- [ ] `src/AGENTS.md` entries for the touched functions still describe them accurately.

**Out of scope:**
- Frozen targets: their properties are non-writable, so writes fail regardless.
- `HOOKS_TODO.md` items C1 to C3 (`frozenHooksCache`, cached-proxy hook replacement, nested reads through a frozen proxy).
- Removing or restructuring the lean hookless handler variants.
- Handbook prose changes, beyond nothing: the handbook already promises sealed objects work.
- Changing the 1% threshold or the cycle count downward.
