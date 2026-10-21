# Hookless `state()` never wraps array mutating methods

**Category:** bug
**Status:** ready-for-agent
**Change:** wrap-array-methods-on-hookless-state

The ticket 02 round 1 implementer of change `enforce-coverage-thresholds` observed on 2026-10-21 that an effect reading `$a[0]` and `length` ran 3 times after `push(1)` on a hookless proxy and 2 times on a hooked one. The cause is in `src/index.ts`: the hookless get handler returned by `createGetHandler` (lines 573 to 580) returns any non-object value as is at line 577, so `push`, `pop` and the other `MUTATING_ARRAY_METHODS` reach the caller unwrapped, while the hooked handler calls `getWrappedArrayMethod` at line 589 before that check. The root `AGENTS.md` line "Array mutating methods intercepted" therefore holds only for hooked state. Fix is to call `getWrappedArrayMethod` in the hookless handler too, above the typeof check; that changes observable effect run counts for hookless arrays, so the tests that count runs need to move with it.

## Triage notes

Triaged on 2026-10-21 through an interview. Decisions, by the session's question numbers: Q23 a (bug, brief), Q24 a (hookless state gets the same swapped mutating methods as hooked state, one mutation is one notification to every subscriber of the array), Q25 a (`fix(state)`, patch bump), Q26 a (glossary entry **Hookless state**), Q27 b (benchmark case, 1% tolerance), Q28 a (the two loop-detection caps are a separate change), Q29 a (the wrapper runs the method on the Proxy inside a batch, on both kinds of state).

Facts the brief rests on, each reproduced against a fresh build of trunk `cbd7448`:

- Mutation issued from outside any effect: an effect reading index 0 and `length` of an empty array ran 2 extra times after `push(1)` on hookless state and 1 extra time on hooked state (the index it read and `length` both changed; starting from a one-element array the hookless count is 1 because the written index was not read). An effect reading only index 1 ran 0 extra times after `push(3)` on hookless state and 1 extra time on hooked state.
- Mutation issued inside a synchronous top-level effect: on hookless state every mutating method throws the loop error, whatever the effect read before, because the method itself reads `length` and the indices it moves through the get trap and then writes them through the set trap. On hooked state the wrapper runs the method on the raw array, so no trap runs; it then wakes every subscriber including the running effect, and that wake is dropped by the effect's active guard. The effect never re-runs and never sees the array it changed.
- The `onWrite` hook never fires for a mutating method on hooked state, for the same reason. Filed separately as `2026-10-21-onwrite-hook-misses-array-mutating-methods.md`; this brief fixes it.
- A `push` run on the Proxy inside `batch()` on hookless state woke a subscriber reading index 0 and `length` once, and threw the loop error when run inside an effect.

## Agent brief

**Summary:** Hookless and hooked state return the same wrapped array mutating methods, and the wrapper runs the method through the Proxy inside a batch, so one call is one notification, the loop check and the state hooks see every read and write, and both kinds of state behave the same.

**Current behavior:**
Only state created with hooks swaps `push`, `pop`, `shift`, `unshift`, `splice`, `sort` and `reverse` for a wrapper. Hookless state hands the native method out unwrapped, so a `push` from outside an effect notifies subscribers once per write the method performs (the new index, then `length`), and an effect that read both re-runs twice. The hooked wrapper runs the native method on the raw array, outside the Proxy, and then wakes every subscriber of the array once. Because no trap runs, the read-then-write loop check never runs for the method, the `onRead` and `onWrite` hooks never see the method's reads and writes, and a mutating method called inside a synchronous top-level effect silently drops the effect's own wake instead of throwing. Hookless state throws in that case. The docs for the core, the source folder and the handbook say mutating methods are intercepted for all state.

**Desired behavior:**
Both kinds of state return the same wrapper for the seven mutating methods. The wrapper runs the native method on the Proxy, not on the raw array, inside a batch. Consequences, all required:

- A mutating method called from outside any effect and outside any batch wakes each subscriber of that array once, after the method returns, whatever properties the subscriber read. The result and the array contents are those of the native method.
- Inside a user batch the wakes wait for the outermost batch boundary, as any other write does.
- A mutating method called inside a synchronous top-level effect throws the existing loop error on both kinds of state, because the method reads what it writes. Child effects and microtask effects keep their existing exemption; no new exemption and no new counter is added.
- On hooked state the `onRead` hook sees the method's reads and the `onWrite` hook sees each write the method performs, with the same arguments a direct property access produces.
- The native method is still reached through the Proxy get trap, so an `onRead` hook observing the method name keeps working.
- The reactive behavior is identical on hookless and hooked state for every case above; hooks only observe.

**Key interfaces:**
- `state()`: both get handlers it installs, with and without hooks, return the wrapped method for the seven names in the mutating-method set when the target is an array.
- The wrapper for a mutating method: receives the raw target, must invoke the method on that target's Proxy within a batch boundary, and returns the native result. Any per-target cache of wrappers must key on the Proxy it calls.
- `checkInfiniteLoop`: unchanged; it fires through the normal set path.
- `batch()`: unchanged in its public contract; the wrapper uses the same depth mechanism so nesting inside a user batch composes.
- `scripts/benchmark.ts`: gains an array mutation case that runs on hookless and on hooked state.
- Docs that describe array interception (root agent docs, source agent docs, handbook architecture and effects pages for the current version) describe the behavior above and no longer imply hookless state notifies per property.
- `package.json` and `jsr.json`: version `2002.0.1`.

**Acceptance criteria:**
- [ ] A test asserts, for hookless and hooked state in the same test, that an effect reading index 0 and `length` of an empty array re-runs exactly once after `push(1)` from outside.
- [ ] A test asserts, for both kinds of state, that an effect reading only index 1 re-runs exactly once after `push(3)` from outside.
- [ ] A test asserts, for both kinds of state, that each of the seven mutating methods called inside a synchronous top-level effect throws the loop error, and that the same call inside a child effect does not throw. Microtask effects keep their exemption; a test for them must use a converging mutation (for example push while `length` is below a bound), since an unconditional one runs into the microtask cap that is out of scope here.
- [ ] A test asserts that a mutating method inside a user `batch()` produces no wake until the batch ends and one wake then.
- [ ] A test asserts that `onWrite` on hooked state is called for the writes a `push` performs, and that `onRead` sees the method name.
- [ ] A test asserts the return value and resulting contents of each wrapped method equal the native method's on a plain array, including `splice` with removals and `sort` with a comparator.
- [ ] Existing tests that counted runs per write on hookless arrays are updated to the single-wake count, and no test accepts either count.
- [ ] `scripts/benchmark.ts` has an array mutation case for both kinds of state; the existing cases are within 1% of trunk, and the implementer reports the numbers for both.
- [ ] The four docs named above agree with the behavior; the root agent docs' key-behaviors line on array methods holds for both kinds of state.
- [ ] `npm test`, `npm run test:coverage` (100% branches, 100% functions, 90% lines) and `npm run check` pass.
- [ ] Commit type `fix(state)`; `package.json` and `jsr.json` both read `2002.0.1`.

**Out of scope:**
- The two numeric caps in loop detection (`MAX_IDLE_CYCLES`, `MAX_MICROTASK_FLUSH_CHAIN`); they are the loop-detection inbox issue and must not be touched here.
- Per-property notification for array methods; one call wakes every subscriber of the array by decision Q24.
- The `until()` abort leak and the `onError` re-subscribe bugs in the inbox.
- The "coverage targets" wording in the source agent docs.
- Any change to how plain index or `length` assignments notify.
