---
title: Quick Start
description: Get up and running with Beacon in five minutes
---


This walkthrough builds a reactive system from scratch. By the end you'll have used all four Beacon primitives.

## 1. Create reactive state

`state()` wraps a plain object in a Proxy. It returns the same shape — you read and write properties as usual.

```typescript
import { state } from '@nerdalytics/beacon'

const app = state({
  users: 0,
  errors: 0,
})

app.users = 5 // reactive — subscribers get notified
```

## 2. React to changes with effects

`effect()` runs a function immediately, then re-runs it whenever the state it read changes. It returns a dispose function.

```typescript
import { state, effect } from '@nerdalytics/beacon'

const app = state({ users: 0, errors: 0 })

const dispose = effect(() => {
  console.log(`Users: ${app.users}, Errors: ${app.errors}`)
})
// => "Users: 0, Errors: 0"

app.users = 3
// => "Users: 3, Errors: 0"

dispose() // stop listening
```

Beacon tracks that this effect reads `app.users` and `app.errors`. Changes to either property re-run it. Changes to other properties don't.

## 3. Compute derived values

`derive()` creates a computed value that stays in sync with its dependencies. It returns an object with a `.value` property.

```typescript
import { state, derive, effect } from '@nerdalytics/beacon'

const app = state({ users: 0, errors: 0 })

const errorRate = derive(() => {
  if (app.users === 0) return 0
  return app.errors / app.users
})

effect(() => {
  console.log(`Error rate: ${errorRate.value}`)
})
// => "Error rate: 0"

app.users = 100
// => "Error rate: 0"

app.errors = 5
// => "Error rate: 0.05"

// Clean up — derive creates an internal effect that must be disposed
errorRate.reactive = false
```

Always set `reactive = false` when you're done with a derived value. It creates an internal effect that leaks if not disposed.

## 4. Batch updates

`batch()` groups multiple state changes so effects run once instead of once per change.

```typescript
import { state, effect, batch } from '@nerdalytics/beacon'

const app = state({ users: 0, errors: 0 })

effect(() => {
  console.log(`Users: ${app.users}, Errors: ${app.errors}`)
})
// => "Users: 0, Errors: 0"

batch(() => {
  app.users = 100
  app.errors = 5
})
// => "Users: 100, Errors: 5" (logged once, not twice)
```

Without `batch`, the effect would fire after `app.users = 100` and again after `app.errors = 5`. With `batch`, it fires once with both values updated.

## Putting it together

Here's a complete, runnable example:

```typescript
import { state, effect, derive, batch } from '@nerdalytics/beacon'

// Reactive state
const server = state({
  requests: 0,
  failures: 0,
})

// Derived computation
const failureRate = derive(() => {
  if (server.requests === 0) return 0
  return server.failures / server.requests
})

// Side effect — log when failure rate changes
const stopLogging = effect(() => {
  const rate = failureRate.value
  if (rate > 0.1) {
    console.log(`Warning: failure rate at ${(rate * 100).toFixed(1)}%`)
  }
})

// Simulate traffic
batch(() => {
  server.requests = 1000
  server.failures = 150
})
// => "Warning: failure rate at 15.0%"

// Clean up
stopLogging()
failureRate.reactive = false
```

## What's next

Dig into each primitive:

- [State](/v2000/state) — nested objects, arrays, frozen objects
- [Effect](/v2000/effects) — dependency tracking, async pitfalls, disposal
- [Derive](/v2000/derive) — chaining, disposal, batch optimization
- [Batch](/v2000/batch) — nesting, error handling, performance
