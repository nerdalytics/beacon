---
title: v1000.3.0 → v1000.3.1
description: Migrating from Beacon v1000.3.0 to v1000.3.1
---

No API changes. No breaking changes. Drop-in upgrade.

This release reduces allocations in three hot paths. The public interface, behavior, and type signatures are identical to v1000.3.0.

## What changed

`protectedState` previously created a new readonly wrapper function on every read. It now caches the wrapper once at construction time.

Effects that re-run used to allocate a fresh `Set` for dependency tracking each cycle. The existing Set is now cleared and reused.

`lens` path updates called `Array.slice()` at each recursion level when writing to nested properties, allocating O(n) intermediate arrays on a path of depth n. These now use index-based iteration with zero intermediate allocations.

## Internal

The unsubscribe path for nested effects now fully cleans up child references in `activeSubscribers`, `stateTracking`, and `parentSubscriber`. Previously, only the dependency subscriptions were removed, leaving unreachable entries in those WeakMaps until garbage collection. This was not observable in behavior or tests, but it delayed memory reclamation in long-lived applications with frequent effect creation and disposal.

Several internal simplifications: closure variables replace container objects in `derive`, `select`, and `lens`; a shared `getOrCreate` helper replaces four duplicated WeakMap lookup blocks; `updateArrayPath` and `updateObjectPath` are inlined into `setValueAtPath`.

## Upgrade

```bash
npm install @nerdalytics/beacon@1000.3.1
```

No code changes required. Existing tests pass without modification.
