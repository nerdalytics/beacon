---
title: Lens
description: Two-way binding to a nested property of state
---

## API

```typescript
function lens<T, K>(
  source: State<T>,
  accessor: (state: T) => K
): State<K>
```

Returns a writable `State<K>` focused on a nested property of `source`. Reads return the value at that path. Writes immutably update the source at that path.

## Basic usage

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

$host.set('127.0.0.1')
// => "127.0.0.1"
```

## How it differs from select

`select()` returns a read-only `ReadOnlyState<R>`. It subscribes to a slice but cannot write back.

`lens()` returns a writable `State<K>`. It subscribes to a slice and can write back to the source, maintaining immutability throughout the object tree.

| | `select()` | `lens()` |
|---|---|---|
| Return type | `ReadOnlyState<R>` | `State<K>` |
| Read | Yes | Yes |
| Write | No | Yes |
| Use case | Derived slices, computed projections | Two-way bindings to nested properties |

Use `select()` when you only need to read a slice. Use `lens()` when you need to read and write to a nested property.

## Deep nesting

The accessor can reach arbitrarily deep into the object tree:

```typescript
const $app = state({
  ui: {
    panels: {
      sidebar: { collapsed: false, width: 250 }
    }
  }
})

const $collapsed = lens($app, (a) => a.ui.panels.sidebar.collapsed)

$collapsed.set(true)
console.log($app().ui.panels.sidebar.collapsed) // => true
```

Writes rebuild the object tree immutably from the leaf to the root. The source reference changes, triggering effects that depend on it or on intermediate slices.

## Array index support

The accessor can index into arrays:

```typescript
const $list = state({ items: ['a', 'b', 'c'] })

const $second = lens($list, (l) => l.items[1])

console.log($second()) // => "b"

$second.set('B')
console.log($list().items) // => ['a', 'B', 'c']
```

## Circular update prevention

`lens()` uses an `isUpdating` flag to break the source↔lens feedback loop. When the lens writes to the source, the sync effect is suppressed. When the source changes externally, the lens reflects the new value without writing back.

```typescript
const $config = state({ theme: 'dark' })
const $theme = lens($config, (c) => c.theme)

// External update to source — lens reflects it
$config.set({ theme: 'light' })
console.log($theme()) // => "light"

// Lens update — source reflects it, no loop
$theme.set('dark')
console.log($config().theme) // => "dark"
```

## Reactivity

Like any `State<K>`, a lens works with effects and derive:

```typescript
const $settings = state({
  notifications: { email: true, push: false }
})

const $push = lens($settings, (s) => s.notifications.push)

effect(() => {
  console.log(`Push notifications: ${$push()}`)
})
// => "Push notifications: false"

$push.set(true)
// => "Push notifications: true"
```
