# Design

## Context

See proposal.md, Why. Facts at commit `3376d26` in `src/index.ts`:

- `state()` builds a slot value through `hooksSlotFor`: a new `DirectArrayContext` for an array target, the hooks object itself for any other target, `undefined` without hooks. `defineProxyProperties` passes it to `definePropertyOnTarget`, which defines the `PROXY` symbol on every extensible target and the `HOOKS` symbol whenever the slot is truthy. For a non-extensible target, or when the define throws, it hands the slot to `storeHooksForFrozenTarget`, which writes it into `frozenHooksCache`, and returns `false` so `state()` puts the Proxy in `proxyCache`.
- The `HOOKS` slot has two readers, `directPushWrapper` and `directPopWrapper`. Both read `this?.[HOOKS]`, act only when the value is an `instanceof DirectArrayContext` and the receiver is not the context's own raw target, and otherwise run the native method inside a batch. A hooks object in the slot is never acted on. `frozenHooksCache` has no reader at all.
- Hooks reach the traps by closure: `createGetHandler(onRead, hooks)` and the other factories capture them at `state()` time, and `wrapNestedObject` passes the parent's hooks object into the nested `state()` call. Hook contract fact 7 in `HOOKS_TODO.md` states this. The frozen-object hook test in `tests/state-hooks.test.ts` passes on this path today.
- The traps' internal-symbol guard (`isInternalSymbol`) still lists `HOOKS`; it stays, because array targets keep the slot.
- Coverage thresholds are 100% branches and 100% functions (`node.config.json`), so every branch that survives must still be reached by a test.
- The benchmark suite's creation cases (`state creation`, `state creation (array)`, `state creation (sealed)`) all call `state()` without hooks; the "Blind spots" header comment already names "creation of a target that takes a second symbol" as a gap.

## Goals / Non-Goals

**Goals:**
- Remove the two writes that nothing reads, so hooked object creation does the same symbol work as hookless creation.
- Make the win measurable: a hooked creation case in the suite with a number from the unchanged library.
- Leave every observable behavior as it is: hooks fire the same on extensible and non-extensible targets, direct `push` and `pop` on hooked arrays behave the same, `proxyCache` registration for non-extensible targets is unchanged.
- Prose that describes the removed storage says the same as the code afterwards.

**Non-Goals:**
- Moving the array context out of the `HOOKS` slot. A WeakMap keyed by the Proxy was measured at 2.7x on array creation when the slot was introduced; the slot stays for arrays.
- Any change to the trap handlers or to `HOOKLESS_HANDLER`; step 3 of the chain touches those.
- A version bump or handbook change.

## Decisions

- **`hooksSlotFor` returns `undefined` for a non-array target; the define call keeps its truthiness check.** The `HOOKS` define then happens exactly for array targets, hooked or not, since the hookless path builds a context for an array too, through the existing `if (hooks)` arm, which stays a two-way branch (array, everything else) and stays covered. Alternative: a second `Array.isArray` inside `definePropertyOnTarget`. Rejected: `hooksSlotFor` already answers that question, and one place deciding what the slot holds is easier to keep true.
- **`HooksSlot` narrows to `DirectArrayContext | undefined`.** The type then says what the slot can hold, and the `ProxyObject` helper type follows. The `instanceof` check in the two direct wrappers stays: it is what rejects a nullish receiver, a foreign receiver with no slot, and (defensively) any non-context value. Only its comment changes, since there is no hooks object to tell apart any more.
- **Delete `frozenHooksCache` and `storeHooksForFrozenTarget` outright.** Both the non-extensible arm and the `catch` arm of `defineProxyProperties` reduce to returning `false`. The `catch` arm stays, because a define can throw for a non-extensible target seen after the `isExtensible` check and the existing branch coverage reaches it. Alternative: keep an empty function as a seam. Rejected: it is the dead code the maintainer asked to remove.
- **One new benchmark case, `state creation (hooks)`, under the "Blind spots" header, shaped like `state creation` with one hooks object built once outside the loop.** Any non-empty hooks object triggers the slot write, so a single no-op hook is enough and keeps the hooked trap work minimal, which makes the symbol define the dominant difference from the hookless case. It lands in its own ticket before the library change so its baseline is the unchanged library (Q66 d).
- **Gate: every benchmark case's median on the final commit at most 1% above the same case on the baseline run from ticket 01, on the same machine and Node version.** This is the per-case rule the inbox note names. The change removes work from the hooked creation path and touches no other path, so no case has a reason to move up; the hooked creation case is expected to move down.
- **One test asserts the storage shape:** the raw target of a hooked plain object owns exactly one symbol, the raw target of a hooked array owns two, and a hookless object owns one. It is red on trunk for the object case and green after, which gives the implementer the red-then-green cycle for the removal. Behavior tests for frozen hooked objects and for direct `push`/`pop` already exist and must stay green.

## Risks / Trade-offs

- [Benchmark noise: creation cases show a standard deviation of 15 to 20% of the median across cycles in the last recorded run] → compare medians from full runs at the default run count on the same machine; on a disagreement with the expected direction, rerun both commits back to back before concluding, and record both outputs in the ticket report.
- [A branch that only the deleted cache reached drops coverage below 100%] → the deleted branches disappear with the code; the surviving `catch` arm and the `if (hooks)` arm keep their existing tests. The coverage run in the ticket catches the rest.
- [Prose drift: five documents name the removed storage] → the ticket lists each one as an acceptance criterion; the implementer greps for the two deleted identifiers before finishing and finds none outside the archived change folders.
- [Step 3 of the chain expects the hooked creation case with a trunk number] → ticket 01's report carries the full output of the baseline run; nothing else from this change is a dependency of step 3.

## Migration Plan

Two commits on one change branch, each green on its own: the benchmark case, then the removal with its prose updates. No data, API shape, or manifest changes. Rollback: revert the squash commit. Merging to `trunk` publishes nothing because the publish workflow is gated by a version change.
