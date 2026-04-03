---
title: Derive
description: Read-only computed signals that track their own dependencies
---

## API

```typescript
function derive<T>(computeFn: () => T): ReadOnlyState<T>
```

Returns a `ReadOnlyState<T>` computed from `computeFn`. Recomputes when any signal read inside `computeFn` changes.

## Basic usage

```typescript
import { state, derive } from '@nerdalytics/beacon'

const $price = state(100)
const $quantity = state(2)
const $total = derive(() => $price() * $quantity())

console.log($total()) // => 200

$quantity.set(5)
console.log($total()) // => 500
```

## Read-only

`derive()` returns `ReadOnlyState<T>`. There is no `.set()` or `.update()` — the value is controlled entirely by its computation function:

```typescript
const $count = state(0)
const $doubled = derive(() => $count() * 2)

$doubled()       // => 0 (reading works)
$doubled.set(10) // TypeError — .set() does not exist on ReadOnlyState
```

This is a change from v1.0.0, where `derived()` returned a full `Signal<T>` with write methods.

## Lazy initialization

`derive()` is lazy-initialized. The computation function does not run until the derived value is first read or a dependency triggers an update:

```typescript
let computed = false
const $count = state(0)

const $doubled = derive(() => {
  computed = true
  return $count() * 2
})

console.log(computed) // => false (not yet computed)
console.log($doubled()) // => 0
console.log(computed) // => true (computed on first read)
```

## Same-value optimization

Derived values use `Object.is()` to compare the previous and new computed values. If the result hasn't changed, downstream effects are not notified:

```typescript
const $items = state([1, 2, 3])
const $count = derive(() => $items().length)

let runs = 0
effect(() => {
  $count()
  runs++
})
// runs = 1

$items.set([4, 5, 6]) // different items, same length
// runs = 1 (count didn't change, effect not re-run)

$items.set([1, 2])
// runs = 2 (count changed)
```

## Chaining derived values

Derived values compose. Each one tracks its own dependencies independently:

```typescript
const $items = state([10, 20, 30])
const $count = derive(() => $items().length)
const $sum = derive(() => $items().reduce((a, b) => a + b, 0))
const $average = derive(() => $count() > 0 ? $sum() / $count() : 0)

console.log($average()) // => 20

$items.set([10, 20, 30, 40])
console.log($average()) // => 25
```

## Reading vs subscribing

Reading a derived value inside an `effect()` creates a dependency, like any other signal:

```typescript
const $count = state(0)
const $doubled = derive(() => $count() * 2)

effect(() => {
  console.log($doubled()) // subscribes to $doubled
})

$count.set(5)
// => 10 (effect re-runs because $doubled changed)
```

Reading outside of an effect just returns the current value without tracking.

## Derive vs effect

Use `derive()` when you need a **value**. Use `effect()` when you need a **side effect**.

```typescript
// Good: derive produces a value
const $fullName = derive(() => `${$first()} ${$last()}`)

// Good: effect performs a side effect
effect(() => {
  console.log(`Name changed to ${$fullName()}`)
})
```
