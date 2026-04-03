---
title: v1.0.0 → v1000.0.0
description: Migrating from Beacon v1.0.0 to v1000.0.0
---

v1000.0.0 is a complete rewrite. The core API pattern stays the same — callable signals with `.set()` and `.update()` — but types, naming, and internals changed. This page covers every breaking change and new addition.

## Renamed: `derived` → `derive`

```typescript
// v1.0.0
import { derived } from '@nerdalytics/beacon'
const $doubled = derived(() => $count() * 2)

// v1000.0.0
import { derive } from '@nerdalytics/beacon'
const $doubled = derive(() => $count() * 2)
```

`derive()` also returns `ReadOnlyState<T>` instead of `Signal<T>`. You can no longer call `.set()` or `.update()` on a derived value.

## Renamed types: `Signal<T>` → `State<T>`

```typescript
// v1.0.0
import type { Signal } from '@nerdalytics/beacon'
const $count: Signal<number> = state(0)

// v1000.0.0
import type { State } from '@nerdalytics/beacon'
const $count: State<number> = state(0)
```

v1000.0.0 introduces three type levels:

| Type | Description |
|------|-------------|
| `State<T>` | Readable and writable. Has `()`, `.set()`, `.update()` |
| `ReadOnlyState<T>` | Readable only. Just `()` |
| `WriteableState<T>` | Writable only. Has `.set()`, `.update()` |

`derive()` and `select()` return `ReadOnlyState<T>`. `state()` returns `State<T>`.

## New: `select()`

Subscribe to a computed slice of state. The effect only re-runs when the selected value changes, not when other properties on the source change.

```typescript
import { state, select, effect } from '@nerdalytics/beacon'

const $user = state({ name: 'Ada', age: 36, email: 'ada@example.com' })
const $name = select($user, (u) => u.name)

effect(() => {
  console.log($name())
})
// => "Ada"

$user.update((u) => ({ ...u, age: 37 }))
// (no output — age is not selected)

$user.update((u) => ({ ...u, name: 'Grace' }))
// => "Grace"
```

An optional third argument accepts a custom equality function (defaults to `Object.is`).

## New: `readonlyState()`

Wraps a `State<T>` to hide its `.set()` and `.update()` methods. Useful when exposing state to consumers that should read but not write.

```typescript
import { state, readonlyState } from '@nerdalytics/beacon'

const $count = state(0)
const $readOnly = readonlyState($count)

console.log($readOnly()) // => 0
// $readOnly.set(1)      // TypeError: not a function
```

## New: `protectedState()`

Returns a `[ReadOnlyState<T>, WriteableState<T>]` tuple. Separates read and write into distinct references.

```typescript
import { protectedState } from '@nerdalytics/beacon'

const [$get, $set] = protectedState({ name: 'Ada' })

console.log($get()) // => { name: "Ada" }
$set.set({ name: 'Grace' })
console.log($get()) // => { name: "Grace" }
```

## Infinite loop detection

v1000.0.0 detects when an effect writes to a state it reads and throws immediately:

```typescript
const $count = state(0)

effect(() => {
  const value = $count()
  $count.set(value + 1) // throws: "Infinite loop detected"
})
```

In v1.0.0 this would loop until the `processEffects` queue drained. In v1000.0.0 it throws `"Infinite loop detected: effect() cannot update a state() it depends on!"`.

## Effect re-entrance prevention

If an effect is already executing, re-entry is silently skipped. In v1.0.0, concurrent effect execution was prevented only by the `updateInProgress` flag on `processEffects`. In v1000.0.0, each effect tracks its own active state via an `activeSubscribers` set.

## Deferred effect creation in batches

Effects created inside a `batch()` are deferred until the batch completes:

```typescript
batch(() => {
  $count.set(5)
  effect(() => console.log($count())) // does not run here
})
// runs here: => 5
```

In v1.0.0, effects created inside batches ran immediately.

## Internal architecture

The implementation moved from module-level closures (~200 LOC) to a `StateImpl` class with static methods (~427 LOC). The public API is unchanged — `state()`, `derive()`, `effect()`, `batch()` are still top-level function exports that delegate to `StateImpl`.
