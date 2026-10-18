---
title: "Migration: v2000 → v2001"
description: How to upgrade from Beacon v2000 to v2001
---

<script>
import VersionLink from '#lib/components/VersionLink.svelte'
</script>

## Upgrading from v2000 to v2001

- **`pending` on computed values.** `derive` results carry a readonly `pending` boolean. It is `true` while an async computation is in flight. This is an additive field, so existing readers keep working
- **Async compute functions.** `derive` now accepts promise-returning computations. For those, the first settle is asynchronous. Read `pending`, or await with <VersionLink path="/settle">`until`</VersionLink>, instead of assuming an immediate value. Synchronous compute functions keep their eager v2000 behavior
- **Effect scheduling.** `effect(fn, name, hooks, { schedule: 'microtask' })` defers re-runs to a microtask. The default `'sync'` is byte-identical to v2000 timing
- **No runtime codemod needed.** Synchronous `derive` and default-schedule effects behave exactly as in v2000. The version bumps to 2001.0.0 to signal the additive contract change
