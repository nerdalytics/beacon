# Design

## Context

Beacon's scheduler is a synchronous queue with a single flush decision point: `scheduleSubscribersForTarget` flushes when `batchDepth === 0 && !isNotifying` (src/index.ts:~230), and `flushEffects` drains `pendingEffects`/`effectQueue` in a while-loop (src/index.ts:~250-260). `derive` computes eagerly inside an internal effect guarded by `isComputing` (src/index.ts:~1330-1423) and exposes its value through a proxy over an internal `state()` (src/index.ts:~1362), so any field added to that internal state becomes a trackable dependency for free. `effect` callbacks are fire-and-forget with no cleanup return and no schedule option (src/types.ts:2-3). Solid v2 (`solid-js@2.0.0-rc.15`, `packages/signals/src/signals.ts` at tag `solid-js@2.0.0-rc.15`) supplies the semantic precedents: async memos via `createMemo(async …)` (signals.ts:466-470), `until(fn, {timeout, signal})` with self-disposal (signals.ts:1014-1065), `onSettled` (signals.ts:1164), microtask-coalesced invalidation in `refresh` (signals.ts:~905-910), and a per-effect `schedule` option (signals.ts:~586). See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- Async compute functions in `derive` with stale-while-pending reads and latest-wins supersede, reusing the existing internal-effect and batch machinery.
- Imperative settle points (`until`, `onSettled`) built on `effect` plus explicit disposal — no new subscription subsystem.
- Opt-in microtask scheduling at the existing flush gate, leaving synchronous timing byte-identical for non-opted effects.

**Non-Goals:**
- Holds/transactions and reader-driven pending (Solid's holds exist for renderers; beacon has none — stale-while-pending covers the backend need).
- `refresh()`-style invalidation, optimistic writes, effect cleanup returns, fetch/resource orchestration.
- Any change to `state`, `batch`, or hook composition APIs.

## Decisions

**D1 — Async derive extends the internal effect; no new primitive.** The compute call site in `derive` detects a thenable result; on settle, the value write goes through the existing `batch()` so downstream effects flush once per settle. Alternative considered: a separate `asyncDerive` export — rejected because it forks the API surface and duplicates disposal/hook wiring; Solid likewise folds async into `createMemo` rather than adding a parallel primitive.

**D2 — Supersede via a per-derive generation counter.** Each compute start increments a generation; a settle writes only if its generation is current. This generalizes the synchronous `isComputing` re-entrancy guard (src/index.ts:~1360) to overlapping async runs. Alternative: abort signals passed to compute — rejected because beacon compute functions are user-owned and cannot be required to accept a signal; discarding stale settlements is observable-equivalent and needs no cooperation.

**D3 — `pending` lives in the derive internal state.** Added to the same object the `state()` proxy wraps (src/index.ts:~1362), making it trackable without new dependency machinery, per the async-derive spec's trackable-pending requirement.

**D4 — `until` and `onSettled` are thin layers over `effect`.** `until` creates a private effect that resolves/rejects a promise once and then unsubscribes via the existing effect unsubscribe (honoring beacon's dispose lesson from `derive`); timeout uses `setTimeout`, abort uses the signal's event, both routing through one settle path that clears the other. `onSettled` keeps a module-level callback list invoked at the end of `flushEffects` when the drain left the queues empty and no microtask flush is outstanding. Alternatives: an event-emitter subsystem or promise-polling — both rejected as new machinery for behavior `effect` already provides.

**D5 — Microtask scheduling partitions the pending set at the flush gate.** Effect records carry `schedule`; `scheduleSubscribersForTarget` (src/index.ts:~230) routes microtask-scheduled effects into a separate set and arms one `queueMicrotask` per turn that drains it through the existing `flushEffects` loop — one drain implementation, two entry points. Alternatives: a global scheduler switch (rejected: changes timing for consumers that never opted in) and per-write scheduling (rejected: writers should not know readers).

**D6 — Errors and typing.** Async rejections attach a handler at compute start and route to the existing `DeriveHooks.onError` path (src/index.ts:~1200), so no unhandled rejections. TypeScript overloads keep inference honest: synchronous fn yields `ComputedValue<T>`; async fn yields `ComputedValue<Awaited<T>>` with `value` `undefined` until first settle (same initial shape as today).

## Risks / Trade-offs

- [Cycles across microtask turns are not caught by the synchronous write-during-read guard] → bounded work per turn by the existing drain loop; cross-turn cycles documented as user error; the `onSchedule` hook gives tests a deterministic observation point (effect-scheduling spec, guard-scope requirement).
- [`pending` flips add effect runs for readers that track it] → flips occur only at compute start and settle, and settle writes go through `batch()`, so a settle costs one flush; readers that ignore `pending` are unaffected.
- [An abandoned `until` without timeout/signal keeps its subscription until the predicate flips] → same property as Solid's `until`; documented: pass `timeout` or `signal` when abandonment is possible; self-disposal on every settle path prevents leaks in the settled cases.
- [Epoch bump widens `ComputedValue` and `derive` signatures] → additive field plus overload; synchronous call sites compile and behave unchanged; version 3000.0.0 per CONTRIBUTING.md epoch scheme signals the contract change.

## Migration Plan

No runtime codemod: default `schedule: 'sync'` and synchronous `derive` preserve v2000 timing and values. Release as 3000.0.0 with README migration notes covering the two consumer-visible changes (async `derive` first-settle is asynchronous; `ComputedValue.pending` exists). Rollback = republish 2000.x; no persisted state or wire format exists to migrate.
