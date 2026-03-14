---
title: Hooks Overview
description: Zero-cost instrumentation for all four Beacon primitives
---


All four Beacon primitives — `state`, `effect`, `derive`, `batch` — accept an optional hooks parameter as their last argument. Hooks observe internal operations without affecting behavior.

Three properties define the system:

- **Optional** — omit for zero overhead
- **Composable** — pass a single function or an array
- **Isolated** — hook errors never break core reactivity

## Why hooks

Hooks give you a controlled place to attach instrumentation: logging, timing, validation, analytics. Because hooks are opt-in per call site, you attach them only where you need them. There is no global debug mode, no environment variables, no build flags.

Benefits: no debug code in production, no monkey-patching, extensible beyond logging, compatible with tree-shaking.

## Zero-cost abstraction

When no hooks are provided, the overhead is a single falsy check that JIT compilers optimize away:

```typescript
const hasRead = hooks?.onRead != null // false
if (hasRead) hooks.onRead!(...) // never executed
```

Without hooks:

- **Check overhead**: ~0.5ns per operation (single falsy check)
- **Memory**: no additional allocations
- **Bundle size**: 0 bytes (hooks not imported)

With hooks, cost depends entirely on the hook implementation.

## The four hook types

### StateHooks

```typescript
function state<T extends object>(initial: T, hooks?: StateHooks<T>): T
```

| Hook | Arguments | Fires when |
| --- | --- | --- |
| `onRead` | `(prop, value, target)` | Property accessed via get trap |
| `onWrite` | `(prop, oldValue, newValue, target)` | Property assigned via set trap |
| `onDelete` | `(prop, hadProperty, target)` | Property removed via `delete` |
| `onHas` | `(prop, exists, target)` | `in` operator used |
| `onOwnKeys` | `(keys, target)` | `Object.keys`, `for...in`, or spread |

```typescript
const $user = state(
  { name: 'Alice', age: 30 },
  {
    onRead: (prop, value) => {
      console.log(`read ${String(prop)}: ${value}`)
    },
    onWrite: (prop, oldVal, newVal) => {
      console.log(`write ${String(prop)}: ${oldVal} → ${newVal}`)
    },
  }
)

$user.name = 'Bob'
// write name: Alice → Bob
```

Hooks propagate to nested objects. When `state()` wraps a nested object, it passes the same hooks down:

```typescript
const $store = state(
  {
    user: {
      name: 'Alice',
      settings: { theme: 'dark', notifications: true },
    },
    items: [1, 2, 3],
  },
  {
    onWrite: (prop, oldValue, newValue) => {
      console.log(`[${String(prop)}]: ${oldValue} → ${newValue}`)
    },
  }
)

$store.user.name = 'Bob' // "[name]: Alice → Bob"
$store.user.settings.theme = 'light' // "[theme]: dark → light"
$store.items.push(4) // logs array mutation
```

### EffectHooks

```typescript
function effect(fn: EffectCallback, name?: EffectName, hooks?: EffectHooks): Unsubscribe
```

| Hook | Arguments | Fires when |
| --- | --- | --- |
| `onRun` | `(effectName?)` | Effect function about to execute |
| `onDispose` | `(effectName?)` | Effect disposed (cleanup called) |
| `onError` | `(error, effectName?)` | Effect threw during execution |
| `onDependencyAdd` | `(target, prop, effectName?)` | New dependency registered |
| `onSchedule` | `(effectName?)` | Effect queued for re-execution |

```typescript
const $counter = state({ count: 0 })

const dispose = effect(
  () => {
    console.log($counter.count)
  },
  'counter-watcher',
  {
    onRun: (name) => console.log(`[${name}] running`),
    onDispose: (name) => console.log(`[${name}] disposed`),
    onError: (err, name) => console.error(`[${name}] threw:`, err),
  }
)

$counter.count++
// [counter-watcher] running
// 1

dispose()
// [counter-watcher] disposed
```

### DeriveHooks

