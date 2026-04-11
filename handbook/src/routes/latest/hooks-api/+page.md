---
title: Hooks API Reference
description: Complete hook interface definitions for StateHooks, EffectHooks, DeriveHooks, and BatchHooks
---


Complete interface definitions for all hook types. For an introduction to hooks, see the [Hooks Overview](/latest/hooks-overview).

## Base types

```typescript
type HookFunction<Args extends any[]> = (...args: Args) => void
type SingleOrArray<T> = T | T[]
```

Every hook field accepts a single function or an array of functions. Arrays execute in order with per-function error isolation.

## StateHooks

Hooks for intercepting state operations on reactive objects.

```typescript
interface StateHooks<T = any> {
  onRead?: SingleOrArray<HookFunction<[prop: PropertyKey, value: unknown, target: T]>>
  onWrite?: SingleOrArray<HookFunction<[prop: PropertyKey, oldValue: unknown, newValue: unknown, target: T]>>
  onDelete?: SingleOrArray<HookFunction<[prop: PropertyKey, hadProperty: boolean, target: T]>>
  onHas?: SingleOrArray<HookFunction<[prop: PropertyKey, exists: boolean, target: T]>>
  onOwnKeys?: SingleOrArray<HookFunction<[keys: PropertyKey[], target: T]>>
}
```

Hooks automatically propagate to nested objects. When you access a nested object through a reactive proxy, it inherits the parent's hooks:

```typescript
const $store = state(
  {
    user: {
      name: 'Alice',
      settings: { theme: 'dark' },
    },
  },
  {
    onWrite: (prop, oldValue, newValue) => {
      console.log(`[${String(prop)}]: ${oldValue} → ${newValue}`)
    },
  }
)

$store.user.name = 'Bob' // "[name]: Alice → Bob"
$store.user.settings.theme = 'light' // "[theme]: dark → light"
```

### onRead

Fired when a property is accessed.

| Parameter | Type | Description |
| --- | --- | --- |
| `prop` | `PropertyKey` | The property being read |
| `value` | `unknown` | Current value of the property |
| `target` | `T` | The raw target object (not the proxy) |

```typescript
const $state = state(
  { count: 0 },
  {
    onRead: (prop, value, target) => {
      console.log(`Reading ${String(prop)} = ${value}`)
    },
  }
)

const value = $state.count // "Reading count = 0"
```

### onWrite

Fired when a property is modified.

| Parameter | Type | Description |
| --- | --- | --- |
| `prop` | `PropertyKey` | The property being written |
| `oldValue` | `unknown` | Previous value |
| `newValue` | `unknown` | New value being set |
| `target` | `T` | The raw target object (not the proxy) |

```typescript
const $state = state(
  { count: 0 },
  {
    onWrite: (prop, oldValue, newValue, target) => {
      console.log(`${String(prop)}: ${oldValue} → ${newValue}`)
    },
  }
)

$state.count = 5 // "count: 0 → 5"
```

### onDelete

Fired when a property is deleted.

| Parameter | Type | Description |
| --- | --- | --- |
| `prop` | `PropertyKey` | The property being deleted |
| `hadProperty` | `boolean` | Whether the property existed before deletion |
| `target` | `T` | The raw target object (not the proxy) |

```typescript
const $state = state(
  { temp: 'value' },
  {
    onDelete: (prop, hadProperty, target) => {
      if (hadProperty) {
        console.log(`Deleted property: ${String(prop)}`)
      }
    },
  }
)

delete $state.temp // "Deleted property: temp"
```

### onHas

Fired when the `in` operator is used.

| Parameter | Type | Description |
| --- | --- | --- |
| `prop` | `PropertyKey` | The property being checked |
| `exists` | `boolean` | Whether the property exists |
| `target` | `T` | The raw target object (not the proxy) |

```typescript
const $state = state(
  { name: 'Alice' },
  {
    onHas: (prop, exists, target) => {
      console.log(`Checking ${String(prop)}: ${exists}`)
    },
  }
)

'name' in $state // "Checking name: true"
'age' in $state // "Checking age: false"
```

### onOwnKeys

Fired when object keys are enumerated (`Object.keys`, `for...in`, spread).

