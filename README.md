# Beacon <img align="right" src="https://raw.githubusercontent.com/nerdalytics/beacon/refs/heads/trunk/assets/beacon-logo.svg" width="128px" alt="A stylized lighthouse beacon with golden light against a dark blue background, representing the reactive state library"/>

A lightweight reactive state library for Node.js backends. Enables reactive state management with automatic dependency tracking and efficient updates for server-side applications.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [API](#api)
  - [state](#statetinitialvalue-t-statet)
  - [derive](#derivetfn---t-readonlystatet)
  - [effect](#effectfn---void---void)
  - [batch](#batchtfn---t-t)
  - [select](#selectt-rsource-readonlystatet-selectorfn-state-t--r-equalityfn-a-r-b-r--boolean-readonlystater)
  - [lens](#lenst-ksource-statet-accessor-state-t--k-statek)
  - [readonlyState](#readonlystatetstate-statet-readonlystatet)
  - [protectedState](#protectedstatetinitialvalue-t-readonlystatet-writeablestatet)
- [Development](#development)
  - [Node.js LTS Compatibility](#nodejs-lts-compatibility)
- [Key Differences vs TC39 Proposal](#key-differences-between-my-library-and-the-tc39-proposal)
- [Implementation Details](#implementation-details)
- [FAQ](#faq)
- [License](#license)

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
- 🪶 **Lightweight** - Zero dependencies, < 200 LOC
- ✅ **Node.js compatibility** - Works with Node.js LTS v20+ and v22+

## Installation

```sh
npm install @nerdalytics/beacon
```

## Usage

```typescript
import {
  state,
  derive,
  effect,
  batch,
  select,
  lens,
  readonlyState,
  protectedState
} from "@nerdalytics/beacon";

// Create reactive state
const count = state(0);
const doubled = derive(() => count() * 2);

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

// Using select to subscribe to specific parts of state
const user = state({ name: "Alice", age: 30, email: "alice@example.com" });
const nameSelector = select(user, u => u.name);

effect(() => {
  console.log(`Name changed: ${nameSelector()}`);
});
// => "Name changed: Alice"

// Updates to the selected property will trigger the effect
user.update(u => ({ ...u, name: "Bob" }));
// => "Name changed: Bob"

// Updates to other properties won't trigger the effect
user.update(u => ({ ...u, age: 31 })); // No effect triggered

// Using lens for two-way binding with nested properties
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

// Unsubscribe the effect to stop it from running on future updates
// and clean up all its internal subscriptions
unsubscribe();

// Using readonlyState to create a read-only view
const counter = state(0);
const readonlyCounter = readonlyState(counter);
// readonlyCounter() works, but readonlyCounter.set() is not available

// Using protectedState to separate read and write capabilities
const [getUser, setUser] = protectedState({ name: 'Alice' });
// getUser() works to read the state
// setUser.set() and setUser.update() work to modify the state
// but getUser has no mutation methods

// Infinite loop detection example (would throw an error)
try {
  effect(() => {
    const value = counter();
    // The following would throw an error because it attempts to
    // update a state that the effect depends on:
    // "Infinite loop detected: effect() cannot update a state() it depends on!"
    // counter.set(value + 1);

    // Instead, use a safe pattern with proper dependencies:
    console.log(`Current counter value: ${value}`);
  });
} catch (error) {
  console.error('Prevented infinite loop:', error.message);
}
```

## API

### `state<T>(initialValue: T): State<T>`

Creates a new reactive state container with the provided initial value.

### `derive<T>(fn: () => T): ReadOnlyState<T>`

Creates a read-only computed value that updates when its dependencies change.

### `effect(fn: () => void): () => void`

Creates an effect that runs the given function immediately and whenever its dependencies change. Returns an unsubscribe function that stops the effect and cleans up all subscriptions when called.

### `batch<T>(fn: () => T): T`

Batches multiple updates to only trigger effects once at the end.

### `select<T, R>(source: ReadOnlyState<T>, selectorFn: (state: T) => R, equalityFn?: (a: R, b: R) => boolean): ReadOnlyState<R>`

Creates an efficient subscription to a subset of a state value. The selector will only notify its subscribers when the selected value actually changes according to the provided equality function (defaults to `Object.is`).

### `lens<T, K>(source: State<T>, accessor: (state: T) => K): State<K>`

Creates a lens for direct updates to nested properties of a state. A lens combines the functionality of `select` (for reading) with the ability to update the nested property while maintaining referential integrity throughout the object tree.

### `readonlyState<T>(state: State<T>): ReadOnlyState<T>`

Creates a read-only view of a state, hiding mutation methods. Useful when you want to expose a state to other parts of your application without allowing direct mutations.

### `protectedState<T>(initialValue: T): [ReadOnlyState<T>, WriteableState<T>]`

Creates a state with access control, returning a tuple of reader and writer. This pattern separates read and write capabilities, allowing you to expose only the reading capability to consuming code while keeping the writing capability private.

## Development

```sh
# Install dependencies
npm install

# Run all tests
npm test

# Run all tests with coverage
npm run test:coverage

# Run specific test suites
# Core functionality
npm run test:unit:state
npm run test:unit:effect
npm run test:unit:derive
npm run test:unit:batch
npm run test:unit:select
npm run test:unit:lens
npm run test:unit:readonly
npm run test:unit:protected

# Advanced patterns
npm run test:unit:cleanup              # Tests for effect cleanup behavior
npm run test:unit:cyclic-dependency    # Tests for cyclic dependency handling
npm run test:unit:deep-chain           # Tests for deep chain handling
npm run test:unit:infinite-loop        # Tests for infinite loop detection

# Benchmarking
npm run benchmark    # Tests for infinite loop detection

# Format code
npm run format
npm run lint
npm run check    # Runs Bioms lint + format
```

### Node.js LTS Compatibility

Beacon supports the two most recent Node.js LTS versions (currently v20 and v22). When the package is published to npm, it includes transpiled code compatible with these LTS versions.

## Key Differences Between My Library and the [TC39 Proposal][1]

| Aspect | @nerdalytics/beacon | TC39 Proposal |
|--------|---------------------|---------------|
| **API Style** | Functional approach (`state()`, `derive()`) | Class-based design (`Signal.State`, `Signal.Computed`) |
| **Reading/Writing Pattern** | Function call for reading (`count()`), methods for writing (`count.set(5)`) | Method-based access (`get()`/`set()`) |
| **Framework Support** | High-level abstractions like `effect()` and `batch()` | Lower-level primitives (`Signal.subtle.Watcher`) that frameworks build upon |
| **Advanced Features** | Focused on core reactivity | Includes introspection capabilities, watched/unwatched callbacks, and Signal.subtle namespace |
| **Scope and Purpose** | Practical Node.js use cases with minimal API surface | Standardization with robust interoperability between frameworks |

## Implementation Details

Beacon is designed with a focus on simplicity, performance, and robust handling of complex dependency scenarios.

### Key Implementation Concepts

- **Fine-grained reactivity**: Dependencies are tracked automatically at the state level
- **Efficient updates**: Changes only propagate to affected parts of the dependency graph
- **Cyclical dependency handling**: Robust handling of circular references without crashing
- **Infinite loop detection**: Safeguards against direct self-mutation within effects
- **Memory management**: Automatic cleanup of subscriptions when effects are disposed
- **Optimized batching**: Smart scheduling of updates to minimize redundant computations

## FAQ

<details>

<summary>Why "Beacon" Instead of "Signal"?</summary>
I chose "Beacon" because it clearly represents how the library broadcasts notifications when state changes—just like a lighthouse guides ships. While my library draws inspiration from Preact Signals, Angular Signals, and aspects of Svelte, I wanted to create something lighter and specifically designed for Node.js backends. Using "Beacon" instead of the term "Signal" helps avoid confusion with the TC39 proposal and similar libraries while still accurately describing the core functionality.

</details>

<details>

<summary>How does Beacon handle infinite update cycles?</summary>
Beacon employs two complementary strategies for handling cyclical updates:

1. **Infinite Loop Detection**: Beacon actively detects direct infinite loops in effects by tracking which states an effect reads and writes to. If an effect attempts to update a state it depends on (directly modifying its own dependency), Beacon throws an error with a clear message: "Infinite loop detected: effect() cannot update a state() it depends on!"

2. **Safe Cyclic Dependencies**: For indirect cycles and safe update patterns, Beacon uses a queue-based update system that won't crash even with cyclical dependencies. When states form a cycle where values eventually stabilize, the system handles these updates efficiently without stack overflows.

This dual approach prevents accidental infinite loops while still supporting legitimate cyclic update patterns that eventually stabilize.

</details>

<details>

<summary>How performant is Beacon?</summary>
Beacon is designed with performance in mind for server-side Node.js environments. It achieves millions of operations per second for core operations like reading and writing states.

</details>

## License

This project is licensed under the MIT License. See the [LICENSE][2] file for details.

<div align="center">
  <img src="https://raw.githubusercontent.com/nerdalytics/nerdalytics/refs/heads/main/nerdalytics-logo-gray-transparent.svg" width="128px">
</div>

<!-- Links collection -->

[1]: https://github.com/tc39/proposal-signals
[2]: ./LICENSE
