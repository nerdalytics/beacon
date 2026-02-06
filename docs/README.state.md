# State

## Overview

`state()` is the foundational primitive in Beacon that creates reactive objects. It wraps plain JavaScript objects in Proxies to enable automatic dependency tracking and change notification.

## API Reference

```typescript
function state<T extends object>(initial: T, hooks?: StateHooks<T>): T
```

Returns a Proxy-wrapped version of the input object. Passing a non-object returns the value as-is. For hooks, see [Hooks](./README.hooks.md).

## Core Concepts

### Creating Reactive State

```typescript
import { state } from '@nerdalytics/beacon';

// Simple object
const user = state({ name: 'Alice', age: 30 });

// Nested object
const app = state({
  user: { name: 'Alice', role: 'admin' },
  settings: { theme: 'dark', notifications: true }
});

// Arrays
const todos = state([
  { id: 1, text: 'Learn Beacon', done: false },
  { id: 2, text: 'Build app', done: false }
]);
```

### Natural JavaScript Syntax

The key advantage of Beacon's Proxy-based approach is natural JavaScript operations:

```typescript
// Initialize state
const counter = state({ count: 0 });

// Write
counter.count = 5;
counter.count++;

// Read
console.log(counter.count);  // 6
console.log(counter);  // { count: 6 }

// Object operations
const user = state({ name: 'Alice' });
user.email = 'alice@example.com';  // Add property
delete user.email;  // Delete property

// Array operations
const items = state([1, 2, 3]);
items.push(4);  // Mutating methods work
items[0] = 10;  // Index assignment works
```

## How It Works

### 1. Proxy Creation

When you call `state(obj)`, Beacon:
1. Checks if a proxy already exists for this object (cache lookup)
2. Creates a new Proxy with handler traps
3. Stores the proxy-target relationship
4. Returns the proxy

### 2. Property Access Interception

The Proxy intercepts all operations:

```typescript
const data = state({ value: 42 });

// This seemingly simple operation:
data.value++;

// Actually triggers:
// 1. Proxy 'get' trap -> reads current value (42)
// 2. Increment operation -> adds 1 to make 43
// 3. Proxy 'set' trap -> compares old (42) vs new (43)
// 4. Since values differ -> updates and notifies subscribers

// Note: Setting to same value skips notification
data.value = 43;  // No effect triggered if already 43
```

### 3. Nested Reactivity

Objects are wrapped recursively:

```typescript
const app = state({
  user: {
    profile: {
      name: 'Alice'
    }
  }
});

// All levels are reactive
app.user.profile.name = 'Bob';  // Triggers updates
```

## Performance Characteristics

### Proxy Overhead

Every property access has overhead:
- **Direct object**: ~3ms for 1M operations
- **Proxied object**: ~75ms for 1M operations (batched)
- **Trade-off**: Natural syntax for 4x performance cost

### Optimization: Direct Target Manipulation

Internally, Beacon optimizes by manipulating the raw target directly:

```typescript
// User writes (goes through proxy)
counter.count++;

// Internally optimized to:
// 1. Proxy trap intercepts
// 2. Direct manipulation: rawTarget.count++
// 3. Notification queued
```

## Common Patterns

### 1. Component State

```typescript
function createCounter() {
  const state = state({ count: 0 });

  return {
    state,
    increment: () => state.count++,
    decrement: () => state.count--,
    reset: () => state.count = 0
  };
}
```

### 2. Global Store

```typescript
// store.ts
export const appState = state({
  user: null,
  isLoading: false,
  errors: []
});

// anywhere.ts
import { appState } from './store';
appState.user = { id: 1, name: 'Alice' };
```

### 3. Configuration Objects

```typescript
const config = state({
  api: {
    baseUrl: 'https://api.example.com',
    timeout: 5000,
    retries: 3
  },
  features: {
    darkMode: false,
    notifications: true
  }
});

// React to config changes
effect(() => {
  console.log(`Dark mode: ${config.features.darkMode}`);
});
```

