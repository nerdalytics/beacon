---
title: State
description: Create and manage reactive signals with automatic dependency tracking
---

## API

```typescript
function state<T>(initialValue: T): Signal<T>
```

Creates a reactive signal wrapping the initial value. Returns a `Signal<T>` — a callable function with `.set()` and `.update()` methods.

## The Signal interface

```typescript
interface Signal<T> {
  (): T                              // read the current value
  set(value: T): void                // replace the value
  update(fn: (current: T) => T): void // transform the value
}
```

A signal is a function. Call it to read. Use its methods to write.

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

Reading inside an `effect()` or `derived()` callback registers a dependency. Reading outside of these contexts returns the value without tracking.

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
