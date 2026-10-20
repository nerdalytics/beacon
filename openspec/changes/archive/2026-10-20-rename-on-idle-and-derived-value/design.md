# Design

## Context

See proposal.md, Why. The facts that shape the approach:

- The core is one file, `src/index.ts`. The three exported names to rename sit in its type block and its public functions; the graph-idle internals are a callback set, a per-cycle notify function, an outside-flush notify entry, and a cycle cap whose error message names the public function. One flag, `settleProcessed`, records that an async computation settled since the last notification. That is the computation sense of "settle" and keeps its name.
- The handbook keeps one frozen route tree per release (`handbook/AGENTS.md`). Adding a version touches the tree, `versions.ts` (`versions` and `latestSource`), `navigation.ts` (`versionConfigs`), the `/latest` glob and the landing links. The last tree change, commit 73de5cf, renamed `v2001.0.0` to `v2001.0.1` in place for a patch release; a breaking release gets a new tree.
- Pushing a changed `package.json` version to trunk publishes to npm and JSR (`build-test-publish.yml`, `check-version.sh`). `jsr.json` must carry the same version.
- Coverage thresholds are 100% branches and functions (`node.config.json`).
- The vocabulary is decided: `GLOSSARY.md`, ADR 0001 (settled vs idle), ADR 0002 (signal as lineage term).

## Goals / Non-Goals

**Goals:**
- One meaning per word across the API, the specs, the README, the agent docs and the current handbook.
- No runtime behavior change. Every renamed test keeps asserting the same timing.
- One trunk push lands code, docs and version together.

**Non-Goals:**
- Deprecated aliases for the old names.
- Renaming the `settle-observation` capability or its test file.
- Editing frozen handbook trees (`v2001.0.1` and older).
- Disposal and cache vocabulary, still open from the glossary pass.

## Decisions

1. **Hard rename, no aliases.** Exporting `onSettled` as a deprecated alias would keep the word in the API for another release and contradict the glossary's `_Avoid_` line. Epoch SemVer exists to make this kind of break explicit, and the user chose breaking changes for uniformity. Version becomes 2002.0.0 (epoch 2, major 2).

2. **Internal names follow the public sense.** Graph-side internals say idle: the callback set, the per-cycle notify, the outside-flush notify, the cycle cap, and the runaway error text (`Infinite loop detected: onIdle callbacks kept scheduling effects for 100 notifications`). `settleProcessed` and the comments about a settlement being discarded stay, because they describe computations. Alternative considered: rename only the exports and leave internals. Rejected: `src/AGENTS.md` documents the internals by name, and a reader would meet both words for one thing.

3. **REMOVED plus ADDED, not RENAMED, in the settle-observation delta.** The requirement's text changes as well as its name: it now defines idle (no effect queued, no microtask flush armed), states that a pending computation does not block idleness, and gains the pending scenario and the error-text scenario. RENAMED is for name-only changes.
   Scenario titles inside MODIFIED blocks keep their original wording (for example "dependency change triggers async recompute"): `openspec validate` treats a retitled scenario as a dropped one and refuses the archive. Only requirement text and scenario bodies switch vocabulary.

4. **The effect-scheduling delta is spec-only.** The microtask chain limit was implemented in commit 50c213a and is tested in `tests/effect-scheduling.test.ts` ("drops a microtask effect woken by every onSettled write after 100 chained flushes"). The delta records existing behavior; no ticket adds code for it. The test name is renamed with the API.

5. **New handbook tree `v2002.0.0`, copied from `v2001.0.1`.** This follows the frozen-tree policy. The copy is wired like the last version addition: new `versions` entry and `latestSource`, a `versionConfigs` entry for `/v2002.0.0` sharing the current config, the `v2001.0.1` entry getting its own frozen config with its current migration label, the `/latest` glob and the landing links pointing at the new tree, and the LLM docs page examples naming the new version. The migration page in the new tree lists the three renames. Alternative considered: edit `v2001.0.1` in place. Rejected: that tree documents a published version whose API has `onSettled`.

6. **Vocabulary pass scope.** The new tree, README, root `AGENTS.md`, `src/AGENTS.md`, `handbook/AGENTS.md`, `HOOKS_TODO.md` and the `package.json` description. Replacements: computed value to derived value; recompute (noun) to computation; in flight to pending; quiescence, goes quiet and converge (for the graph) to idle; settle points to the two imperative entry points, described without the word; `signal` as a variable name to `counter` or similar. The `signals` npm keyword stays. The introduction's "If you have used signals or observables on the frontend" stays, because it relates Beacon to other libraries, which the glossary allows.

7. **Ticket sequencing.** Five tickets run in serial by the user's choice: idle rename, derived-value rename, handbook tree copy, handbook vocabulary sweep, release surface and version. The first two touch the same core file, tests and agent docs, so the derived-value ticket is blocked by the idle ticket. The tree copy shares no files with them; its blocking edge is sequencing only. The sweep and the release ticket come last because they presume the final API and flip the version.

## Risks / Trade-offs

- [The version bump publishes on the trunk push] → All tickets land on the change branch first; one PR to trunk carries code, docs and version. CI checks the `package.json` and `jsr.json` sync before publishing.
- [A stray `onSettled`, `SettledCallback` or `ComputedValue` survives in docs] → The last ticket's acceptance criterion is a search over the repository that finds the old names only in frozen handbook trees and the OpenSpec archive.
- [The `/latest` glob and `latestSource` drift] → The handbook ticket runs `npm run check` and `npm run build` inside `handbook/`; a mismatch breaks the build.
- [Coverage drops when tests are renamed] → Tests are renamed, not removed; the core ticket runs the coverage script.
- [Consumers pinned to `onSettled`] → Expected under Epoch SemVer; the migration page names the three renames and says timing is unchanged.

## Migration Plan

Consumers: rename `onSettled` to `onIdle`, `SettledCallback` to `IdleCallback`, `ComputedValue` to `DerivedValue`. No behavior change, so no code path changes.

Rollback: revert the trunk commit. A published 2002.0.0 cannot be unpublished; a rollback would ship 2002.0.1 or 2003.0.0 with the old names restored, so the trunk push is the point of no return.