| Parameter | Type | Description |
| --- | --- | --- |
| `keys` | `PropertyKey[]` | Array of property keys |
| `target` | `T` | The raw target object (not the proxy) |

```typescript
const $state = state(
  { a: 1, b: 2 },
  {
    onOwnKeys: (keys, target) => {
      console.log(`Keys accessed: ${keys.join(', ')}`)
    },
  }
)

Object.keys($state) // "Keys accessed: a, b"
```

## EffectHooks

Hooks for monitoring effect lifecycle and behavior.

```typescript
interface EffectHooks {
  onRun?: SingleOrArray<HookFunction<[effectName?: string]>>
  onDispose?: SingleOrArray<HookFunction<[effectName?: string]>>
  onError?: SingleOrArray<HookFunction<[error: Error, effectName?: string]>>
  onDependencyAdd?: SingleOrArray<HookFunction<[target: object, prop: PropertyKey, effectName?: string]>>
  onSchedule?: SingleOrArray<HookFunction<[effectName?: string]>>
}
```

> `onDependencyTrack` was renamed to `onDependencyAdd` for clarity.

### onRun

Fired when an effect executes.

| Parameter | Type | Description |
| --- | --- | --- |
| `effectName` | `string?` | Optional name provided to the effect |

```typescript
const dispose = effect(
  () => {
    console.log('Effect body')
  },
  'myEffect',
  {
    onRun: (name) => {
      console.log(`Running effect: ${name}`)
    },
  }
)
// "Running effect: myEffect"
// "Effect body"
```

### onDispose

Fired when an effect is disposed.

| Parameter | Type | Description |
| --- | --- | --- |
| `effectName` | `string?` | Optional name provided to the effect |

```typescript
const dispose = effect(
  () => {
    // effect body
  },
  'myEffect',
  {
    onDispose: (name) => {
      console.log(`Disposing effect: ${name}`)
    },
  }
)

dispose() // "Disposing effect: myEffect"
```

### onError

Fired when an effect throws an error.

| Parameter | Type | Description |
| --- | --- | --- |
| `error` | `Error` | The error that was thrown |
| `effectName` | `string?` | Optional name provided to the effect |

```typescript
effect(
  () => {
    throw new Error('Something went wrong')
  },
  'errorEffect',
  {
    onError: (error, name) => {
      console.error(`Error in ${name}: ${error.message}`)
    },
  }
)
// "Error in errorEffect: Something went wrong"
```

### onDependencyAdd

Fired when an effect adds a new dependency.

| Parameter | Type | Description |
| --- | --- | --- |
| `target` | `object` | The object being tracked |
| `prop` | `PropertyKey` | The property being tracked |
| `effectName` | `string?` | Optional name provided to the effect |

```typescript
const $state = state({ count: 0 })

effect(
  () => {
    const value = $state.count // dependency tracked here
  },
  'tracker',
  {
    onDependencyAdd: (target, prop, name) => {
      console.log(`${name} tracks ${String(prop)}`)
    },
  }
)
// "tracker tracks count"
```

### onSchedule

Fired when an effect is scheduled for re-execution.

| Parameter | Type | Description |
| --- | --- | --- |
| `effectName` | `string?` | Optional name provided to the effect |

```typescript
const $state = state({ count: 0 })

effect(
  () => {
    console.log($state.count)
  },
  'counter',
  {
    onSchedule: (name) => {
      console.log(`Scheduling ${name} for re-run`)
    },
  }
)

$state.count++ // "Scheduling counter for re-run"
```

## DeriveHooks

Hooks for monitoring computed values.

```typescript
interface DeriveHooks<T = any> {
  onCompute?: SingleOrArray<HookFunction<[previousValue: T | undefined]>>
  onCacheHit?: SingleOrArray<HookFunction<[value: T, cacheHit: boolean]>>
  onDispose?: SingleOrArray<HookFunction<[]>>
  onError?: SingleOrArray<HookFunction<[error: Error]>>
  onDependencyChange?: SingleOrArray<HookFunction<[target: object, prop: PropertyKey]>>
}
```

> Hooks no longer track counts internally — hooks can maintain their own metrics if needed.

### onCompute

Fired when a derived value is recomputed.

