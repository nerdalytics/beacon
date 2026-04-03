---
title: State
description: Reactive signals with automatic dependency tracking
---

## API

```typescript
function state<T>(initialValue: T): State<T>
```

Returns a `State<T>` wrapping the initial value. A state is a callable function with `.set()` and `.update()` methods.

## Type interfaces

```typescript
type ReadOnlyState<T> = () => T

interface WriteableState<T> {
  set(value: T): void
  update(fn: (current: T) => T): void
}

type State<T> = ReadOnlyState<T> & WriteableState<T>
```

`State<T>` combines both read and write capabilities. `ReadOnlyState<T>` is callable and read-only — returned by `derive()` and `select()`. `WriteableState<T>` exposes `.set()` and `.update()`.

## Creating signals

```typescript
import { state } from '@nerdalytics/beacon'

const $count = state(0)
const $name = state('Beacon')
const $items = state<string[]>([])
const $config = state({ host: 'localhost', port: 3000 })
```

Signals accept any type: primitives, arrays, objects, `null`, `undefined`.

## Reading

```typescript
const $count = state(0)

// Direct read
console.log($count()) // => 0

// Inside an effect — creates a dependency
effect(() => {
  console.log($count()) // tracked
})
```

Reading inside an `effect()` or `derive()` callback registers a dependency. Reading outside of these contexts returns the value without tracking.

## Writing

### `.set(value)`

Replaces the current value:

```typescript
const $count = state(0)
$count.set(5)
console.log($count()) // => 5
```

### `.update(fn)`

Transforms the value using the current value:

```typescript
const $count = state(0)
$count.update((n) => n + 1)
console.log($count()) // => 1
```

Useful when the new value depends on the old one.

## Same-value optimization

Beacon uses `Object.is()` to compare old and new values. If the value hasn't changed, subscribers are not notified:

```typescript
const $count = state(0)
let runs = 0

effect(() => {
  $count()
  runs++
})
// runs = 1 (initial run)

$count.set(0) // same value
// runs = 1 (no re-run)

$count.set(1) // different value
// runs = 2
```

This means reference equality matters for objects and arrays. Setting the same object reference won't trigger updates:

```typescript
const $list = state([1, 2, 3])
const arr = $list()
arr.push(4)
$list.set(arr) // same reference — no update

$list.set([...arr]) // new reference — triggers update
```

## Working with objects

Since signals use value-level (not property-level) tracking, you must replace the entire object to trigger updates:

```typescript
const $user = state({ name: 'Ada', age: 36 })

// This does NOT trigger updates:
$user().name = 'Grace'

// This does:
$user.set({ ...$user(), name: 'Grace' })

// Or use .update():
$user.update((u) => ({ ...u, name: 'Grace' }))
```

For property-level subscriptions, use `select()` to react only when a specific property changes.

## Working with arrays

Same principle — create a new array reference:

```typescript
const $items = state<string[]>([])

// Add an item
$items.update((items) => [...items, 'new item'])

// Remove an item
$items.update((items) => items.filter((i) => i !== 'new item'))

// Replace at index
$items.update((items) => items.map((item, i) => i === 0 ? 'replaced' : item))
```
