---
title: v1000.3.0 → v1000.3.1
description: Migrating from Beacon v1000.3.0 to v1000.3.1
---

Internal performance improvements and code cleanup. No API changes, no breaking changes.

## Performance

- **`protectedState` reader**: the readonly wrapper is now cached once at construction instead of recreated on every read
- **Effect re-runs**: the `stateTracking` Set is reused and cleared instead of allocating a new Set each cycle
- **Lens path updates**: deep nested updates use index-based iteration instead of `Array.slice()`, eliminating O(n) allocations per recursion level

## Internal cleanup

- Extracted `getOrCreate` helper to deduplicate the WeakMap get-or-create pattern
- Replaced container objects in `derive`, `select`, and `lens` with plain closure variables
- Extracted `disposeEffect` for full recursive cleanup of nested effects, fixing potential zombie refs
- Unified `updateArrayPath`/`updateObjectPath` into a single `setValueAtPath` function
- Removed redundant JSDoc comments that restated function names

## No runtime changes

All behavior is identical to v1000.3.0. The eight function exports and four type exports are unchanged. Existing tests pass without modification.

## Upgrade

```bash
npm install @nerdalytics/beacon@1000.3.1
```

No code changes required.
