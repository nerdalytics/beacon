---
title: Select
description: Subscribe to a computed slice of state
---

## API

```typescript
function select<T, R>(
  source: ReadOnlyState<T>,
  selectorFn: (state: T) => R,
  equalityFn?: (a: R, b: R) => boolean
): ReadOnlyState<R>
```

Returns a `ReadOnlyState<R>` holding `selectorFn(source())`. The signal only notifies downstream when the selected value changes, not when unrelated parts of the source change.

## Basic usage

```typescript
import { state, select, effect } from '@nerdalytics/beacon'

const $user = state({ name: 'Ada', role: 'dev', loginCount: 0 })

const $name = select($user, (u) => u.name)

effect(() => {
  console.log(`Name: ${$name()}`)
})
// => "Name: Ada"

// Updating an unrelated property — effect does NOT re-run
$user.update((u) => ({ ...u, loginCount: u.loginCount + 1 }))

// Updating the selected property — effect re-runs
$user.update((u) => ({ ...u, name: 'Grace' }))
// => "Name: Grace"
```

## Why select

Without `select()`, an effect that reads any property of a state object re-runs whenever the entire object changes:

```typescript
const $user = state({ name: 'Ada', loginCount: 0 })

// This runs on EVERY $user change, even if name didn't change
effect(() => {
  console.log($user().name)
})

$user.update((u) => ({ ...u, loginCount: u.loginCount + 1 }))
// Effect re-runs even though name is still 'Ada'
```

`select()` compares the selected slice before and after each source update. If the slice hasn't changed, downstream effects are not notified.

## Custom equality

By default, `select()` uses `Object.is()` to compare the previous and new selected values. You can provide a custom equality function for cases where reference equality is too strict:

```typescript
const $data = state({ items: [1, 2, 3], meta: { page: 1 } })

// Deep equality for arrays
const $items = select(
  $data,
  (d) => d.items,
  (a, b) => a.length === b.length && a.every((v, i) => v === b[i])
)

effect(() => {
  console.log('Items:', $items())
})
// => "Items: [1, 2, 3]"

// New array with same contents — effect does NOT re-run
$data.update((d) => ({ ...d, items: [1, 2, 3] }))

// Different contents — effect re-runs
$data.update((d) => ({ ...d, items: [1, 2, 3, 4] }))
// => "Items: [1, 2, 3, 4]"
```

## Composing selectors

`select()` returns a `ReadOnlyState<R>`, so it works anywhere a signal is expected — inside effects, derived values, or even as the source for another `select()`:

```typescript
const $app = state({
  user: { name: 'Ada', prefs: { theme: 'dark' } },
  data: []
})

const $user = select($app, (a) => a.user)
const $theme = select($app, (a) => a.user.prefs.theme)

effect(() => {
  console.log(`Theme: ${$theme()}`)
})
// Only re-runs when theme actually changes
```

## Select vs derive

Both produce `ReadOnlyState`. The difference is notification:

- `derive()` notifies downstream whenever any dependency changes and the result differs
- `select()` only notifies when the selected slice differs, even if the source object changed

For large state objects where you care about one property, `select()` avoids the recomputation overhead `derive()` would cause.

## Select vs lens

`select()` and `lens()` both subscribe to a nested property of state. The difference is writability:

- `select()` returns `ReadOnlyState<R>` — read a slice, cannot write back
- `lens()` returns `State<K>` — read and write a slice, with immutable updates propagated to the source

Use `select()` when you only need to observe a property. Use [`lens()`](/v1000.1.1/lens) when you need two-way binding to a nested property.
