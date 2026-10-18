---
title: Effects
description: Side effects with automatic dependency tracking
---

## API

```typescript
function effect(fn: () => void): Unsubscribe
```

Runs `fn` on creation, records which signals it reads, and re-runs `fn` when any of those signals change. Returns an unsubscribe function.

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

Beacon finds dependencies by running the function. Every signal that `fn` calls becomes a dependency:

```typescript
const $a = state(1)
const $b = state(2)

effect(() => {
  console.log($a() + $b())
})
// Depends on both $a and $b
```

If the signals read change between runs, Beacon updates the dependencies:

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

Before each re-run, Beacon removes the effect from all its dependency sets, then finds them again during execution. This stops stale dependencies from accumulating.

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

Always unsubscribe effects you no longer need. This prevents memory leaks.

## Re-entrance prevention

If an effect is already running, Beacon skips the re-entry instead of running it recursively. This prevents stack overflows when an effect triggers itself indirectly through intermediate state changes.

## Infinite loop detection

An effect that writes to a state it depends on throws an error:

```typescript
const $count = state(0)

effect(() => {
  const v = $count()
  $count.set(v + 1) // throws: "Infinite loop detected: effect() cannot update a state() it depends on!"
})
```

In v1.0.0, this pattern looped until the queue drained. In v1000.0.0, it throws immediately.

## Parent-child effect tracking

Beacon tracks nested effects as a hierarchy. Cleaning up a parent effect also disposes its child effects:

```typescript
const $a = state(0)
const $b = state(0)

const unsubscribe = effect(() => {
  console.log('Outer:', $a())

  effect(() => {
    console.log('Inner:', $b())
  })
})

// Disposing the outer effect also disposes the inner effect
unsubscribe()

$b.set(1)
// (nothing — inner effect was cleaned up with its parent)
```

In v1.0.0, nested effects accumulated duplicates on each parent re-run.

## Effect execution order

When multiple effects depend on the same signal, they run in the order they were registered. Beacon collects effects scheduled during a batch and runs them once when the batch completes.
