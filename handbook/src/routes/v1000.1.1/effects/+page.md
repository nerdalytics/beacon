---
title: Effects
description: Side effects with automatic dependency tracking
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

## Re-entrance prevention

If an effect is already running, Beacon skips re-entry rather than allowing recursive execution. This prevents stack overflows in scenarios where an effect indirectly triggers itself through intermediate state changes.

## Infinite loop detection

An effect that writes to a state it depends on throws an error:

```typescript
const $count = state(0)

effect(() => {
  const v = $count()
  $count.set(v + 1) // throws: "Infinite loop detected: effect() cannot update a state() it depends on!"
})
```

In v1.0.0 this pattern looped until the queue drained. In v1000.0.0 it throws immediately.

## Parent-child effect tracking

Nested effects are tracked hierarchically. When a parent effect is cleaned up, its child effects are also disposed:

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

When multiple effects depend on the same signal, they execute in the order they were registered. Effects scheduled during a batch are collected and run once when the batch completes.
