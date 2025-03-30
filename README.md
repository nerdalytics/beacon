# Beacon

A lightweight reactive signal library for Node.js backends. Enables reactive state management with automatic dependency tracking and efficient updates for server-side applications.

## Features

- 🔄 **Reactive signals** - Create reactive values that automatically track dependencies
- 🧮 **Computed values** - Derive values from other signals with automatic updates
- 🔍 **Fine-grained reactivity** - Dependencies are tracked precisely at the signal level
- 🏎️ **Efficient updates** - Only recompute values when dependencies change
- 📦 **Batched updates** - Group multiple updates for performance
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
import { state, effect } from "@nerdalytics/beacon";

// Create reactive state
const count = state(0);

// Read values
console.log(count()); // => 0

// Setup an effect that automatically runs when dependencies change
// effect() returns a cleanup function that removes all subscriptions when called
const unsubscribe = effect(() => {
  console.log(`Count is ${count()}`);
});
// => "Count is 0, doubled is 0" (effect runs immediately when created)

// Update values - effect automatically runs after each change
count.set(5);
// => "Count is 5

// Update with a function
count.update((n) => n + 1);
// => "Count is 6

// Unsubscribe the effect to stop it from running on future updates
// and clean up all its internal subscriptions
unsubscribe();
```

## API

### `state<T>(initialValue: T): Signal<T>`

Creates a new reactive signal with the given initial value.

### `effect(fn: () => void): () => void`

Creates an effect that runs the given function immediately and whenever its dependencies change. Returns an unsubscribe function that stops the effect and cleans up all subscriptions when called.

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
npm run test:unit:effect

# Format code
npm run format

## FAQ

<details>

<summary>Why "Beacon" Instead of "Signal"?</summary>
I chose "Beacon" because it clearly represents how the library broadcasts notifications when state changes—just like a lighthouse guides ships. While my library draws inspiration from Preact Signals, Angular Signals, and aspects of Svelte, I wanted to create something lighter and specifically designed for Node.js backends. Using "Beacon" instead of "Signal" helps avoid confusion with the TC39 proposal and similar libraries while still accurately describing the core functionality.

</details>

## License

This project is licensed under the MIT License. See the [LICENSE][3] file for details.

<!-- Links collection -->