```typescript
function derive<T>(computeFn: () => T, hooks?: DeriveHooks<T>): ComputedValue<T>
```

| Hook | Arguments | Fires when |
| --- | --- | --- |
| `onCompute` | `(previousValue?)` | Compute function about to run |
| `onCacheHit` | `(value, fromCache)` | `.value` accessed |
| `onDispose` | `()` | Derive disposed (`reactive` set to `false`) |
| `onError` | `(error)` | Compute function threw |
| `onDependencyChange` | `(target, prop)` | A dependency changed |

```typescript
let computeCount = 0

const total = derive(() => $items.list.reduce((a, b) => a + b, 0), {
  onCompute: () => {
    computeCount++
  },
  onCacheHit: (_val, fromCache) => {
    if (fromCache) console.log('cache hit')
  },
})
```

### BatchHooks

```typescript
function batch<T>(fn: () => T, hooks?: BatchHooks): T
```

| Hook | Arguments | Fires when |
| --- | --- | --- |
| `onBatchStart` | `(depth)` | Batch entered; depth is nesting level |
| `onBatchEnd` | `(depth)` | Batch completed |
| `onBatchError` | `(error, depth)` | `fn` threw inside batch |

```typescript
batch(
  () => {
    account1.balance -= 100
    account2.balance += 100
  },
  {
    onBatchStart: (depth) => console.time(`batch-${depth}`),
    onBatchEnd: (depth) => console.timeEnd(`batch-${depth}`),
  }
)
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

Mix single and array hooks on the same object:

```typescript
const $user = state(userData, {
  onRead: (prop, value) => console.log(`read ${String(prop)}`),
  onWrite: [
    (prop, old, val) => console.log(`write ${String(prop)}: ${old} → ${val}`),
    (prop, _old, val) => validate(prop, val),
  ],
})
```

## Error isolation

Hook errors never propagate to user code. Every hook invocation is wrapped in `try/catch` with an empty catch block:

- A broken hook cannot crash your application
- A broken hook cannot prevent state updates or effect execution
- Hook errors are silently swallowed — add your own error handling inside hooks if you need visibility

```typescript
state(
  { value: 0 },
  {
    onWrite: () => {
      throw new Error('bug in hook')
    },
  }
)
// State updates proceed normally. The error is caught and discarded.
```

## Module structure

What actually ships in `@nerdalytics/beacon`:

```
src/
├── index.ts          # Core library (state, effect, derive, batch)
├── types.ts          # Hook type definitions (StateHooks, EffectHooks, DeriveHooks, BatchHooks, HookFunction, SingleOrArray)
└── hooks/
    ├── index.ts      # Re-exports types and composeHook
    └── compose.ts    # composeHook() utility
```

There are no built-in hook implementations. You write inline functions or extract your own factories.

## Best practices

**Keep hooks simple.** Avoid async work or heavy computation inside hooks. If you need to defer work, use `queueMicrotask`.

**Name your effects.** The effect name flows into `onRun`, `onError`, `onDispose`, and `onSchedule` callbacks, and appears in infinite-loop error messages.

```typescript
effect(() => { /* body */ }, 'sync-to-db', {
  onError: (err, name) => console.error(`[${name}] failed:`, err),
})
```

**Use arrays for multiple hooks.**

```typescript
// Good — array for independent concerns
const $state = state(initial, {
  onWrite: [
    (prop, old, val) => console.log(`${String(prop)}: ${old} → ${val}`),
    (prop, _old, val) => validate(prop, val),
  ],
})
```

**Load conditionally for development.**

```typescript
const hooks = process.env.NODE_ENV === 'development'
  ? {
      onWrite: (prop: PropertyKey, old: unknown, val: unknown) => {
        console.debug(`[dev] ${String(prop)}: ${old} → ${val}`)
      },
    }
  : undefined

const $state = state(initial, hooks)
```

See the [Hooks Catalog](/v2000/hooks-catalog) for hook interface reference, `composeHook` documentation, and practical examples.
