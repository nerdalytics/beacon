# Beacon <img align="right" src="https://raw.githubusercontent.com/nerdalytics/beacon/refs/heads/trunk/assets/beacon-logo-v2.svg" width="128px" alt="A stylized lighthouse beacon with golden light against a dark blue background, representing the reactive state library"/>

> Lightweight reactive state management for Node.js backends


[![license:mit](https://flat.badgen.net/static/license/MIT/blue)](https://github.com/nerdalytics/beacon/blob/trunk/LICENSE)
[![registry:npm:version](https://img.shields.io/npm/v/@nerdalytics/beacon.svg)](https://www.npmjs.com/package/@nerdalytics/beacon)
[![Socket Badge](https://badge.socket.dev/npm/package/@nerdalytics/beacon/1000.2.3)](https://socket.dev/npm/package/@nerdalytics/beacon/overview/1000.2.3)

[![tech:nodejs](https://img.shields.io/badge/Node%20js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![language:typescript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org/)
[![linter:biome](https://img.shields.io/badge/biome-60a5fa?style=for-the-badge&logo=biome&logoColor=white)](https://biomejs.dev/)

A lightweight reactive state library for Node.js backends. Enables reactive state management with automatic dependency tracking and efficient updates for server-side applications.

<details>
<summary><Strong>Table of Contents</Strong></summary>

- [Features](#features)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [API Reference](#api-reference)
   - [Core Primitives](#core-primitives)
      - [state](#statetinitialvalue-t-equalityfn-a-t-b-t--boolean-statet)
      - [derive](#derivetfn---t-readonlystatet)
      - [effect](#effectfn---void---void)
      - [batch](#batchtfn---t-t)
- [Advanced Features](#advanced-features)
   - [Infinite Loop Protection](#infinite-loop-protection)
   - [Automatic Cleanup](#automatic-cleanup)
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

// Create reactive state - now using objects with properties
const signal = state({ count: 0 });

// Create a derived value
const doubled = derive(() => signal.count * 2);

// Set up an effect
const dispose = effect(() => {
  console.log(`Count: ${signal.count}, Doubled: ${doubled.value}`);
});
// => "Count: 0, Doubled: 0"

// Update the state - just use regular assignment!
signal.count = 5;
// => "Count: 5, Doubled: 10"

// Clean up when done (important for memory management)
dispose();
doubled.dispose();
```

## Core Concepts

Beacon is built around three core primitives:

1. **States**: Mutable, reactive values
2. **Derived States**: Computed values that update automatically
3. **Effects**: Side effects that run automatically when dependencies change

The library handles all the dependency tracking and updates automatically, so you can focus on your business logic.

## API Reference

### Version Compatibility

The table below tracks when features were introduced and when function signatures were changed.

| API | Introduced | Last Updated | Notes |
|-----|------------|--------------|-------|
| `state` | v1.0.0 | v2000.0.0 | Now Proxy-based, returns reactive object |
| `derive` | v1.0.0 | v2000.0.1 | Returns `{value: T, dispose(), [Symbol.dispose]()}` |
| `effect` | v1.0.0 | - | - |
| `batch` | v1.0.0 | - | - |
| `select` | v1000.0.0 | v2000.0.0 | **Removed** |
| `lens` | v1000.1.0 | v2000.0.0 | **Removed** |
| `readonlyState` | v1000.0.0 | v2000.0.0 | **Removed** |
| `protectedState` | v1000.0.0 | v2000.0.0 | **Removed** |

### Core Primitives

#### `state<T extends object>(initialValue: T): T`
> *Since v1.0.0, Proxy-based since v2000.0.0*

Creates a reactive object. All property access and mutations are automatically tracked.

```typescript
import { state } from '@nerdalytics/beacon';

// Create reactive state
const signal = state({ count: 0, name: 'Alice' });

// Read values directly
console.log(signal.count); // => 0
console.log(signal.name); // => 'Alice'

// Update with regular assignment
signal.count = 5;
signal.name = 'Bob';

// Works with nested objects
const app = state({
  user: { name: 'Alice', age: 30 },
  settings: { theme: 'dark' }
});

app.user.age = 31; // Triggers updates
app.settings = { theme: 'light' }; // Also reactive

// Arrays are fully reactive
const todos = state([
  { id: 1, text: 'Learn Beacon', done: false }
]);

todos.push({ id: 2, text: 'Build app', done: false });
todos[0].done = true;
```

#### `derive<T>(fn: () => T): ComputedValue<T>`
> *Since v1.0.0, Returns `{value: T, dispose(): void}` since v2000.0.0*

Calculate values based on other states. Updates automatically when dependencies change.
**Important**: Derived values must be disposed when no longer needed to prevent memory leaks.

```typescript
import { state, derive } from '@nerdalytics/beacon';

const signal = state({
  firstName: 'John',
  lastName: 'Doe'
});

const fullName = derive(() => `${signal.firstName} ${signal.lastName}`);

console.log(fullName.value); // => "John Doe"

signal.firstName = 'Jane';
console.log(fullName.value); // => "Jane Doe"

// Clean up when done
fullName.dispose();

// With Symbol.dispose (Node.js 20.5+)
const another = derive(() => signal.firstName.toUpperCase());
another[Symbol.dispose]();
```

#### `effect(fn: () => void): () => void`
> *Since v1.0.0*

Run side effects when reactive values change.

```typescript
import { state, effect } from '@nerdalytics/beacon';

const user = state({ name: 'Alice', loggedIn: false });

const cleanup = effect(() => {
  console.log(`User ${user.name} is ${user.loggedIn ? 'online' : 'offline'}`);
});
// => "User Alice is offline" (effect runs immediately when created)

user.loggedIn = true;
// => "User Alice is online"

// Stop the effect and clean up all subscriptions
cleanup();

user.loggedIn = false; // won't trigger the effect anymore
// => No output (effect is unsubscribed)
```

#### `batch<T>(fn: () => T): T`
> *Since v1.0.0*

Group multiple updates to trigger effects only once.

```typescript
import { state, effect, batch } from "@nerdalytics/beacon";

const signal = state({ count: 0 });

effect(() => {
  console.log(`Count is ${signal.count}`);
});
// => "Count is 0" (effect runs immediately)

// Without batching, effects run after each update
signal.count = 1;
// => "Count is 1"
signal.count = 2;
// => "Count is 2"

// Batch updates (only triggers effects once at the end)
batch(() => {
  signal.count = 10;
  signal.count = 20;
  signal.count = 30;
});
// => "Count is 30" (only once)
```


## Advanced Features

Beacon includes several advanced capabilities that help you build robust applications.

### Infinite Loop Protection

Beacon prevents common mistakes that could cause infinite loops:

```typescript
import { state, effect } from '@nerdalytics/beacon';

const signal = state({ count: 0 });

// This would throw an error
effect(() => {
  const value = signal.count;
  signal.count = value + 1; // Error: Infinite loop detected!
});

// Instead, use proper patterns like:
const increment = () => signal.count++;
```

### Automatic Cleanup

All subscriptions are automatically cleaned up when effects are unsubscribed:

```typescript
import { state, effect } from '@nerdalytics/beacon';

const data = state({ loading: true, items: [] });

// Effect with nested effect
const cleanup = effect(() => {
  if (data.loading) {
    console.log('Loading...');
  } else {
    // This nested effect is automatically cleaned up when the parent is
    effect(() => {
      console.log(`${data.items.length} items loaded`);
    });
  }
});

// Unsubscribe cleans up everything, including nested effects
cleanup();
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
  const value = signal.count;
  signal.count = value + 1; // Error! Updating a state the effect depends on
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
| **API Style**               | Proxy-based with natural JS syntax (`state()`, `derive()`)                  | Class-based design (`Signal.State`, `Signal.Computed`)                                        |
| **Reading/Writing Pattern** | Direct property access (`signal.count`) and assignment (`signal.count = 5`) | Method-based access (`get()`/`set()`)                                                         |
| **Framework Support**       | High-level abstractions like `effect()` and `batch()`                       | Lower-level primitives (`Signal.subtle.Watcher`) that frameworks build upon                   |
| **Advanced Features**       | Focused on core reactivity with automatic cleanup                           | Includes introspection capabilities, watched/unwatched callbacks, and Signal.subtle namespace |
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
  stats.requests++;
  next();
});

// Log stats every minute
effect(() => {
  console.log(`Stats: ${stats.requests} requests, ${stats.errors} errors`);
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
