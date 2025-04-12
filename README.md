# Beacon <img align="right" src="https://raw.githubusercontent.com/nerdalytics/beacon/refs/heads/trunk/assets/beacon-logo.svg" width="128px" alt="A stylized lighthouse beacon with golden light against a dark blue background, representing the reactive state library"/>

> Lightweight reactive state management for Node.js backends

![license:mit](https://flat.badgen.net/static/license/MIT/blue)
![registry:npm:version](https://img.shields.io/npm/v/@nerdalytics/beacon.svg)

![tech:nodejs](https://img.shields.io/badge/Node%20js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![language:typescript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![linter:biome](https://img.shields.io/badge/biome-60a5fa?style=for-the-badge&logo=biome&logoColor=white)

A lightweight reactive state library for Node.js backends. Enables reactive state management with automatic dependency tracking and efficient updates for server-side applications.

<details>
<summary><Strong>Table of Contents</Strong></summary>

- [Features](#features)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [API Reference](#api-reference)
   - [Core Primitives](#core-primitives)
      - [state](#statetinitialvalue-t-statet)
      - [derive](#derivetfn---t-readonlystatet)
      - [effect](#effectfn---void---void)
      - [batch](#batchtfn---t-t)
      - [select](#selectt-rsource-readonlystatet-selectorfn-state-t--r-equalityfn-a-r-b-r--boolean-readonlystater)
      - [lens](#lenst-ksource-statet-accessor-state-t--k-statek)
   - [Access Control](#access-control)
      - [readonlyState](#readonlystatetstate-statet-readonlystatet)
      - [protectedState](#protectedstatetinitialvalue-t-readonlystatet-writeablestatet)
- [Advanced Features](#advanced-features)
   - [Infinite Loop Protection](#infinite-loop-protection)
   - [Automatic Cleanup](#automatic-cleanup)
   - [Custom Equality Functions](#custom-equality-functions)
- [Design Philosophy](#design-philosophy)
- [Architecture](#architecture)
- [Development](#development)
- [Key Differences vs TC39 Proposal](#key-differences-vs-tc39-proposal)
- [FAQ](#faq)
   - [Why "Beacon" Instead of "Signal"?](#why-beacon-instead-of-signal)
   - [How does Beacon handle memory management?](#how-does-beacon-handle-memory-management)
   - [Can I use Beacon with Express or other frameworks?](#can-i-use-beacon-with-express-or-other-frameworks)
   - [Can Beacon be used in browser applications?](#can-beacon-be-used-in-browser-applications)
- [License](#license)

</details>

## Features

- 📶 **Reactive state** - Create reactive values that automatically track dependencies
- 🧮 **Computed values** - Derive values from other states with automatic updates
- 🔍 **Fine-grained reactivity** - Dependencies are tracked precisely at the state level
- 🏎️ **Efficient updates** - Only recompute values when dependencies change
- 📦 **Batched updates** - Group multiple updates for performance
- 🎯 **Targeted subscriptions** - Select and subscribe to specific parts of state objects
- 🧹 **Automatic cleanup** - Effects and computations automatically clean up dependencies
- ♻️ **Cycle handling** - Safely manages cyclic dependencies without crashing
- 🚨 **Infinite loop detection** - Automatically detects and prevents infinite update loops
- 🛠️ **TypeScript-first** - Full TypeScript support with generics
- 🪶 **Lightweight** - Zero dependencies
- ✅ **Node.js compatibility** - Works with Node.js LTS v20+ and v22+

## Quick Start

```other
npm install @nerdalytics/beacon --save-exact
```

```typescript
import { state, derive, effect } from '@nerdalytics/beacon';

// Create reactive state
const count = state(0);

// Create a derived value
const doubled = derive(() => count() * 2);

// Set up an effect
effect(() => {
  console.log(`Count: ${count()}, Doubled: ${doubled()}`);
});
// => "Count: 0, Doubled: 0"

// Update the state - effect runs automatically
count.set(5);
// => "Count: 5, Doubled: 10"
```

## Core Concepts

Beacon is built around three core primitives:

1. **States**: Mutable, reactive values
2. **Derived States**: Read-only computed values that update automatically
3. **Effects**: Side effects that run automatically when dependencies change

The library handles all the dependency tracking and updates automatically, so you can focus on your business logic.

## API Reference

### Core Primitives

#### `state<T>(initialValue: T): State<T>`

The foundation of Beacon's reactivity system. Create with `state()` and use like a function.

```typescript
import { state } from '@nerdalytics/beacon';

const counter = state(0);

// Read current value
console.log(counter()); // => 0

// Update value
counter.set(5);
console.log(counter()); // => 5

// Update with a function
counter.update(n => n + 1);
console.log(counter()); // => 6
```

#### `derive<T>(fn: () => T): ReadOnlyState<T>`

Calculate values based on other states. Updates automatically when dependencies change.

```typescript
import { state, derive } from '@nerdalytics/beacon';

const firstName = state('John');
const lastName = state('Doe');

const fullName = derive(() => `${firstName()} ${lastName()}`);

console.log(fullName()); // => "John Doe"

firstName.set('Jane');
console.log(fullName()); // => "Jane Doe"
```

#### `effect(fn: () => void): () => void`

Run side effects when reactive values change.

```typescript
import { state, effect } from '@nerdalytics/beacon';

const user = state({ name: 'Alice', loggedIn: false });

const cleanup = effect(() => {
  console.log(`User ${user().name} is ${user().loggedIn ? 'online' : 'offline'}`);
});
// => "User Alice is offline" (effect runs immediately when created)

user.update(u => ({ ...u, loggedIn: true }));
// => "User Alice is online"

// Stop the effect and clean up all subscriptions
cleanup();
```

#### `batch<T>(fn: () => T): T`

Group multiple updates to trigger effects only once.

```typescript
import { state, effect, batch } from "@nerdalytics/beacon";

const count = state(0);

effect(() => {
  console.log(`Count is ${count()}`);
});
// => "Count is 0" (effect runs immediately)

// Without batching, effects run after each update
count.set(1);
// => "Count is 1"
count.set(2);
// => "Count is 2"

// Batch updates (only triggers effects once at the end)
batch(() => {
  count.set(10);
  count.set(20);
  count.set(30);
});
// => "Count is 30" (only once)
```

#### `select<T, R>(source: ReadOnlyState<T>, selectorFn: (state: T) => R, equalityFn?: (a: R, b: R) => boolean): ReadOnlyState<R>`

Subscribe to specific parts of a state object.

```typescript
import { state, select, effect } from '@nerdalytics/beacon';

const user = state({
  profile: { name: 'Alice' },
  preferences: { theme: 'dark' }
});

// Only triggers when name changes
const nameState = select(user, u => u.profile.name);

effect(() => {
  console.log(`Name: ${nameState()}`);
});
// => "Name: Alice"

// This triggers the effect
user.update(u => ({
  ...u,
  profile: { ...u.profile, name: 'Bob' }
}));
// => "Name: Bob"

// This doesn't trigger the effect (theme changed, not name)
user.update(u => ({
  ...u,
  preferences: { ...u.preferences, theme: 'light' }
}));
```

#### `lens<T, K>(source: State<T>, accessor: (state: T) => K): State<K>`

Two-way binding to deeply nested properties.

```typescript
import { state, lens, effect } from "@nerdalytics/beacon";

const nested = state({
  user: {
    profile: {
      settings: {
        theme: "dark",
        notifications: true
      }
    }
  }
});

// Create a lens focused on a deeply nested property
const themeLens = lens(nested, n => n.user.profile.settings.theme);

// Read the focused value
console.log(themeLens()); // => "dark"

// Update the focused value directly (maintains referential integrity)
themeLens.set("light");
console.log(themeLens()); // => "light"
console.log(nested().user.profile.settings.theme); // => "light"

// The entire object is updated with proper referential integrity
// This makes it easy to detect changes throughout the object tree
```

### Access Control

Control who can read vs. write to your state.

#### `readonlyState<T>(state: State<T>): ReadOnlyState<T>`

Creates a read-only view of a state, hiding mutation methods. Useful when you want to expose state to other parts of your application without allowing direct mutations.

```typescript
import { state, readonlyState } from "@nerdalytics/beacon";

const counter = state(0);
const readonlyCounter = readonlyState(counter);

// Reading works
console.log(readonlyCounter()); // => 0

// Updating the original state reflects in the readonly view
counter.set(5);
console.log(readonlyCounter()); // => 5

// This would cause a TypeScript error since readonlyCounter has no set method
// readonlyCounter.set(10); // Error: Property 'set' does not exist
```

#### `protectedState<T>(initialValue: T): [ReadOnlyState<T>, WriteableState<T>]`

Creates a state with separated read and write capabilities, returning a tuple of reader and writer. This pattern allows you to expose only the reading capability to consuming code while keeping the writing capability private.

```typescript
import { protectedState } from "@nerdalytics/beacon";

// Create a state with separated read and write capabilities
const [getUser, setUser] = protectedState({ name: 'Alice' });

// Read the state
console.log(getUser()); // => { name: 'Alice' }

// Update the state
setUser.set({ name: 'Bob' });
console.log(getUser()); // => { name: 'Bob' }

// This is useful for exposing only read access to outside consumers
function createProtectedCounter() {
  const [getCount, setCount] = protectedState(0);

  return {
    value: getCount,
    increment: () => setCount.update(n => n + 1),
    decrement: () => setCount.update(n => n - 1)
  };
}

const counter = createProtectedCounter();
console.log(counter.value()); // => 0
counter.increment();
console.log(counter.value()); // => 1
```

## Advanced Features

Beacon includes several advanced capabilities that help you build robust applications.

### Infinite Loop Protection

Beacon prevents common mistakes that could cause infinite loops:

```typescript
import { state, effect } from '@nerdalytics/beacon';

const counter = state(0);

// This would throw an error
effect(() => {
  const value = counter();
  counter.set(value + 1); // Error: Infinite loop detected!
});

// Instead, use proper patterns like:
const increment = () => counter.update(n => n + 1);
```

### Automatic Cleanup

All subscriptions are automatically cleaned up when effects are unsubscribed:

```typescript
import { state, effect } from '@nerdalytics/beacon';

const data = state({ loading: true, items: [] });

// Effect with nested effect
const cleanup = effect(() => {
  if (data().loading) {
    console.log('Loading...');
  } else {
    // This nested effect is automatically cleaned up when the parent is
    effect(() => {
      console.log(`${data().items.length} items loaded`);
    });
  }
});

// Unsubscribe cleans up everything, including nested effects
cleanup();
```

### Custom Equality Functions

Control when subscribers are notified with custom equality checks:

```typescript
import { state, select, effect } from '@nerdalytics/beacon';

const list = state([1, 2, 3]);

// Only notify when array length changes, not on reference changes
const listLengthState = select(
  list,
  arr => arr.length,
  (a, b) => a === b
);

effect(() => {
  console.log(`List has ${listLengthState()} items`);
});
```

## Design Philosophy

Beacon follows these key principles:

1. **Simplicity**: Minimal API surface with powerful primitives
2. **Fine-grained reactivity**: Track dependencies at exactly the right level
3. **Predictability**: State changes flow predictably through the system
4. **Performance**: Optimize for server workloads and memory efficiency
5. **Type safety**: Full TypeScript support with generics

## Architecture

Beacon is built around a centralized reactivity system with fine-grained dependency tracking. Here's how it works:

- **Automatic Dependency Collection**: When a state is read inside an effect, Beacon automatically records this dependency
- **WeakMap-based Tracking**: Uses WeakMaps for automatic garbage collection
- **Topological Updates**: Updates flow through the dependency graph in the correct order
- **Memory-Efficient**: Designed for long-running Node.js processes

### Dependency Tracking

When a state is read inside an effect, Beacon automatically records this dependency relationship and sets up a subscription.

### Infinite Loop Prevention

Beacon actively detects when an effect tries to update a state it depends on, preventing common infinite update cycles:

```typescript
// This would throw: "Infinite loop detected"
effect(() => {
  const value = counter();
  counter.set(value + 1); // Error! Updating a state the effect depends on
});
```

### Cyclic Dependencies

Beacon employs two complementary strategies for handling cyclical updates:

1. **Active Detection**: The system tracks which states an effect reads from and writes to. If an effect attempts to directly update a state it depends on, Beacon throws a clear error.
2. **Safe Cycles**: For indirect cycles and safe update patterns, Beacon uses a queue-based update system that won't crash even with cyclical dependencies. When states form a cycle where values eventually stabilize, the system handles these updates efficiently without stack overflows.

## Development

```other
# Install dependencies
npm install

# Run tests
npm test
```

## Key Differences vs [TC39 Proposal][1]

| **Aspect**                  | **@nerdalytics/beacon**                                                     | **TC39 Proposal**                                                                             |
| --------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **API Style**               | Functional approach (`state()`, `derive()`)                                 | Class-based design (`Signal.State`, `Signal.Computed`)                                        |
| **Reading/Writing Pattern** | Function call for reading (`count()`), methods for writing (`count.set(5)`) | Method-based access (`get()`/`set()`)                                                         |
| **Framework Support**       | High-level abstractions like `effect()` and `batch()`                       | Lower-level primitives (`Signal.subtle.Watcher`) that frameworks build upon                   |
| **Advanced Features**       | Focused on core reactivity                                                  | Includes introspection capabilities, watched/unwatched callbacks, and Signal.subtle namespace |
| **Scope and Purpose**       | Practical Node.js use cases with minimal API surface                        | Standardization with robust interoperability between frameworks                               |

## FAQ

#### Why "Beacon" Instead of "Signal"?

Beacon represents how the library broadcasts notifications when state changes—just like a lighthouse guides ships. The name avoids confusion with the TC39 proposal and similar libraries while accurately describing the core functionality.

#### How does Beacon handle memory management?

Beacon uses WeakMaps for dependency tracking, ensuring that unused states and effects can be garbage collected. When you unsubscribe an effect, all its internal subscriptions are automatically cleaned up.

#### Can I use Beacon with Express or other frameworks?

Yes! Beacon works well as a state management solution in any Node.js application:

```typescript
import express from 'express';
import { state, effect } from '@nerdalytics/beacon';

const app = express();
const stats = state({ requests: 0, errors: 0 });

// Update stats on each request
app.use((req, res, next) => {
  stats.update(s => ({ ...s, requests: s.requests + 1 }));
  next();
});

// Log stats every minute
effect(() => {
  console.log(`Stats: ${stats().requests} requests, ${stats().errors} errors`);
});

app.listen(3000);
```

#### Can Beacon be used in browser applications?

While Beacon is optimized for Node.js server-side applications, its core principles would work in browser environments. However, the library is specifically designed for backend use cases and hasn't been optimized for browser bundle sizes or DOM integration patterns.

## License

This project is licensed under the MIT License. See the [LICENSE][2] file for details.

<div align="center">
  <img src="https://raw.githubusercontent.com/nerdalytics/nerdalytics/refs/heads/main/nerdalytics-logo-gray-transparent.svg" width="128px">
</div>

<!-- Links collection -->

[1]: https://github.com/tc39/proposal-signals
[2]: ./LICENSE
