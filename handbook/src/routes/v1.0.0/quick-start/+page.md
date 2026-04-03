---
title: Quick Start
description: A five-minute walkthrough of Beacon's core concepts
---

This walkthrough covers signals, derived values, effects, and batching in five minutes.

## Create a signal

```typescript
import { state } from '@nerdalytics/beacon'

const $count = state(0)

// Read the value by calling it
console.log($count()) // => 0

// Write with .set()
$count.set(5)
console.log($count()) // => 5

// Update with a function
$count.update((n) => n + 1)
console.log($count()) // => 6
```

A signal is a function that returns its current value when called. Use `.set()` to replace the value or `.update()` to transform it.

## Derive a value

```typescript
import { state, derived } from '@nerdalytics/beacon'

const $count = state(0)
const $doubled = derived(() => $count() * 2)

console.log($doubled()) // => 0

$count.set(3)
console.log($doubled()) // => 6
```

`derived()` creates a read-only signal that recomputes whenever its dependencies change. It uses `state()` and `effect()` internally.

## React to changes

```typescript
import { state, effect } from '@nerdalytics/beacon'

const $name = state('world')

const unsubscribe = effect(() => {
  console.log(`Hello, ${$name()}!`)
})
// => "Hello, world!" (runs immediately)

$name.set('Beacon')
// => "Hello, Beacon!"

// Stop the effect
unsubscribe()
$name.set('ignored')
// (nothing printed)
```

`effect()` runs its callback immediately, tracks which signals were read, and re-runs when any of them change. It returns an unsubscribe function that stops the effect and cleans up all subscriptions.

## Batch updates

```typescript
import { state, derived, effect, batch } from '@nerdalytics/beacon'

const $first = state('Ada')
const $last = state('Lovelace')
const $full = derived(() => `${$first()} ${$last()}`)

let runs = 0
effect(() => {
  runs++
  console.log($full())
})
// => "Ada Lovelace" (runs = 1)

batch(() => {
  $first.set('Grace')
  $last.set('Hopper')
})
// => "Grace Hopper" (runs = 2, not 3)
```

Without `batch()`, each `.set()` would trigger the effect separately. With `batch()`, effects run once after all updates complete.

## Putting it together

```typescript
import { state, derived, effect, batch } from '@nerdalytics/beacon'

const $items = state<string[]>([])
const $count = derived(() => $items().length)

effect(() => {
  console.log(`${$count()} items in the list`)
})
// => "0 items in the list"

batch(() => {
  $items.set([...$items(), 'first'])
  $items.set([...$items(), 'second'])
})
// => "2 items in the list"
```

That's the entire API. Four functions, no configuration, no setup.