| Parameter | Type | Description |
| --- | --- | --- |
| `previousValue` | `T \| undefined` | The previous computed value |

```typescript
const $count = state({ value: 0 })

const $doubled = derive(() => $count.value * 2, {
  onCompute: (prev) => {
    console.log(`Computing... Previous: ${prev}`)
  },
})
// "Computing... Previous: undefined"

$count.value = 5
// "Computing... Previous: 0"
```

### onCacheHit

Fired when a derived value is accessed.

| Parameter | Type | Description |
| --- | --- | --- |
| `value` | `T` | The value being returned |
| `cacheHit` | `boolean` | Whether this is a cached value or freshly computed |

```typescript
const $expensive = derive(() => complexCalculation(), {
  onCacheHit: (value, cacheHit) => {
    if (cacheHit) {
      console.log(`Returning cached value: ${value}`)
    } else {
      console.log(`Computed fresh value: ${value}`)
    }
  },
})

const v1 = $expensive.value // "Computed fresh value: [value]"
const v2 = $expensive.value // "Returning cached value: [value]"
```

### onDispose

Fired when a derive is disposed (`reactive` set to `false`).

No parameters.

### onError

Fired when the compute function throws.

| Parameter | Type | Description |
| --- | --- | --- |
| `error` | `Error` | The error that was thrown |

### onDependencyChange

Fired when a dependency changes.

| Parameter | Type | Description |
| --- | --- | --- |
| `target` | `object` | The object that changed |
| `prop` | `PropertyKey` | The property that changed |

```typescript
const $state = state({ x: 1, y: 2 })

const $sum = derive(() => $state.x + $state.y, {
  onDependencyChange: (target, prop) => {
    console.log(`Dependency ${String(prop)} changed`)
  },
})

$state.x = 10 // "Dependency x changed"
```

## BatchHooks

Hooks for monitoring batch operations.

```typescript
interface BatchHooks {
  onBatchStart?: SingleOrArray<HookFunction<[depth: number]>>
  onBatchEnd?: SingleOrArray<HookFunction<[depth: number]>>
  onBatchError?: SingleOrArray<HookFunction<[error: Error, depth: number]>>
}
```

> `onBatchEnd` no longer includes `updateCount` — hooks can track their own metrics if needed.

### onBatchStart

Fired when a batch operation begins.

| Parameter | Type | Description |
| --- | --- | --- |
| `depth` | `number` | Nesting depth of the batch |

```typescript
batch(
  () => {
    // batch operations
  },
  {
    onBatchStart: (depth) => {
      console.log(`Batch started at depth ${depth}`)
    },
  }
)
// "Batch started at depth 1"
```

### onBatchEnd

Fired when a batch operation completes.

| Parameter | Type | Description |
| --- | --- | --- |
| `depth` | `number` | Nesting depth of the batch |

```typescript
const $state = state({ a: 0, b: 0 })

batch(
  () => {
    $state.a = 1
    $state.b = 2
  },
  {
    onBatchEnd: (depth) => {
      console.log(`Batch at depth ${depth} completed`)
    },
  }
)
// "Batch at depth 1 completed"
```

### onBatchError

Fired when a batch operation throws an error.

| Parameter | Type | Description |
| --- | --- | --- |
| `error` | `Error` | The error that was thrown |
| `depth` | `number` | Nesting depth where error occurred |

```typescript
batch(
  () => {
    throw new Error('Batch failed')
  },
  {
    onBatchError: (error, depth) => {
      console.error(`Batch error at depth ${depth}: ${error.message}`)
    },
  }
)
// "Batch error at depth 1: Batch failed"
```

## Core API integration

How hooks are passed to each primitive:

### state()

```typescript
function state<T extends object>(initial: T, hooks?: StateHooks<T>): T
```

```typescript
const $user = state(
  { name: 'Alice', age: 30 },
  {
    onRead: logRead(),
    onWrite: [logWrite(), persist('user-data')],
  }
)
```

### effect()

```typescript
function effect(fn: EffectCallback, name?: string, hooks?: EffectHooks): Unsubscribe
```

```typescript
const dispose = effect(
  () => {
    // effect body
  },
  'myEffect',
  {
    onRun: [logEffect(), profileEffect()],
    onDispose: () => console.log('Cleanup'),
  }
)
```

