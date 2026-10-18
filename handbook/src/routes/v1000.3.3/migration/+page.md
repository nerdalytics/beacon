---
title: v1000.3.2 → v1000.3.3
description: Migrating from Beacon v1000.3.2 to v1000.3.3
---

This release has no API changes and no breaking changes. It is a drop-in upgrade.

This release removes internal allocation overhead in two areas. The public interface, behavior, and type signatures are identical to v1000.3.2.

## What changed

`derive` and `select` previously created an internal `state` object to hold their computed value. They now use direct variable storage, which removes the backing state allocation and its subscription machinery.

The notification loop previously allocated a new `Set` on every flush cycle to track which subscribers had been notified. It now clears and reuses a single `Set` instance across flushes.

Both changes reduce garbage collection pressure in applications with many derived values or frequent state updates.

## Upgrade

```bash
npm install @nerdalytics/beacon@1000.3.3 --save-exact
```

Your code does not need changes. Existing tests pass without modification.
