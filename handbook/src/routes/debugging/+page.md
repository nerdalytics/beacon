---
title: Debugging
description: Tools and patterns for debugging reactive state
---

# Debugging

Beacon's hook system provides zero-cost instrumentation for all four primitives. Pass hooks where you need observability. No global debug mode, no environment variables, no build flags. Hook errors are isolated and never break core reactivity.

## Named effects

Give effects a name as the second parameter:

```typescript
import { state, effect } from '@nerdalytics/beacon'

const counter = state({ count: 0 })

const dispose = effect(() => {
  console.log(`Count: ${counter.count}`)
}, 'CountLogger')
```

The name flows into hook callbacks (`onRun`, `onError`, `onDispose`, `onSchedule`) and appears in infinite loop error messages.

## Tracing state access

Use `StateHooks` to observe property reads and writes:

```typescript
import { state } from '@nerdalytics/beacon'

const user = state({ name: 'Alice', age: 30 }, {
  onRead: (prop, value) => {
    console.log(`[read] ${String(prop)} →`, value)
  },
  onWrite: (prop, oldValue, newValue) => {
    console.log(`[write] ${String(prop)}: ${oldValue} → ${newValue}`)
  }
})

user.name = 'Bob'      // [write] name: Alice → Bob
console.log(user.age)  // [read] age → 30
```

Additional state hooks: `onDelete`, `onHas`, `onOwnKeys`.

## Tracing effect lifecycle

Use `EffectHooks` to observe when effects run, what they depend on, and when they clean up:

```typescript
import { state, effect } from '@nerdalytics/beacon'

const counter = state({ count: 0 })

const dispose = effect(() => {
  console.log(counter.count)
}, 'MyEffect', {
  onRun: (name) => console.log(`[${name}] running`),
  onDispose: (name) => console.log(`[${name}] disposed`),
  onError: (err, name) => console.error(`[${name}] threw:`, err),
  onDependencyAdd: (target, prop, name) => {
    console.log(`[${name}] tracking ${String(prop)}`)
  }
})

counter.count++
dispose()
```

## Tracing derived values

Use `DeriveHooks` to measure how often a derive recomputes versus returns cached values:

```typescript
import { state, derive } from '@nerdalytics/beacon'

let computes = 0
let cacheHits = 0

const items = state({ list: [1, 2, 3] })

const total = derive(() => items.list.reduce((a, b) => a + b, 0), {
  onCompute: () => { computes++ },
  onCacheHit: (_value, fromCache) => { if (fromCache) cacheHits++ }
})

console.log(total.value) // computes: 1, cacheHits: 0
console.log(total.value) // computes: 1, cacheHits: 1

items.list = [1, 2, 3, 4]
console.log(total.value) // computes: 2, cacheHits: 1
```

Additional derive hooks: `onDispose`, `onError`, `onDependencyChange`.

## Debugging batch operations

Use `BatchHooks` to time batch execution and catch errors:

```typescript
import { state, batch } from '@nerdalytics/beacon'

const s1 = state({ value: 0 })
const s2 = state({ value: 0 })

batch(() => {
  s1.value = 10
  s2.value = 20
}, {
  onBatchStart: (depth) => console.time(`batch-${depth}`),
  onBatchEnd: (depth) => console.timeEnd(`batch-${depth}`),
  onBatchError: (err) => console.error('batch failed:', err)
})
```

## Common patterns

**Why did this effect re-run?**
Use `onSchedule` to see when an effect is queued for re-execution. Combine with state `onWrite` to trace which mutation triggered it.

**What's reading this property?**
Use state `onRead` to log every access. Run your code and inspect the output.

**Is my derive recomputing too often?**
Use `onCompute` and `onCacheHit` counters (see example above). A high compute-to-cache-hit ratio means dependencies change frequently.

**Which effect threw?**
Use `onError` with named effects. The effect name is passed as the second argument.

## Production use

Hooks are opt-in per call site. When you omit the hooks parameter, the internal composition function returns `undefined` and hook call sites are skipped entirely. There is no global debug mode to accidentally ship.
