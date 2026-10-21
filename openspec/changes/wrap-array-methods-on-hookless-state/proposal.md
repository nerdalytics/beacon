# Proposal

## Why

Only state created with hooks swaps the seven array mutating methods for a wrapper; hookless state hands the native method out, so the same `push` notifies subscribers once per property write on hookless state and once per call on hooked state, while the root `AGENTS.md`, `src/AGENTS.md` and the handbook say the methods are intercepted for all state. The wrapper that hooked state uses runs the native method on the raw array, outside the Proxy, so it also skips the read-then-write loop check and the `onRead` and `onWrite` hooks: a `push` inside a synchronous top-level effect throws on hookless state and silently drops the effect's own wake on hooked state, and an `onWrite` hook never sees a `push`. Triaged on 2026-10-21 from `.do/inbox/2026-10-21-hookless-state-skips-array-method-wrap.md`, which also covers `.do/inbox/2026-10-21-onwrite-hook-misses-array-mutating-methods.md`; the reproductions and the decisions Q23 to Q29 are recorded there.

## What Changes

- Both kinds of state, with and without hooks, return the same wrapper for `push`, `pop`, `shift`, `unshift`, `splice`, `sort` and `reverse` on arrays.
- The wrapper runs the native method on the Proxy, not on the raw array, inside a batch. Every read and write the method performs goes through the traps, so the loop check, dependency tracking and the state hooks see them, and the batch boundary delivers at most one wake per call to every subscriber of the array.
- Hookless state: a mutating method called from outside an effect wakes each subscriber of the array once instead of once per changed property. Observable run counts change, so existing tests that counted runs per write move to the single-wake count.
- Hooked state: a mutating method called inside a synchronous top-level effect throws the existing loop error instead of silently dropping the effect's own wake; `onRead` and `onWrite` see the method's reads and writes; a method that changes nothing (for example `sort` on a sorted array) no longer wakes subscribers, following the rule that a write of an equal value does not notify.
- A benchmark case for array mutation on both kinds of state, added and run on the unchanged library first. The release gate is the benchmark grand total: the final commit may not exceed the baseline by more than 1%; the maintainer's rule is that Beacon only gets faster, and 1% of the grand total is the accepted noise.
- The four documents that describe array interception say the same thing as the code.
- Patch release: `2002.0.1` in `package.json` and `jsr.json`, commit type `fix(state)`.

Out of scope, by decision in triage: the two numeric loop-detection caps (`.do/inbox/2026-10-21-loop-detection-without-magic-numbers.md`); per-property notification for array methods; the `until()` abort leak and the `onError` re-subscribe bug in the inbox; the "coverage targets" wording in `src/AGENTS.md`; any change to how plain index or `length` assignments notify.

## Capabilities

### New Capabilities

- `array-mutation`: how a mutating array method called on reactive state notifies subscribers, composes with batches, is checked for self-feeding loops, and is observed by state hooks, identically for state with and without hooks. No existing spec covers arrays (`openspec list --specs` lists `async-derive`, `effect-scheduling`, `handbook-docs`, `settle-observation`, none mentioning arrays).

### Modified Capabilities

None.

## Impact

- `src/index.ts`: the hookless get handler returns the wrapped method for the seven names; the wrapper changes from a raw-target call plus prop-less scheduling to a Proxy call inside a batch. The loop check, the set traps and `batch()` are unchanged.
- `tests/`: new assertions for both kinds of state in the array, hooks and infinite-loop files; existing hookless run-count assertions updated.
- `scripts/benchmark.ts`: one new case, run on both kinds of state.
- `AGENTS.md`, `src/AGENTS.md`, `handbook/src/routes/v2002.0.0/architecture/+page.md`, `handbook/src/routes/v2002.0.0/effects/+page.md`: the array interception sentences.
- `package.json`, `jsr.json`: version `2002.0.1`; the trunk publish workflow releases on the version change.
- Consumers: hookless arrays notify fewer times per method call; hooked arrays throw where they used to stall when mutated inside the effect that reads them. Both are the documented behavior.
