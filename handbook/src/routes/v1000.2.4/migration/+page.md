---
title: v1000.2.3 → v1000.2.4
description: Migrating from Beacon v1000.2.3 to v1000.2.4
---

Internal optimization. Batch flush now swaps collection references instead of copying, avoiding array allocations. No API changes.

Two hot paths were changed:

### Deferred effects

Previously, `deferredEffectCreations` was copied via `[...spread]` before iteration. Now the reference is swapped to a new empty array. The old array is iterated directly without allocation.

### Pending subscribers

Previously, `pendingSubscribers` was copied via `Array.from(set)` followed by `set.clear()`. Now the Set reference is swapped to a new empty Set. The old Set is iterated directly.

Both eliminate allocation during flush. Most visible in batches with many effects or subscribers.

## Upgrade

```bash
npm install @nerdalytics/beacon@1000.2.4 --save-exact
```

No code changes required.
