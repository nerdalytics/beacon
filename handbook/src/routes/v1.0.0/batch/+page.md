---
title: Batch
description: Group multiple signal updates into a single effect cycle
---

## API

```typescript
function batch<T>(fn: () => T): T
```

Executes `fn`, deferring all effect execution until `fn` completes. Returns what `fn` returns.

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

## Error handling

If the callback throws, the outermost batch clears pending effects so that stale effects do not run:

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

Batch when you update several signals that feed the same effects. Good candidates are bulk operations over data and initialization sequences whose intermediate states have no meaning.

A single `.set()` call gains nothing from batching. Because `batch()` is synchronous, an `await` inside the callback ends the batch at the first yield point. Put async work outside the batch.
