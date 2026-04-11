---
title: Hooks Catalog
description: Hook interfaces, composeHook utility, and patterns for writing your own hooks
---


This page documents what ships in `@nerdalytics/beacon`: the hook type interfaces and the `composeHook` utility. There are no built-in hook implementations — you write your own hook functions against these interfaces.

For a conceptual overview and the composition model, see [Hooks Overview](/latest/hooks-overview).

## Hook interface reference

### StateHooks\<T\>

Passed as the second argument to `state(initial, hooks?)`.

| Hook | Arguments | Fires when |
| --- | --- | --- |
| `onRead` | `(prop: PropertyKey, value: unknown, target: T)` | Property accessed via get trap |
| `onWrite` | `(prop: PropertyKey, oldValue: unknown, newValue: unknown, target: T)` | Property assigned via set trap |
| `onDelete` | `(prop: PropertyKey, hadProperty: boolean, target: T)` | Property removed via `delete` |
| `onHas` | `(prop: PropertyKey, exists: boolean, target: T)` | `in` operator used |
| `onOwnKeys` | `(keys: PropertyKey[], target: T)` | `Object.keys`, `for...in`, or spread |

Hooks propagate to nested objects. When `state()` wraps a nested object in a proxy, it passes the same hooks down.

### EffectHooks

Passed as the third argument to `effect(fn, name?, hooks?)`.

| Hook | Arguments | Fires when |
| --- | --- | --- |
| `onRun` | `(effectName?: string)` | Effect function about to execute |
| `onDispose` | `(effectName?: string)` | Effect disposed |
| `onError` | `(error: Error, effectName?: string)` | Effect threw during execution |
| `onDependencyAdd` | `(target: object, prop: PropertyKey, effectName?: string)` | New dependency registered |
| `onSchedule` | `(effectName?: string)` | Effect queued for re-execution |

### DeriveHooks\<T\>

Passed as the second argument to `derive(fn, hooks?)`.

| Hook | Arguments | Fires when |
| --- | --- | --- |
| `onCompute` | `(previousValue: T \| undefined)` | Compute function about to run |
| `onCacheHit` | `(value: T, cacheHit: boolean)` | `.value` accessed |
| `onDependencyChange` | `(target: object, prop: PropertyKey)` | A dependency changed |
| `onDispose` | `()` | Derive disposed (`reactive` set to `false`) |
| `onError` | `(error: Error)` | Compute function threw |

### BatchHooks

Passed as the second argument to `batch(fn, hooks?)`.

| Hook | Arguments | Fires when |
| --- | --- | --- |
| `onBatchStart` | `(depth: number)` | Batch entered; depth is nesting level |
| `onBatchEnd` | `(depth: number)` | Batch completed |
| `onBatchError` | `(error: Error, depth: number)` | `fn` threw inside batch |

## composeHook

`composeHook` is the only utility shipped in `@nerdalytics/beacon/hooks`. It normalizes a `SingleOrArray<HookFunction<Args>>` into a single function.

```typescript
import { composeHook } from '@nerdalytics/beacon/hooks'

function composeHook<Args extends unknown[]>(
  hook: SingleOrArray<HookFunction<Args>> | undefined
): HookFunction<Args> | undefined
```

Normalization rules:

- `undefined` or `null` → `undefined`
- Single function → returned as-is
- Empty array → `undefined`
- Single-element array → that element
- Multiple-element array → composed function that calls all in sequence

**Error isolation**: Each function in a composed array is wrapped in `try/catch`. One failing hook does not prevent the others from running.

You rarely need to call `composeHook` directly — the `state`, `effect`, `derive`, and `batch` primitives call it internally when normalizing hook fields. It is useful when writing your own hook factory that accepts `SingleOrArray` and needs to produce a single callable.

```typescript
import { composeHook } from '@nerdalytics/beacon/hooks'
import type { HookFunction, SingleOrArray } from '@nerdalytics/beacon/hooks'

function myHookFactory(extra: SingleOrArray<HookFunction<[string]>> | undefined) {
  const composed = composeHook(extra)
  return (label: string) => {
    // do work
    composed?.(label)
  }
}
```

## Writing your own hooks

Hook functions match the signature of the relevant hook field. They receive arguments and return `void`.

### Logging reads and writes

```typescript
import { state } from '@nerdalytics/beacon'
import type { StateHooks } from '@nerdalytics/beacon/hooks'

const $user = state(
  { name: 'Alice', age: 30 },
  {
    onRead: (prop, value) => {
      console.log(`[read] ${String(prop)} →`, value)
    },
    onWrite: (prop, oldValue, newValue) => {
      console.log(`[write] ${String(prop)}: ${oldValue} → ${newValue}`)
    },
  } satisfies StateHooks<{ name: string; age: number }>
)
```

### Timing effect execution

```typescript
import { effect } from '@nerdalytics/beacon'

const dispose = effect(
  () => {
    // effect body
  },
  'myEffect',
  {
    onRun: (name) => {
      console.time(name ?? 'effect')
    },
    onSchedule: (name) => {
      console.timeEnd(name ?? 'effect')
    },
  }
)
```

### Counting derive cache hits

```typescript
import { state, derive } from '@nerdalytics/beacon'

let computes = 0
let cacheHits = 0

const $items = state({ list: [1, 2, 3] })

const total = derive(() => $items.list.reduce((a, b) => a + b, 0), {
  onCompute: () => { computes++ },
  onCacheHit: (_value, fromCache) => { if (fromCache) cacheHits++ },
})
```

### Validation on write

```typescript
import { state } from '@nerdalytics/beacon'

const $user = state(
  { email: '', age: 0 },
  {
    onWrite: (prop, _old, newValue) => {
      if (prop === 'email' && typeof newValue === 'string' && !newValue.includes('@')) {
        console.warn(`[validation] invalid email: ${newValue}`)
      }
      if (prop === 'age' && typeof newValue === 'number' && (newValue < 0 || newValue > 120)) {
        console.warn(`[validation] age out of range: ${newValue}`)
      }
    },
  }
)
```

### Reusable hook factory

If the same hook logic applies to multiple state objects, extract it into a factory function:

```typescript
import type { StateHooks } from '@nerdalytics/beacon/hooks'

function logWrites<T>(prefix: string): StateHooks<T> {
  return {
    onWrite: (prop, oldValue, newValue) => {
      console.log(`[${prefix}] ${String(prop)}: ${String(oldValue)} → ${String(newValue)}`)
    },
  }
}

const $a = state({ count: 0 }, logWrites('A'))
const $b = state({ count: 0 }, logWrites('B'))
```

### Composing multiple hooks

Every hook field accepts a single function or an array. Use arrays to combine independent concerns:

```typescript
import { state } from '@nerdalytics/beacon'

const $data = state(initial, {
  onWrite: [
    (prop, old, val) => console.log(`[log] ${String(prop)}: ${old} → ${val}`),
    (prop, _old, val) => {
      if (prop === 'count' && typeof val === 'number' && val < 0) {
        console.warn('[validate] count must be non-negative')
      }
    },
  ],
})
```

## Publishing hooks as packages

Custom hooks can be published as separate npm packages and consumed as peer dependencies:

```json
{
  "name": "@myorg/beacon-hooks-audit",
  "peerDependencies": {
    "@nerdalytics/beacon": "^2000.0.0"
  }
}
```

```typescript
import { state } from '@nerdalytics/beacon'
import { auditWrites } from '@myorg/beacon-hooks-audit'

const $state = state(initial, {
  onWrite: auditWrites({ service: 'my-api' }),
})
```

