---
title: State
description: Create and manage reactive objects with automatic dependency tracking
---


`state()` creates reactive objects. It wraps plain JavaScript objects in Proxies for automatic dependency tracking and change notification.

## API

```typescript
function state<T extends object>(initial: T, hooks?: StateHooks<T>): T
```

Returns a Proxy-wrapped version of the input object. Passing a non-object returns the value as-is. See [Hooks](/v2000.0.0/hooks-overview) for the optional hooks parameter.

## Creating reactive state

```typescript
import { state } from '@nerdalytics/beacon'

// Simple object
const $user = state({ name: 'Alice', age: 30 })

// Nested object
const $app = state({
  user: { name: 'Alice', role: 'admin' },
  settings: { theme: 'dark', notifications: true },
})

// Arrays
const $todos = state([
  { id: 1, text: 'Learn Beacon', done: false },
  { id: 2, text: 'Build app', done: false },
])
```

## Natural JavaScript syntax

The Proxy-based approach means standard JavaScript operations work as expected:

```typescript
const $counter = state({ count: 0 })

// Write
$counter.count = 5
$counter.count++

// Read
console.log($counter.count) // 6

// Object operations
const $user = state({ name: 'Alice' })
$user.email = 'alice@example.com' // Add property
delete $user.email // Delete property

// Array operations
const $items = state([1, 2, 3])
$items.push(4) // Mutating methods work
$items[0] = 10 // Index assignment works
```

## How it works

### Proxy creation

When you call `state(obj)`, Beacon:

1. Checks if a proxy already exists for this object (cache lookup)
2. Creates a new Proxy with handler traps
3. Stores the proxy-target relationship
4. Returns the proxy

### Property access interception

The Proxy intercepts all operations:

```typescript
const $data = state({ value: 42 })

// This seemingly simple operation:
$data.value++

// Actually triggers:
// 1. Proxy 'get' trap -> reads current value (42)
// 2. Increment operation -> adds 1 to make 43
// 3. Proxy 'set' trap -> compares old (42) vs new (43)
// 4. Since values differ -> updates and notifies subscribers

// Setting to the same value skips notification
$data.value = 43 // No effect triggered if already 43
```

### Nested reactivity

Objects are wrapped recursively:

```typescript
const $app = state({
  user: {
    profile: {
      name: 'Alice',
    },
  },
})

// All levels are reactive
$app.user.profile.name = 'Bob' // Triggers updates
```

## Performance

Every property access has overhead:

- **Direct object**: ~3ms for 1M operations
- **Proxied object**: ~75ms for 1M operations (batched)
- **Trade-off**: Natural syntax for 4x performance cost

Internally, Beacon optimizes by manipulating the raw target directly. The proxy trap intercepts the operation, performs direct manipulation on the underlying object, then queues the notification.

## Patterns

### Component state

```typescript
function createCounter() {
  const $s = state({ count: 0 })

  return {
    state: $s,
    increment: () => $s.count++,
    decrement: () => $s.count--,
    reset: () => ($s.count = 0),
  }
}
```

### Global store

```typescript
// store.ts
export const $appState = state({
  user: null,
  isLoading: false,
  errors: [],
})

// anywhere.ts
import { $appState } from './store'
$appState.user = { id: 1, name: 'Alice' }
```

### Configuration objects

```typescript
const $config = state({
  api: {
    baseUrl: 'https://api.example.com',
    timeout: 5000,
    retries: 3,
  },
  features: {
    darkMode: false,
    notifications: true,
  },
})

// React to config changes
effect(() => {
  console.log(`Dark mode: ${$config.features.darkMode}`)
})
```

## Limitations

### Primitive values

`state()` only works with objects, not primitives:

```typescript
// Won't work - returns primitive as-is
const $count = state(0)

// Wrap in an object instead
const $counter = state({ value: 0 })
```

### Object identity

The proxy is a different object than the original:

```typescript
const original = { count: 0 }
const $reactive = state(original)

console.log(original === $reactive) // false
console.log(original.count === $reactive.count) // true (same value)
```

### Class instances

Methods may not work as expected due to `this` binding issues:

```typescript
class Counter {
  count = 0
  increment() {
    this.count++ // 'this' context issues
  }
}

const $counter = state(new Counter())
// May have issues with 'this' binding
```

### Built-in objects

Some built-in objects don't work well with Proxies:

```typescript
// Problematic
const $date = state(new Date())
const $map = state(new Map())

// Better: wrap in a plain object
const $s = state({
  date: new Date(),
  map: new Map(),
})
```

## Best practices

### Keep state shape stable

Define the full shape upfront:

```typescript
// Good - shape is clear
const $user = state({
  id: null,
  name: '',
  email: '',
  preferences: {
    theme: 'light',
    notifications: true,
  },
})

// Avoid - dynamic shape
const $user = state({})
$user.preferences = {} // Added later
$user.preferences.theme = 'dark' // Nested addition
```

### Batch multiple updates

```typescript
import { batch } from '@nerdalytics/beacon'

// Triggers 3 separate updates
s.x = 1
s.y = 2
s.z = 3

// Single update
batch(() => {
  s.x = 1
  s.y = 2
  s.z = 3
})
```

### Use immutable updates for arrays

While mutating methods work, immutable updates can be clearer:

```typescript
const $todos = state({ items: [] })

// Mutating (works)
$todos.items.push(newTodo)

// Immutable (also works, sometimes clearer)
$todos.items = [...$todos.items, newTodo]
```

## Integration with effects

State changes trigger effects that depend on them:

```typescript
const $user = state({ name: 'Alice', age: 30 })

// Re-runs whenever $user.age changes
effect(() => {
  console.log(`Happy Birthday ${$user.name} to your ${$user.age}th year!`)
})

$user.name = 'Bob' // Doesn't trigger (name not accessed during tracking)
$user.age = 31 // Triggers effect
```

## Memory management

State objects are garbage collected when no longer referenced. Beacon uses WeakMaps internally, so there's no manual cleanup needed for state itself.

```typescript
function createTemporaryState() {
  const $temp = state({ data: 'temporary' })

  effect(() => {
    console.log($temp.data)
  })

  // When '$temp' goes out of scope, the state
  // and its effects are eligible for GC
}
```

## Frozen and sealed objects

Beacon handles non-extensible objects using WeakMap fallbacks:

```typescript
const frozen = Object.freeze({ value: 42 })
const $reactive = state(frozen) // Still works

// Beacon stores metadata in WeakMaps instead of on the object
```

## Type safety

TypeScript fully understands the proxy:

```typescript
interface User {
  name: string
  age: number
  email?: string
}

const $user = state<User>({ name: 'Alice', age: 30 })

$user.name = 'Bob' // Type-safe
$user.age = 'thirty' // Type error
$user.email = 'alice@example.com' // Optional property
```

## Performance tips

1. **Avoid reading in hot loops** — cache values outside loops
2. **Batch updates** — use `batch()` for multiple changes
3. **Minimize nesting depth** — deeply nested objects have more overhead
4. **Use primitive comparisons** — `Object.is()` is used for equality
