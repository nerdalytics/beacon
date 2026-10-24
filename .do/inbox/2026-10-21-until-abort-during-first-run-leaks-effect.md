# `until()` keeps its effect subscribed when the predicate aborts its own signal on the first run

**Category:** bug
**Status:** needs-triage

The ticket 02 round 1 implementer of change `enforce-coverage-thresholds` observed on 2026-10-21 that an `until()` predicate that calls `abort()` on its own `signal` during the first evaluation rejects correctly but never disposes its effect. In `src/index.ts` `runUntil`, `stop` starts as a no-op (line 1393) and is only assigned when `stop = effect(...)` returns (line 1418). An abort fired synchronously inside that first run calls `onAbort`, then `fail`, then `cleanup`, which calls the placeholder `stop`, so the real unsubscribe is never invoked. The effect then stays subscribed to whatever the predicate read and returns early on every later run via the `done` guard (line 1419). Same shape as the predicate-throw path, which already defers to a microtask so `stop` is assigned; `fail` could defer `cleanup` the same way.
