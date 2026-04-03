---
title: Derived
description: Computed signals that recompute when dependencies change
---

## API

```typescript
function derived<T>(fn: () => T): Signal<T>
```

Returns a signal whose value is computed from `fn`. When any signal read inside `fn` changes, the derived value recomputes.

## Basic usage

```typescript
import { state, derived } from '@nerdalytics/beacon'

const $price = state(100)
const $quantity = state(2)
const $total = derived(() => $price() * $quantity())

console.log($total()) // => 200

$quantity.set(5)
console.log($total()) // => 500
```

## How it works

`derived()` is built on top of `state()` and `effect()`:

```typescript
// Simplified internal implementation
const derived = (fn) => {
  const signal = state(fn())
  effect(() => signal.set(fn()))
  return signal
}
```

It creates an internal signal initialized with `fn()`, then an effect that keeps it in sync. This means derived values:

- **Recompute eagerly** — the effect runs as soon as a dependency changes
- **Are themselves signals** — you can read them inside other effects or derived values
- **Support `.set()` and `.update()`** — though overwriting a derived value is unusual

## Chaining derived values

Derived values compose. Each one tracks its own dependencies independently:

```typescript
const $items = state([10, 20, 30])
const $count = derived(() => $items().length)
const $sum = derived(() => $items().reduce((a, b) => a + b, 0))
const $average = derived(() => $count() > 0 ? $sum() / $count() : 0)

console.log($average()) // => 20

$items.set([10, 20, 30, 40])
console.log($average()) // => 25
```


## Reading vs subscribing

Reading a derived value inside an `effect()` creates a dependency, like any other signal:

```typescript
const $count = state(0)
const $doubled = derived(() => $count() * 2)

effect(() => {
  console.log($doubled()) // subscribes to $doubled
})

$count.set(5)
// => 10 (effect re-runs because $doubled changed)
```

Reading outside of an effect just returns the current value without tracking.

## Derived vs effect

Use `derived()` when you need a **value**. Use `effect()` when you need a **side effect**.

```typescript
// Good: derived produces a value
const $fullName = derived(() => `${$first()} ${$last()}`)

// Good: effect performs a side effect
effect(() => {
  console.log(`Name changed to ${$fullName()}`)
})

// Avoid: using effect to compute a value
const $manualFull = state('')
effect(() => {
  $manualFull.set(`${$first()} ${$last()}`) // just use derived()
})
```
