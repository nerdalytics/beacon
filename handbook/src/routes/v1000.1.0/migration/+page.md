---
title: v1000.0.0 → v1000.1.0
description: Migrating from Beacon v1000.0.0 to v1000.1.0
---

No breaking changes. All existing v1000.0.0 code works without modification.

## New: `lens()`

Creates a writable two-way binding to a nested property of a state object. Unlike `select()`, which returns `ReadOnlyState<R>`, `lens()` returns a full `State<K>` with `.set()` and `.update()`.

```typescript
import { state, lens, effect } from '@nerdalytics/beacon'

const $config = state({
  server: { host: 'localhost', port: 3000 }
})

const $host = lens($config, (c) => c.server.host)

console.log($host()) // => "localhost"

$host.set('0.0.0.0')
console.log($config().server.host) // => "0.0.0.0"

effect(() => console.log($host()))
// => "0.0.0.0"
```

The property path is extracted from the accessor via a Proxy trap at creation time. Writes propagate back to the source as immutable updates.

## Upgrade

```bash
npm install @nerdalytics/beacon@1000.1.0 --save-exact
```

No code changes required.
