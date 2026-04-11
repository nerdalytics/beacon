---
title: v1000.3.0 → v1000.3.1
description: Migrating from Beacon v1000.3.0 to v1000.3.1
---

No API changes. No breaking changes. Drop-in upgrade.

This release reduces allocations in three hot paths and improves memory reclamation for long-lived applications. The public interface, behavior, and type signatures are identical to v1000.3.0.

## What changed

`protectedState` previously created a new readonly wrapper function on every read. It now caches the wrapper once at construction time.

Effects that re-run used to allocate a fresh `Set` for dependency tracking each cycle. The existing Set is now cleared and reused.

`lens` path updates called `Array.slice()` at each recursion level when writing to nested properties, allocating O(n) intermediate arrays on a path of depth n. These now use index-based iteration with zero intermediate allocations.

## Memory cleanup

The unsubscribe path for nested effects now fully cleans up child references. Previously, only the dependency subscriptions were removed, leaving unreachable entries until garbage collection. This improves memory reclamation in long-lived applications with frequent effect creation and disposal.

## Upgrade

```bash
npm install @nerdalytics/beacon@1000.3.1 --save-exact
```

No code changes required. Existing tests pass without modification.