## Limitations and Gotchas

### 1. Primitive Values

`state()` only works with objects, not primitives:

```typescript
// ❌ Won't work
const count = state(0);

// ✅ Wrap in object
const counter = state({ value: 0 });
```

### 2. Object Identity

The proxy is a different object than the original:

```typescript
const original = { count: 0 };
const reactive = state(original);

console.log(original === reactive);  // false
console.log(original.count === reactive.count);  // true (same value)
```

### 3. Class Instances

Be careful with class instances - methods may not work as expected:

```typescript
class Counter {
  count = 0;
  increment() {
    this.count++;  // 'this' context issues
  }
}

const counter = state(new Counter());
// May have issues with 'this' binding
```

### 4. Built-in Objects

Some built-in objects don't work well with Proxies:

```typescript
// ❌ Problematic
const date = state(new Date());
const map = state(new Map());

// ✅ Better approach
const state = state({
  date: new Date(),
  map: new Map()
});
```

## Best Practices

### 1. Keep State Shape Stable

Define the full shape upfront when possible:

```typescript
// ✅ Good - shape is clear
const user = state({
  id: null,
  name: '',
  email: '',
  preferences: {
    theme: 'light',
    notifications: true
  }
});

// ❌ Avoid - dynamic shape
const user = state({});
user.preferences = {};  // Added later
user.preferences.theme = 'dark';  // Nested addition
```

### 2. Batch Multiple Updates

```typescript
import { batch } from '@nerdalytics/beacon';

// ❌ Triggers 3 separate updates
state.x = 1;
state.y = 2;
state.z = 3;

// ✅ Single update
batch(() => {
  state.x = 1;
  state.y = 2;
  state.z = 3;
});
```

### 3. Use Immutable Updates for Arrays

While mutating methods work, immutable updates can be clearer:

```typescript
const todos = state({ items: [] });

// Mutating (works)
todos.items.push(newTodo);

// Immutable (also works, sometimes clearer)
todos.items = [...todos.items, newTodo];
```

## Integration with Effects

State changes trigger effects that depend on them:

```typescript
const user = state({ name: 'Alice', age: 30 });

// This effect will re-run whenever user.age changes
effect(() => {
  console.log(`Happy Birthday ${user.name} to your ${user.age}th year!`);
});

user.name = 'Bob';  // Doesn't trigger effect (not accessed)
user.age = 31;  // Triggers effect
// Happy Birthday Bob to your 31th year!`
```

## Memory Management

State objects are automatically garbage collected when no longer referenced:

```typescript
function createTemporaryState() {
  const temp = state({ data: 'temporary' });

  effect(() => {
    console.log(temp.data);
  });

  // When this function returns and 'temp' goes out of scope,
  // the state and its effects are eligible for GC
}
```

## Advanced: Frozen and Sealed Objects

Beacon handles non-extensible objects using WeakMap fallbacks:

```typescript
const frozen = Object.freeze({ value: 42 });
const reactive = state(frozen);  // Still works!

// Beacon stores metadata in WeakMaps instead of on the object
```

## Hooks

`state()` accepts an optional `hooks` parameter for observing proxy operations — reads, writes, deletes, `in` checks, and key enumeration. See [Hooks](./README.hooks.md) for the full API and examples.

## Performance Tips

1. **Avoid reading in hot loops**: Cache values outside loops
2. **Batch updates**: Use `batch()` for multiple changes
3. **Minimize nesting depth**: Deeply nested objects have more overhead
4. **Use primitive comparisons**: Object.is() is used for equality

## Type Safety

TypeScript fully understands the proxy:

```typescript
interface User {
  name: string;
  age: number;
  email?: string;
}

const user = state<User>({ name: 'Alice', age: 30 });

user.name = 'Bob';  // ✅ Type-safe
user.age = 'thirty';  // ❌ Type error
user.email = 'alice@example.com';  // ✅ Optional property
```
