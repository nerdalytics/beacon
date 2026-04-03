---
title: v1000.2.3 → v1000.2.4
description: Migrating from Beacon v1000.2.3 to v1000.2.4
---

v1000.2.3 → v1000.2.4. Internal performance optimization. Batch flush now swaps collection references instead of copying, avoiding array allocations. No API changes.

## What changed

Two hot paths in the batch flush were optimized:

### Deferred effects

Previously, `deferredEffectCreations` was copied via `[...spread]` before iteration. Now the reference is swapped to a new empty array. The old array is iterated directly without allocation.

### Pending subscribers

Previously, `pendingSubscribers` was copied via `Array.from(set)` followed by `set.clear()`. Now the Set reference is swapped to a new empty Set. The old Set is iterated directly.

Both changes eliminate unnecessary array allocations during batch flush. The improvement is most visible in batches that create many effects or notify many subscribers.

## No API changes

All existing code works without changes. The optimization is purely internal.

## Upgrade

```bash
npm install @nerdalytics/beacon@1000.2.4
```

No code changes required.
