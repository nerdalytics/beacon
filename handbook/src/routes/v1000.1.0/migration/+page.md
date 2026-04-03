---
title: v1000.0.0 → v1000.1.0
description: Migrating from Beacon v1000.0.0 to v1000.1.0
---

v1000.1.0 is a non-breaking minor release. All existing v1000.0.0 code works without modification.

## New: `lens()`

Creates a writable two-way binding to a nested property of a state object. Unlike `select()`, which returns a read-only `ReadOnlyState<R>`, `lens()` returns a writable `State<K>`.

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

Internally, `lens()` extracts the property path from the accessor via a Proxy trap at creation time, syncs to the source via an effect, and overrides `.set()` to immutably update the source at that path.

## No breaking changes

- All existing exports remain unchanged
- No renamed or removed APIs
- No behavioral changes to existing primitives
- JSDoc comment improvements in internals (no public impact)

## Upgrade

```bash
npm install @nerdalytics/beacon@1000.1.0
```

No code changes required.
