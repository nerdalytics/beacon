# Hooks

## Overview

All four Beacon primitives — `state`, `effect`, `derive`, `batch` — accept an optional hooks parameter as their last argument. Hooks observe internal operations without affecting behavior.

- **Optional** — omit for zero overhead
- **Composable** — pass a single function or an array
- **Isolated** — hook errors never break core reactivity

## State Hooks

```typescript
function state<T extends object>(initial: T, hooks?: StateHooks<T>): T
```

`StateHooks<T>` fields:

| Hook | Arguments | Fires when |
|------|-----------|------------|
| `onRead` | `(prop, value, target)` | Property accessed via get trap |
| `onWrite` | `(prop, oldValue, newValue, target)` | Property assigned via set trap |
| `onDelete` | `(prop, hadProperty, target)` | Property removed via `delete` |
| `onHas` | `(prop, exists, target)` | `in` operator used |
| `onOwnKeys` | `(keys, target)` | `Object.keys`, `for...in`, or spread |

```typescript
const user = state({ name: 'Alice', age: 30 }, {
  onRead: (prop, value) => {
    console.log(`read ${String(prop)}: ${value}`)
  },
  onWrite: (prop, oldVal, newVal) => {
    console.log(`write ${String(prop)}: ${oldVal} → ${newVal}`)
  }
})

user.name = 'Bob'
// write name: Alice → Bob
```

Hooks propagate to nested objects. When `state()` wraps a nested object, it passes the same hooks down.

## Effect Hooks

```typescript
function effect(fn: EffectCallback, name?: EffectName, hooks?: EffectHooks): Unsubscribe
```

`EffectHooks` fields:

| Hook | Arguments | Fires when |
|------|-----------|------------|
| `onRun` | `(effectName?)` | Effect function about to execute |
| `onDispose` | `(effectName?)` | Effect disposed (cleanup called) |
| `onError` | `(error, effectName?)` | Effect threw during execution |
| `onDependencyAdd` | `(target, prop, effectName?)` | New dependency registered |
| `onSchedule` | `(effectName?)` | Effect queued for re-execution |

```typescript
const counter = state({ count: 0 })

const dispose = effect(() => {
  console.log(counter.count)
}, 'counter-watcher', {
  onRun: (name) => console.log(`[${name}] running`),
  onDispose: (name) => console.log(`[${name}] disposed`),
  onError: (err, name) => console.error(`[${name}] threw:`, err)
})

counter.count++
// [counter-watcher] running
// 1

dispose()
// [counter-watcher] disposed
```

## Derive Hooks

```typescript
function derive<T>(computeFn: () => T, hooks?: DeriveHooks<T>): ComputedValue<T>
```

`DeriveHooks<T>` fields:

| Hook | Arguments | Fires when |
|------|-----------|------------|
| `onCompute` | `(previousValue?)` | Compute function about to run |
| `onCacheHit` | `(value, fromCache)` | `.value` accessed |
| `onDispose` | `()` | Derive disposed (`reactive` set to `false`) |
| `onError` | `(error)` | Compute function threw |
| `onDependencyChange` | `(target, prop)` | A dependency changed (once per unique property during batch) |

```typescript
let computeCount = 0

const total = derive(() => items.list.reduce((a, b) => a + b, 0), {
  onCompute: () => { computeCount++ },
  onCacheHit: (_val, fromCache) => {
    if (fromCache) console.log('cache hit')
  }
})
```

## Batch Hooks

```typescript
function batch<T>(fn: () => T, hooks?: BatchHooks): T
```

`BatchHooks` fields:

| Hook | Arguments | Fires when |
|------|-----------|------------|
| `onBatchStart` | `(depth)` | Batch entered; depth is nesting level |
| `onBatchEnd` | `(depth)` | Batch completed |
| `onBatchError` | `(error, depth)` | `fn` threw inside batch |

```typescript
batch(() => {
  account1.balance -= 100
  account2.balance += 100
}, {
  onBatchStart: (depth) => console.time(`batch-${depth}`),
  onBatchEnd: (depth) => console.timeEnd(`batch-${depth}`)
})
```

## Composition

Every hook field accepts `SingleOrArray<HookFunction<Args>>`:

```typescript
type HookFunction<Args extends unknown[]> = (...args: Args) => void
type SingleOrArray<T> = T | T[]
```

Pass a single function:

```typescript
state(obj, { onWrite: (prop, old, val) => console.log(prop, old, '→', val) })
```

Pass an array to combine observers:

```typescript
state(obj, { onWrite: [logger, validator, metrics] })
```

Array functions execute in order. Each is wrapped in `try/catch` — one failing hook does not prevent the rest from running.

For advanced composition utilities, see `src/hooks/compose.ts`.

## Error Isolation

Hook errors never propagate to user code. Every hook invocation is wrapped in `try/catch` with an empty catch block:

- A broken hook cannot crash your application
- A broken hook cannot prevent state updates or effect execution
- Hook errors are silently swallowed — add your own error handling inside hooks if you need visibility

```typescript
state({ value: 0 }, {
  onWrite: () => { throw new Error('bug in hook') }
})
// State updates proceed normally. The error is caught and discarded.
```
