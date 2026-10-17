---
title: "Migration: v2000 → v3000"
description: How to upgrade from Beacon v2000 to v3000
---

<script>
import VersionLink from '#lib/components/VersionLink.svelte'
</script>

## v2000 → v3000

- **`pending` on computed values** — `derive` results carry a readonly `pending` boolean; it is `true` while an async computation is in flight. Additive field: existing readers are unaffected
- **Async compute functions** — `derive` now accepts promise-returning computations. For those, the first settle is asynchronous: read `pending` (or await with <VersionLink path="/settle">`until`</VersionLink>) instead of assuming an immediate value. Synchronous compute functions keep their eager v2000 behavior
- **Effect scheduling** — `effect(fn, name, hooks, { schedule: 'microtask' })` defers re-runs to a microtask. The default `'sync'` is byte-identical to v2000 timing
- **No runtime codemod needed** — synchronous `derive` and default-schedule effects behave exactly as in v2000; the version bumps to 3000.0.0 to signal the additive contract change
