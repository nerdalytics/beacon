# Proposal

## Why

Every `state(obj, hooks)` call on a non-array target, and every nested object wrapped through its hooked parent, pays one `Object.defineProperty` for the module-private `HOOKS` symbol that nothing ever reads: the only readers of that slot are the direct `push` and `pop` wrappers, and both act only on the `DirectArrayContext` an array target holds. A hooked non-extensible target is written into `frozenHooksCache`, a WeakMap with one declaration, one `set` and no `get`. The hooks keep firing through the handler closures either way, as `HOOKS_TODO.md` item C1 records. The maintainer ruled on 2026-10-25 (Q80 a, `.do/inbox/2026-10-25-drop-unread-hooks-slot-on-objects.md`) to remove the dead work and close C1 with it. A micro probe in that note measured the second symbol define at 77 to 100 ns per fresh object on top of the 102 ns the `PROXY` symbol costs, and the benchmark suite cannot show it because none of its three creation cases passes hooks.

## What Changes

- A hooked non-array target no longer takes the `HOOKS` symbol. Only an array target keeps the slot, holding the `DirectArrayContext` its direct `push` and `pop` read. The slot type narrows accordingly.
- `frozenHooksCache` and the function that writes it are deleted. The non-extensible and define-threw branches keep returning `false`, so `state()` still registers the Proxy in `proxyCache` for those targets.
- The benchmark suite gains one creation case that passes hooks, run on the unchanged library first so the win has a trunk number (Q66 d). Gate: the usual 1% per benchmark case against the base commit; a removal of work is expected to come in at or below it.
- Stale prose that names the removed storage is updated: the test file header that says `frozenHooksCache` is written but never read, the source comment that says the array context shares its slot with a hooks object, the `src/AGENTS.md` rows for the two WeakMaps, `hooksSlotFor`, `definePropertyOnTarget`, `storeHooksForFrozenTarget` and the direct wrappers, and `HOOKS_TODO.md` C1 moves from `decide` to `shipped`.
- No consumer-visible behavior changes. The symbol is module-private, hooks fire exactly as before on extensible and non-extensible targets, and the internal-symbol guard in the traps is unchanged. Commit type `perf(state)`, not breaking.
- No version bump in this change (assumption, recorded here: the inbox note says the step can release on its own, not that it must; the trunk publish workflow is gated by a version change, so merging publishes nothing until the maintainer bumps).

Out of scope: steps 2 and 3 of the object-side chain the inbox note lists (`fill` and `copyWithin` batching; `defineProperty` and prototype writes bypassing the traps). Step 3 reuses the hooked creation benchmark case this change adds.

## Capabilities

### New Capabilities

None. No externally observable behavior is introduced.

### Modified Capabilities

None. No requirement in `async-derive`, `effect-scheduling`, `handbook-docs` or `settle-observation` describes the internal symbol or the cache, and no consumer-visible behavior changes. The change sets `skip_specs: true`.

## Impact

- `src/index.ts`: `hooksSlotFor`, `definePropertyOnTarget`, `defineProxyProperties`, the `HooksSlot` type, the `frozenHooksCache` declaration and `storeHooksForFrozenTarget`; one comment on `DirectArrayContext`.
- `tests/`: one new assertion that a hooked object carries only the Proxy symbol and a hooked array carries both; the header comment of `property-frozen-sealed.test.ts`. Existing frozen-with-hooks and array direct push/pop tests must stay green; coverage thresholds (100% branches, 100% functions) must hold after the deleted branches.
- `scripts/benchmark.ts`: one new case.
- `src/AGENTS.md`, `HOOKS_TODO.md`: the rows named above.
- `package.json`, `jsr.json`, handbook: unchanged.
- Consumers: none. A hooked object has one own symbol instead of two, which only code enumerating own symbols of the raw target could tell, and no public API returns the raw target.
