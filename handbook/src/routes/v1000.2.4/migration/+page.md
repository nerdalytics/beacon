---
title: v1000.2.3 → v1000.2.4
description: Migrating from Beacon v1000.2.3 to v1000.2.4
---

No API changes. No breaking changes. Drop-in upgrade.

## What changed

Batch flush now swaps collection references instead of copying. Previously, deferred effects and pending subscribers were copied into new arrays or sets before iteration. Now the references are swapped to fresh empty collections and the originals are iterated directly.

Both changes eliminate allocation during flush. Most visible in batches with many effects or subscribers.

## Upgrade

```bash
npm install @nerdalytics/beacon@1000.2.4 --save-exact
```

No code changes required.