### derive()

```typescript
function derive<T>(computeFn: () => T, hooks?: DeriveHooks<T>): ComputedValue<T>
```

```typescript
const $computed = derive(() => expensiveCalculation(), {
  onCompute: logDerive(),
  onCacheHit: (value, cacheHit) => {
    if (cacheHit) console.log('Using cached value')
  },
})
```

### batch()

```typescript
function batch<T>(fn: () => T, hooks?: BatchHooks): T
```

```typescript
batch(
  () => {
    // multiple state updates
  },
  {
    onBatchStart: () => console.time('batch'),
    onBatchEnd: () => console.timeEnd('batch'),
    onBatchError: [(err) => console.error('Batch failed:', err), (err) => rollback(), (err) => notifyUser()],
  }
)
```

## Array-based composition

### Single hook

```typescript
const $state = state(
  { count: 0 },
  {
    onWrite: logWrite(),
  }
)
```

### Multiple hooks (array)

```typescript
const $state = state(
  { count: 0 },
  {
    onWrite: [logWrite(), persist('storage-key'), validate(validationRules)],
  }
)
```

### Mixed single and array

```typescript
effect(
  () => {
    // effect body
  },
  'myEffect',
  {
    onRun: profileEffect(), // single hook
    onError: [logError(), reportToSentry(), fallbackHandler()], // multiple hooks
  }
)
```

Execution order: array hooks execute in the order they appear. The internal compose function wraps each hook in error isolation — if one throws, others still execute. Undefined and null hooks are ignored.

## TypeScript support

### Generic type parameters

All hooks support generics for type safety:

```typescript
interface User {
  name: string
  age: number
}

const $user = state<User>(
  { name: 'Alice', age: 30 },
  {
    onWrite: (prop, oldValue, newValue, target) => {
      // TypeScript knows target is User
    },
  }
)
```

### Custom hook types

```typescript
import type { StateHooks } from '@nerdalytics/beacon'

function createTypedHook<T>(): StateHooks<T>['onWrite'] {
  return (prop, oldValue, newValue, target) => {
    // fully typed implementation
  }
}

const $state = state<MyType>(initial, {
  onWrite: createTypedHook<MyType>(),
})
```

### Hook factory functions

```typescript
function createLogger<T>(prefix: string): StateHooks<T>['onRead'] {
  return (prop, value, target) => {
    console.log(`${prefix} ${String(prop)} = ${value}`)
  }
}

const $state = state(
  { count: 0 },
  {
    onRead: createLogger('[COUNTER]'),
  }
)
```

## Performance considerations

Each hook adds a function call to the operation:

```typescript
// Without hooks: direct property access
target[prop]

// With hooks: function call + property access
hooks.onRead?.(prop, value, target)
target[prop]
```

Optimization strategies:

1. **Pre-check hook existence** — store boolean flags to avoid repeated optional chaining
2. **Defer heavy computation** — use `queueMicrotask` for expensive work
3. **Filter by property** — check specific properties instead of running on every access

```typescript
// Defer heavy computation
onWrite: (prop, oldValue, newValue) => {
  queueMicrotask(() => performExpensiveAnalysis(oldValue, newValue))
}

// Filter by property
onWrite: (prop) => {
  if (prop === 'important') {
    /* ... */
  }
}
```

## Error handling

Hooks should handle their own errors. The compose function provides error isolation, but you may want visibility:

```typescript
function safeHook<T>(): StateHooks<T>['onWrite'] {
  return (prop, oldValue, newValue, target) => {
    try {
      // hook logic
    } catch (error) {
      console.error('Hook error:', error)
    }
  }
}
```

## Best practices

1. **Keep hooks fast** — avoid heavy computation that slows operations
2. **Use arrays for related hooks** — combine related functionality naturally
3. **Handle errors gracefully** — the compose function provides isolation, but add your own logging
4. **Type your hooks** — use TypeScript generics for better DX
5. **Test hooks independently** — write unit tests for custom hooks
6. **Use async sparingly** — keep hooks synchronous when possible
7. **Document behavior** — clearly describe what custom hooks do
