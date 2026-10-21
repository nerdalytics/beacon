# Proposal

## Why

Beacon v2000 is fully synchronous — zero `Promise`/`await`/`async` matches in `src/index.ts`, `src/types.ts`, `src/hooks/*.ts` — so backend consumers cannot derive values from async sources (database or RPC calls inside a computation) and cannot await reactive convergence from imperative code such as request handlers. Solid v2 (`solid-js@2.0.0-rc.15`, 2026-10-13) validated async-signal semantics — async memos, `isPending`/`latest` stale-while-pending reads, `until()` settle waits, microtask-coalesced invalidation — providing a proven design to adapt inside beacon's signals-only scope.

## What Changes

- `derive(fn)` accepts an async compute function; the computed value keeps the last settled value while a recompute is in flight (stale-while-pending) and exposes a trackable `pending` flag; superseded computations are discarded; rejections route to the existing `DeriveHooks.onError`. **BREAKING:** `derive` no longer guarantees a synchronous first value, and `ComputedValue` gains a field.
- New `until(predicate, { timeout?, signal? })`: promise that resolves when a reactive predicate is truthy on a settled graph; self-disposes on settle, timeout, or abort; throws when called inside a reactive scope.
- New `onSettled(callback)`: invokes the callback whenever the graph reaches quiescence after a flush.
- `effect` gains a `schedule: 'sync' | 'microtask'` option (default `'sync'`, unchanged behavior); microtask-scheduled effects coalesce writes across await boundaries into one flush.
- Version bump to `3000.0.0` per the epoch scheme in CONTRIBUTING.md.
- Deliberately cut: `refresh()`/invalidation, optimistic writes, effect cleanup returns, holds/transactions, fetch/resource orchestration — none are signals semantics beacon needs (see design.md).

## Capabilities

### New Capabilities
- `async-derive`: async compute functions for `derive`, stale-while-pending values, trackable `pending`, supersede-discard, rejection routing.
- `settle-observation`: imperative settle points — `until()` predicate waits and `onSettled()` quiescence callbacks, including disposal, timeout, and abort semantics.
- `effect-scheduling`: per-effect synchronous vs microtask scheduling, coalescing guarantees, and interaction with `batch` and the infinite-loop guard.

### Modified Capabilities
- none — `openspec/specs/` is empty (`openspec list --specs` returns no capabilities), so every requirement in this change is new.

## Impact

- `src/index.ts`: scheduler flush gate in `scheduleSubscribersForTarget` (~line 230), `flushEffects` drain loop (~lines 250-260), `derive` internals and `isComputing` guard (~lines 1330-1423), effect creation (~lines 1000-1030), `batch` (~lines 1063-1120).
- `src/types.ts`: `ComputedValue`, effect options/hooks, new `until`/`onSettled` signatures.
- Tests: new spec files under `tests/` (native Node runner); coverage gates unchanged (`node.config.json`: 100% branches, 100% functions, 90% lines).
- Packaging: `package.json` and `jsr.json` to `3000.0.0`; README API documentation updates.
- Dependencies: none added.
