---
title: Effects
description: Run side effects that automatically track and respond to signal changes
---

## API

```typescript
function effect(fn: () => void): Unsubscribe
```

Runs `fn` immediately, tracks which signals it reads, and re-runs `fn` when any of those signals change. Returns an unsubscribe function.

## Basic usage

```typescript
import { state, effect } from '@nerdalytics/beacon'

const $count = state(0)

const unsubscribe = effect(() => {
  console.log(`Count: ${$count()}`)
})
// => "Count: 0" (immediate)

$count.set(1)
// => "Count: 1"

$count.set(2)
// => "Count: 2"
```

## Automatic dependency tracking

Dependencies are discovered by running the function. Whatever signals you call inside `fn`, those become dependencies:

```typescript
const $a = state(1)
const $b = state(2)

effect(() => {
  console.log($a() + $b())
})
// Depends on both $a and $b
```

If the set of signals read changes between runs, dependencies update automatically:

```typescript
const $flag = state(true)
const $a = state('A')
const $b = state('B')

effect(() => {
  if ($flag()) {
    console.log($a())
  } else {
    console.log($b())
  }
})
// Initially depends on $flag and $a

$flag.set(false)
// Now depends on $flag and $b — $a is no longer a dependency
```

## Cleanup on re-run

Before each re-run, Beacon removes the effect from all its dependency sets and re-discovers them during execution. This prevents stale dependencies from accumulating.

## Unsubscribing

The function returned by `effect()` stops the effect and removes it from all dependency sets:

```typescript
const $count = state(0)

const unsubscribe = effect(() => {
  console.log($count())
})
// => 0

unsubscribe()

$count.set(1)
// (nothing — effect is disposed)
```

Always unsubscribe effects when they are no longer needed to prevent memory leaks.

## Nested effects

Effects can be nested. Each effect independently tracks its own dependencies:

```typescript
const $a = state(0)
const $b = state(0)

effect(() => {
  console.log('Outer:', $a())

  effect(() => {
    console.log('Inner:', $b())
  })
})
```

However, be careful: the outer effect re-runs whenever `$a` changes, which creates a new inner effect each time. This can lead to duplicate inner effects. In most cases, prefer flat effects.

## Effect execution order

When multiple effects depend on the same signal, they execute in the order they were registered. Effects scheduled during a batch are collected and run once when the batch completes.
