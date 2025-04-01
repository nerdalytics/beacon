# Beacon

A lightweight reactive signal library for Node.js backends. Enables reactive state management with automatic dependency tracking and efficient updates for server-side applications.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [API](#api)
  - [state](#statetinitialvalue-t-signalt)
  - [derived](#derivedfn--t-signalt)
  - [effect](#effectfn--void--void)
  - [batch](#batchfn--t-t)
  - [selector](#selectorsource-signalt-selectorfn-state-t--r-equalityfn-a-r-b-r--boolean-signalr)
- [Development](#development)
  - [Node.js LTS Compatibility](#nodejs-lts-compatibility)
- [Key Differences vs TC39 Proposal](#key-differences-between-my-library-and-the-tc39-proposal)
- [Implementation Details](#implementation-details)
- [FAQ](#faq)
- [License](#license)

## Features

- 🔄 **Reactive signals** - Create reactive values that automatically track dependencies
- 🧮 **Computed values** - Derive values from other signals with automatic updates
- 🔍 **Fine-grained reactivity** - Dependencies are tracked precisely at the signal level
- 🏎️ **Efficient updates** - Only recompute values when dependencies change
- 📦 **Batched updates** - Group multiple updates for performance
- 🔪 **Targeted subscriptions** - Select and subscribe to specific parts of state objects
- 🧹 **Automatic cleanup** - Effects and computations automatically clean up dependencies
- 🔁 **Cycle handling** - Safely manages cyclic dependencies without crashing
- 🛠️ **TypeScript-first** - Full TypeScript support with generics
- 🪶 **Lightweight** - Zero dependencies, < 200 LOC
- ✅ **Node.js compatibility** - Works with Node.js LTS v20+ and v22+

## Installation

```bash
npm install @nerdalytics/beacon
```

## Usage

```typescript
import { state, derived, effect, batch, selector } from "@nerdalytics/beacon";

// Create reactive state
const count = state(0);
const doubled = derived(() => count() * 2);

// Read values
console.log(count()); // => 0
console.log(doubled()); // => 0

// Setup an effect that automatically runs when dependencies change
// effect() returns a cleanup function that removes all subscriptions when called
const unsubscribe = effect(() => {
  console.log(`Count is ${count()}, doubled is ${doubled()}`);
});
// => "Count is 0, doubled is 0" (effect runs immediately when created)

// Update values - effect automatically runs after each change
count.set(5);
// => "Count is 5, doubled is 10"

// Update with a function
count.update((n) => n + 1);
// => "Count is 6, doubled is 12"

// Batch updates (only triggers effects once at the end)
batch(() => {
  count.set(10);
  count.set(20);
});
// => "Count is 20, doubled is 40" (only once)

// Using selector to subscribe to specific parts of state
const user = state({ name: "Alice", age: 30, email: "alice@example.com" });
const nameSelector = selector(user, u => u.name);

effect(() => {
  console.log(`Name changed: ${nameSelector()}`);
});
// => "Name changed: Alice"

// Updates to the selected property will trigger the effect
user.update(u => ({ ...u, name: "Bob" }));
// => "Name changed: Bob"

// Updates to other properties won't trigger the effect
user.update(u => ({ ...u, age: 31 })); // No effect triggered

// Unsubscribe the effect to stop it from running on future updates
// and clean up all its internal subscriptions
unsubscribe();
```

## API

### `state<T>(initialValue: T): Signal<T>`

Creates a new reactive signal with the given initial value.

### `derived<T>(fn: () => T): Signal<T>`

Creates a derived signal that updates when its dependencies change.

### `effect(fn: () => void): () => void`

Creates an effect that runs the given function immediately and whenever its dependencies change. Returns an unsubscribe function that stops the effect and cleans up all subscriptions when called.

### `batch<T>(fn: () => T): T`

Batches multiple updates to only trigger effects once at the end.

### `selector<T, R>(source: Signal<T>, selectorFn: (state: T) => R, equalityFn?: (a: R, b: R) => boolean): Signal<R>`

Creates a selector that subscribes to a specific subset of a signal's state. The selector will only notify its subscribers when the selected value actually changes according to the provided equality function (defaults to `Object.is`).

## Usage
```typescript
import { state, derived, effect, batch, selector } from "@nerdalytics/beacon";

// Create reactive state
const count = state(0);
const doubled = derived(() => count() * 2);

// Read values
console.log(count()); // => 0
console.log(doubled()); // => 0

// Setup an effect that automatically runs when dependencies change
// effect() returns a cleanup function that removes all subscriptions when called
const unsubscribe = effect(() => {
  console.log(`Count is ${count()}, doubled is ${doubled()}`);
});
// => "Count is 0, doubled is 0" (effect runs immediately when created)

// Update values - effect automatically runs after each change
count.set(5);
// => "Count is 5, doubled is 10"

// Update with a function
count.update((n) => n + 1);
// => "Count is 6, doubled is 12"

// Batch updates (only triggers effects once at the end)
batch(() => {
  count.set(10);
  count.set(20);
});
// => "Count is 20, doubled is 40" (only once)

// Using selector to subscribe to specific parts of state
const user = state({ name: "Alice", age: 30, email: "alice@example.com" });
const nameSelector = selector(user, u => u.name);

effect(() => {
  console.log(`Name changed: ${nameSelector()}`);
});
// => "Name changed: Alice"

// Updates to other properties won't trigger the effect
user.update(u => ({ ...u, age: 31 })); // No effect triggered

// Updates to the selected property will trigger the effect
user.update(u => ({ ...u, name: "Bob" }));
// => "Name changed: Bob"

// Unsubscribe the effect to stop it from running on future updates
// and clean up all its internal subscriptions
unsubscribe();
```

## API
### state<T>(initialValue: T): Signal<T>
Creates a new reactive signal with the given initial value.

### derived<T>(fn: () => T): Signal<T>
Creates a derived signal that updates when its dependencies change.

### effect(fn: () => void): () => void
Creates an effect that runs the given function immediately and whenever its dependencies change. Returns an unsubscribe function that stops the effect and cleans up all subscriptions when called.

### batch<T>(fn: () => T): T
Batches multiple updates to only trigger effects once at the end.

### selector<T, R>(source: Signal<T>, selectorFn: (state: T) => R, equalityFn?: (a: R, b: R) => boolean): Signal<R>
Creates a selector that subscribes to a specific subset of a signal's state. The selector will only notify its subscribers when the selected value actually changes according to the provided equality function (defaults to Object.is ).

Parameters:

- source : The source signal to select from
- selectorFn : A function that extracts the desired value from the source state
- equalityFn : Optional custom equality function to determine if the selected value has changed

Returns a derived signal that holds the selected value.

## Development

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run all tests with coverage
npm run test:coverage

# Run specific test suites
# Core functionality
npm run test:unit:state
npm run test:unit:derived
npm run test:unit:effect
npm run test:unit:batch
npm run test:unit:selector 

# Advanced patterns
npm run test:unit:cleanup    # Tests for effect cleanup behavior
npm run test:unit:cyclic     # Tests for cyclic dependency handling

# Format code
npm run format

# Build for Node.js LTS compatibility (v20+)
npm run build:lts
```

### Node.js LTS Compatibility

Beacon supports the two most recent Node.js LTS versions (currently v20 and v22). When the package is published to npm, it includes transpiled code compatible with these LTS versions.

## Key Differences Between My Library and the [TC39 Proposal][1]

| Aspect | @nerdalytics/beacon | TC39 Proposal |
|--------|---------------------|---------------|
| **API Style** | Functional approach (`state()`, `derived()`) | Class-based design (`Signal.State`, `Signal.Computed`) |
| **Reading/Writing Pattern** | Function call for reading (`count()`), methods for writing (`count.set(5)`) | Method-based access (`get()`/`set()`) |
| **Framework Support** | High-level abstractions like `effect()` and `batch()` | Lower-level primitives (`Signal.subtle.Watcher`) that frameworks build upon |
| **Advanced Features** | Focused on core reactivity | Includes introspection capabilities, watched/unwatched callbacks, and Signal.subtle namespace |
| **Scope and Purpose** | Practical Node.js use cases with minimal API surface | Standardization with robust interoperability between frameworks |

## Implementation Details

Beacon is designed with a focus on simplicity, performance, and robust handling of complex dependency scenarios.

### Key Implementation Concepts

- **Fine-grained reactivity**: Dependencies are tracked automatically at the signal level
- **Efficient updates**: Changes only propagate to affected parts of the dependency graph
- **Cyclical dependency handling**: Robust handling of circular references without crashing
- **Memory management**: Automatic cleanup of subscriptions when effects are disposed

For an in-depth explanation of Beacon's internal architecture, advanced features, and best practices for handling complex scenarios like cyclical dependencies, see the [TECHNICAL_DETAILS.md][2] document.

## FAQ

<details>

<summary>Why "Beacon" Instead of "Signal"?</summary>
I chose "Beacon" because it clearly represents how the library broadcasts notifications when state changes—just like a lighthouse guides ships. While my library draws inspiration from Preact Signals, Angular Signals, and aspects of Svelte, I wanted to create something lighter and specifically designed for Node.js backends. Using "Beacon" instead of "Signal" helps avoid confusion with the TC39 proposal and similar libraries while still accurately describing the core functionality.

</details>

<details>

<summary>How does Beacon handle infinite update cycles?</summary>
Beacon uses a queue-based update system that won't crash even with cyclical dependencies. If signals form a cycle where values constantly change (A updates B updates A...), the system will continue processing these updates without stack overflows. However, this could potentially affect performance if updates never stabilize. See the <a href="./TECHNICAL_DETAILS.md">TECHNICAL_DETAILS.md</a> document for best practices on handling cyclical dependencies.

</details>

<details>

<summary>How performant is Beacon?</summary>
Beacon is designed with performance in mind for server-side Node.js environments. It achieves millions of operations per second for core operations like reading and writing signals.

</details>

## License

This project is licensed under the MIT License. See the [LICENSE][3] file for details.

<!-- Links collection -->

[1]: https://github.com/tc39/proposal-signals
[2]: ./TECHNICAL_DETAILS.md
[3]: ./LICENSE
