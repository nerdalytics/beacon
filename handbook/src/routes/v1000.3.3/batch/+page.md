---
title: Batch
description: Group multiple signal updates into a single effect cycle
---

## API

```typescript
function batch<T>(fn: () => T): T
```

Executes `fn`, deferring all effect execution until `fn` completes. Returns the return value of `fn`.

## Why batch

Without batching, each `.set()` immediately triggers dependent effects:

```typescript
const $first = state('Ada')
const $last = state('Lovelace')

let runs = 0
effect(() => {
  console.log(`${$first()} ${$last()}`)
  runs++
})
// => "Ada Lovelace" (runs = 1)

$first.set('Grace')
// => "Grace Lovelace" (runs = 2)
$last.set('Hopper')
// => "Grace Hopper" (runs = 3)
```

With batching:

```typescript
batch(() => {
  $first.set('Grace')
  $last.set('Hopper')
})
// => "Grace Hopper" (runs = 2 — one single re-run)
```

## Return values

`batch()` returns whatever its callback returns:

```typescript
const $count = state(0)

const result = batch(() => {
  $count.set(42)
  return $count()
})

console.log(result) // => 42
```

## Nesting

Batches can nest. Effects only flush at the outermost batch boundary:

```typescript
const $a = state(0)
const $b = state(0)

let runs = 0
effect(() => {
  $a()
  $b()
  runs++
})
// runs = 1

batch(() => {
  $a.set(1)
  batch(() => {
    $b.set(1)
  })
  // inner batch completes, but effects are still deferred
})
// effects flush here — runs = 2
```

## Deferred effect creation

Effects created inside a `batch()` are deferred until the batch completes. This means `effect()` calls inside `batch()` don't run immediately — they are queued and executed after all state updates have been applied:

```typescript
const $count = state(0)

batch(() => {
  $count.set(10)

  effect(() => {
    console.log($count()) // does NOT run here
  })

  $count.set(20)
})
// effect runs now, sees $count = 20
// => 20
```

This prevents effects from seeing intermediate states during batch execution.

## Error handling

If the callback throws, pending effects are cleared at the outermost batch level to prevent stale effects from running:

```typescript
const $count = state(0)

effect(() => console.log($count()))
// => 0

try {
  batch(() => {
    $count.set(999)
    throw new Error('abort')
  })
} catch {
  // pending effects are cleared
}

// The signal still holds 999, but the effect did not run for it
console.log($count()) // => 999
```

## When to batch

Batch when you update multiple signals that feed the same effects. Bulk operations over data, or initialization sequences where intermediate states are meaningless, are good candidates.

A single `.set()` call has no benefit from batching. And because `batch()` is synchronous, `await` inside the callback ends the batch context at the first yield point. Async work belongs outside the batch.
