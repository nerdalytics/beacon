---
title: "Migration: v2001 → v2002"
description: How to upgrade from Beacon v2001 to v2002
---

<script>
import VersionLink from '#lib/components/VersionLink.svelte'
</script>

## Upgrading from v2001 to v2002

Version 2002.0.0 renames three exports. Timing and shape are unchanged: the renamed function fires at the same moments, and the renamed types describe the same values.

| v2001 | v2002 |
|-------|-------|
| `onSettled(callback)` | `onIdle(callback)` |
| `SettledCallback` | `IdleCallback` |
| `ComputedValue<T>` | `DerivedValue<T>` |

- **`onSettled` becomes `onIdle`.** The callback runs each time the graph goes idle after doing work: no effect queued and no microtask flush armed. A pending async computation does not keep the graph from being idle, so the callback runs after the flush that started the computation and again when it settles. "Settled" now describes computations only. See <VersionLink path="/settle">Settle</VersionLink>
- **`SettledCallback` becomes `IdleCallback`.** Same signature, same unsubscribe contract
- **`ComputedValue<T>` becomes `DerivedValue<T>`.** The derived value keeps `value`, `pending` and `reactive`. Both `derive` overloads are unchanged, and a superseded computation is still discarded when it settles. See <VersionLink path="/derive">Derive</VersionLink>
- **No runtime change.** Replace the three names and the version bumps to 2002.0.0 to signal the breaking rename
