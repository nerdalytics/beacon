# Proposal

## Why

The glossary pass settled one meaning per word: "settled" belongs to a computation, "idle" to the graph, "derived value" to what `derive` returns, and "signal" is a lineage term only (`GLOSSARY.md`, `docs/adr/0001-settled-means-computation-idle-means-graph.md`, `docs/adr/0002-properties-of-proxied-objects-not-signal-cells.md`). The public API, the specs and the docs still carry the old words: `onSettled` and `SettledCallback` name the graph sense "settled", the type is `ComputedValue`, and the README calls a state object a signal. The user chose breaking renames over a documented word family to get uniformity.

## What Changes

- **BREAKING** `onSettled` becomes `onIdle` and `SettledCallback` becomes `IdleCallback`. Behavior is unchanged: the callback still fires after each flush or async settlement that left no effect queued and no microtask flush armed, and it still fires while an async computation is pending. The runaway-callback error message names `onIdle`.
- **BREAKING** The type `ComputedValue<T>` becomes `DerivedValue<T>`. Its shape (`value`, `pending`, `reactive`) is unchanged.
- Internal names follow the glossary: graph-side names say idle, computation-side names keep "settle" (the flag that records an async settlement keeps its name).
- Spec vocabulary follows the glossary: "computed value" becomes "derived value", "recompute" becomes "computation", "in flight" becomes "pending", "quiescence" becomes "idle".
- The effect-scheduling infinite-loop guard requirement replaces its stale sentence ("cycles across microtask turns remain bounded by the per-flush drain loop") with the limit the code has had since commit 50c213a: after 100 consecutive microtask flushes, each armed from inside the previous one, the pending microtask effects are dropped and an `Infinite loop detected` error goes to `console.error`. No code changes for this; the behavior and its test already exist.
- A new handbook tree `v2002.0.0`, following the frozen-tree policy in `handbook/AGENTS.md`, with a migration page for v2001 to v2002. The current tree `v2001.0.1` stays as it is.
- README, root `AGENTS.md`, `src/AGENTS.md`, `HOOKS_TODO.md`, the `package.json` description and the new handbook tree use glossary vocabulary. "signal" is retired from the README tagline, the quick-start example and the `package.json` description. The `signals` npm keyword stays, since it serves package discovery rather than Beacon's own vocabulary (assumption; drop it if you disagree).
- Version becomes 2002.0.0 in `package.json` and `jsr.json`.

Out of scope: the capability name `settle-observation` and the test file of the same name stay, because `until` still observes settles; glossary items still open from the glossary pass (disposal and cache wording); older handbook trees.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `settle-observation`: the graph-idle notification requirement is replaced (`onSettled` removed, `onIdle` added); the `until` requirement's pending scenario uses glossary vocabulary.
- `async-derive`: all five requirements keep their behavior and switch to glossary vocabulary (derived value, computation, pending).
- `effect-scheduling`: the infinite-loop guard requirement states the microtask chain limit instead of the stale drain-loop sentence and gains a scenario for it.

## Impact

- `src/index.ts`: three exported names change; no runtime behavior changes. Consumers importing `onSettled`, `SettledCallback` or `ComputedValue` must rename on upgrade.
- Tests: `tests/settle-observation.test.ts`, `tests/derive-async.test.ts`, `tests/effect-scheduling.test.ts` import and name the old API. `scripts/benchmark.ts` imports `ComputedValue`.
- Handbook: a new route tree plus `src/lib/versions.ts`, `src/lib/navigation.ts`, the `/latest` glob and the landing links. `deploy-handbook.yml` publishes on the trunk push.
- Release: the version bump makes `build-test-publish.yml` publish 2002.0.0 to npm and JSR on the trunk push that lands this change.
- Docs: `README.md` (including the Socket badge version), root `AGENTS.md`, `src/AGENTS.md`, `handbook/AGENTS.md`, `HOOKS_TODO.md`.
