---
title: Quick Start
description: Signals, derived values, effects, batching, and select in five minutes
---

This page walks through Beacon's core primitives with runnable examples.

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
import { state, derive } from '@nerdalytics/beacon'

const $count = state(0)
const $doubled = derive(() => $count() * 2)

console.log($doubled()) // => 0

$count.set(3)
console.log($doubled()) // => 6
```

`derive()` creates a read-only signal that recomputes whenever its dependencies change. It returns a `ReadOnlyState<T>` — you can read it but not write to it.

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
import { state, derive, effect, batch } from '@nerdalytics/beacon'

const $first = state('Ada')
const $last = state('Lovelace')
const $full = derive(() => `${$first()} ${$last()}`)

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

## Select a slice

```typescript
import { state, select, effect } from '@nerdalytics/beacon'

const $user = state({ name: 'Ada', role: 'dev', loginCount: 0 })

const $name = select($user, (u) => u.name)

let runs = 0
effect(() => {
  console.log($name())
  runs++
})
// => "Ada" (runs = 1)

// Update an unrelated property — effect does NOT re-run
$user.update((u) => ({ ...u, loginCount: u.loginCount + 1 }))
// runs = 1 (still)

// Update the selected property — effect re-runs
$user.update((u) => ({ ...u, name: 'Grace' }))
// => "Grace" (runs = 2)
```

`select()` creates a derived signal that only updates when the selected slice changes, not when unrelated properties change.

## Putting it together

```typescript
import { state, derive, effect, batch, select } from '@nerdalytics/beacon'

const $config = state({ host: 'localhost', port: 3000, debug: false })
const $host = select($config, (c) => c.host)
const $url = derive(() => `http://${$host()}:${$config().port}`)

effect(() => {
  console.log(`Server: ${$url()}`)
})
// => "Server: http://localhost:3000"

batch(() => {
  $config.update((c) => ({ ...c, host: '0.0.0.0', port: 8080 }))
})
// => "Server: http://0.0.0.0:8080"
```

Seven functions, no configuration, no setup.
