# Beacon Technical Details

This document describes the internal implementation details of the Beacon library. It's intended for developers who want to understand how Beacon works under the hood or need to troubleshoot advanced scenarios.

## Migration from v1000.x to v2000.0.0

Version 2000.0.0 represents a major architectural shift from function-based to Proxy-based reactive state:

### Key Changes

1. **Natural JavaScript Syntax**: Instead of `state()` function calls, use direct property access
2. **Proxy-based Reactivity**: All state objects are wrapped in Proxies for automatic tracking
3. **Per-property Tracking**: Dependencies are tracked at the property level, not object level
4. **Always-eager Computed Values**: Removed lazy evaluation complexity for simpler mental model
5. **Removed APIs**: `select`, `lens`, `readonlyState`, `protectedState` are no longer available

### API Comparison

| v1000.x | v2000.0.0 |
|---------|-----------|
| `const count = state(0)` | `const signal = state({ count: 0 })` |
| `count()` | `signal.count` |
| `count.set(5)` | `signal.count = 5` |
| `derive(() => count() * 2)` | `derive(() => signal.count * 2)` |
| Returns function | Returns `{ value: T }` |

## Reactive System Architecture

Beacon uses a Proxy-based fine-grained reactivity system with automatic dependency tracking. Here's how the core architecture works:

1. **State Primitives**: Proxy-wrapped reactive objects with natural JavaScript syntax
2. **Derived Values**: Computed values that eagerly update when dependencies change
3. **Effects**: Side effects that run when dependencies change
4. **Batching**: Optimization for multiple state changes
5. **Per-Property Tracking**: Fine-grained dependency tracking at the property level

### Core API Components

Beacon's API consists of the following key functions:

- **state**: Creates a reactive Proxy object that tracks property access and mutations
- **derive**: Creates an eagerly-computed value that updates when dependencies change
- **effect**: Registers side effects that run when dependencies change
- **batch**: Groups multiple updates to optimize performance

### Dependency Tracking Mechanism

When an effect or derived state runs:

1. The global `currentEffect` variable is set to the current effect
2. Proxy get/has/ownKeys traps track property access at a granular level
3. A three-level tracking system is established:
   - Per-property reads: `WeakMap<Subscriber, WeakMap<object, Set<PropertyKey>>>()`
   - Dependency objects: `WeakMap<Subscriber, Set<object>>()`  
   - Subscriber sets: Stored on objects via Symbol or in WeakMap fallback
4. When a property changes, only effects that read that specific property are notified

### Computed Values (derive)

The `derive()` function creates eagerly-evaluated computed values:

```typescript
export function derive<T>(computeFn: () => T): ComputedValue<T>
```

Key implementation details:

1. **Eager Evaluation**: Computes immediately when dependencies change
2. **Circular Dependency Detection**: Throws error if computation creates a cycle
3. **Value Caching**: Stores the computed value to avoid recalculation
4. **Proxy Wrapper**: Returns a Proxy with a `value` getter for consistency
5. **Effect-based Updates**: Uses an internal effect to track dependencies
6. **Batch Optimization**: When multiple dependencies change within a batch, derive only recomputes once

The computed value acts as both a subscriber (to its dependencies) and a publisher (to effects that read it).

#### Batch Optimization for Derive

One of the most significant performance optimizations is how derive functions interact with batching:

```typescript
// Without batch: derive recomputes for each dependency change
a.value = 10;  // derive recomputes
b.value = 20;  // derive recomputes again
c.value = 30;  // derive recomputes again
// Total: 3 recomputations

// With batch: derive recomputes only once
batch(() => {
  a.value = 10;
  b.value = 20;
  c.value = 30;
});
// Total: 1 recomputation
```

This optimization is particularly valuable for complex computations like filtering and sorting large datasets. A derive function that depends on multiple filter criteria will only recompute once when all criteria are updated together in a batch, reducing recomputations from N to 1.

Note: This optimization applies when updating multiple independent sources. For a single source mutation feeding into a derive chain, consistency is guaranteed without batch — effects run in Set insertion order, which matches creation order, which necessarily matches dependency order (you can't reference a derive before it exists).

## Cyclical Dependencies

Beacon uses a queue-based update propagation mechanism that handles cyclical dependencies without crashing. Here's what you should know:

### How Beacon Handles Cycles

- **Non-recursive propagation**: Updates are processed in a queue, preventing stack overflows even with cycles
- **Value equality checks**: Updates only trigger when values actually change, which helps break potential loops
- **Queue-based processing**: All pending effects are collected first, then processed in batches

This approach has several benefits:
- Prevents stack overflows that would occur with recursive propagation
- Naturally handles cycles that eventually stabilize
- Ensures consistent propagation of changes through the dependency graph

### Behavior with Different Types of Cycles

1. **Simple cycles with stable values**: If values converge (reach a stable point), the system will naturally stop updating
2. **Mathematical feedback loops**: Systems where values grow or shrink with each cycle will exhibit different behaviors:
   - Values converging to zero will eventually stop due to floating-point precision
   - Values growing unbounded will continue until reaching JavaScript limits (e.g., Infinity)
   - Systems with a stable point (like a factor of 1.0) will stop updating quickly

### Detailed Process Flow

When a state's value changes, the following happens:

1. The state checks if the new value is different (using `Object.is`)
2. If different, it adds all its subscribers to a global `pendingSubscribers` set
3. If not in a batch operation, the `notifySubscribers` function runs
4. `notifySubscribers` processes all pending effects in the queue
5. If any effect triggers further updates, those are added to the queue
6. Processing continues until no more effects are triggered

This approach ensures that even with cyclical dependencies, the updates will process correctly without causing infinite recursion or stack overflows.

## Infinite Loop Detection

Beacon implements robust infinite loop detection to prevent runaway updates that would otherwise crash applications. This mechanism specifically targets direct self-mutation patterns, where an effect reads from a state and then immediately updates that same state.

### How Infinite Loop Detection Works

When an effect runs, Beacon tracks which states it reads from using the `stateTracking` system. Before a state update completes, Beacon checks if:

1. The update is happening inside an effect
2. The effect has read from the same state it's now trying to update
3. The effect is not part of a nested effect chain (which would be a legitimate use case)

If these conditions are met, Beacon throws an error: "Infinite loop detected: effect() cannot update a state() it depends on!"

```typescript
// This pattern will throw an error
effect(() => {
  const value = signal.count;
  signal.count = value + 1; // Error: Infinite loop detected!
});
```

### Direct vs. Indirect Cycles

It's important to understand the difference between:

1. **Direct infinite loops**: An effect reads and writes to the same state (blocked with error)
2. **Cyclic dependencies**: Multiple states form update cycles through different effects (allowed but managed)

```typescript
// DIRECT LOOP - BLOCKED WITH ERROR
effect(() => {
  const value = signal.count;
  signal.count = value + 1; // Error thrown
});

// INDIRECT CYCLE - ALLOWED WITH SAFE HANDLING
effect(() => {
  target.value = source.value * 2; // Safe: reading source, updating target
});

effect(() => {
  source.value = target.value / 2; // Safe: different effect
});
```

### Safe Patterns for Avoiding Infinite Loops

Beacon allows several patterns that appear cyclical but are actually safe:

1. **Separate states pattern**: Use separate source and target states
   ```typescript
   effect(() => {
     // Read from source, write to target
     target.value = source.value * 2;
   });
   ```

2. **Derived values pattern**: Use derive() for computed values
   ```typescript
   const doubled = derive(() => source.value * 2);
   ```

3. **Conditional update pattern**: Only update when specific conditions are met
   ```typescript
   effect(() => {
     const newValue = calculate();
     // Only update if significantly different
     if (Math.abs(newValue - state.value) > 0.01) {
       state.value = newValue;
     }
   });
   ```

4. **Complete cycles with stabilization**: Cycles that eventually stabilize
   ```typescript
   // A → B → C → A cycle that stabilizes
   effect(() => { signalB.value = signalA.value * 2 });
   effect(() => { signalC.value = signalB.value + 5 });
   effect(() => {
     const newA = signalC.value / 5;
     // Stabilization condition
     if (Math.abs(newA - signalA.value) > 0.001) {
       signalA.value = newA;
     }
   });
   ```

### Technical Implementation

The infinite loop detection uses a combination of:

1. **Per-property tracking**: Each property read is tracked separately using `WeakMap<object, Set<PropertyKey>>()`
2. **Effect context tracking**: The current effect is tracked during execution
3. **Proxy trap logging**: Get, has, and ownKeys operations are recorded per property
4. **Pre-update checks**: Before updating a property, Beacon checks if the current effect has read that specific property

This approach catches infinite loops early, before they cause application crashes, while still allowing legitimate cyclic update patterns that eventually stabilize.

## Best Practices for Avoiding Problematic Cycles

While Beacon handles cycles gracefully in terms of not crashing, applications with unbounded update cycles may experience performance issues as updates continue to propagate. Here are some best practices:

- **Careful dependency design**: Design your state relationships to avoid unintentional cycles
- **Break circular dependencies**: Use intermediate values that don't depend on both sides of a cycle
- **Limit recursive updates**: Include logic that stabilizes values (e.g., rounding or limiting values)
- **Use batching**: The `batch()` function helps limit cascade effects from rapidly changing values
- **Equality checks**: For complex objects, implement deep equality in update functions to prevent unnecessary cycles

### Example: Breaking a Cycle with Intermediate Value

Instead of:
```typescript
// Problematic cycle
const signal = state({ value: 0 });
const b = derive(() => signal.value + 1);
effect(() => { signal.value = b.value; }); // Creates a cycle
```

Use:
```typescript
// Cycle broken with intermediate value
const signal = state({ value: 0 });
const b = derive(() => signal.value + 1);
// Store the desired update in an intermediate value
effect(() => {
  const newValue = b.value;
  // Only update if significantly different, breaking the cycle
  if (Math.abs(newValue - signal.value) > 0.01) {
    signal.value = newValue;
  }
});
```

## Batching Implementation

The batching system uses a depth counter to track nested batch operations:

1. When entering a batch, the `batchDepth` counter is incremented
2. Effects still register for updates, but they aren't processed immediately
3. When the outermost batch completes, effects are processed all at once
4. This ensures effects run only once, even if multiple values they depend on change

Batching provides significant performance benefits, especially with multiple interdependent values.

## Proxy Implementation Details

### How the Proxy System Works

Beacon v2000.0.0 uses JavaScript Proxies to provide natural syntax for reactive state:

1. **Proxy Creation**: `state()` wraps objects in Proxies that intercept all operations
2. **Property Access**: Get traps track which properties each effect reads
3. **Property Mutation**: Set traps trigger notifications to dependent effects
4. **Array Methods**: Special handling for mutating array methods (push, pop, etc.)
5. **Nested Objects**: Automatically wrapped in Proxies for deep reactivity

### Handling Edge Cases

**Frozen/Sealed Objects**: Uses WeakMap fallbacks for metadata storage when objects are not extensible:
```typescript
const frozen = Object.freeze({ value: 42 });
const reactive = state(frozen); // Still works via WeakMap storage
```

**Symbol Properties**: Special handling to avoid interference with internal symbols:
```typescript
const SUBSCRIBERS = Symbol('[[beacon_subscribers]]');
const PROXY = Symbol('[[beacon_proxy]]');
```

**Spread Operations**: Efficient handling without triggering stack overflows:
```typescript
const signal = state({ a: 1, b: 2 });
const copy = { ...signal }; // Works correctly
```

## Memory Management and Cleanup

Beacon automatically manages subscriptions and cleans up when effects are disposed:

1. **Dependency cleanup**: `cleanupEffect()` removes an effect from all its dependencies
2. **Child effect cleanup**: `cleanupEffectCompletely()` recursively cleans up nested effects
3. **Parent-child tracking**: Maintains relationships between effects for proper cleanup
4. **Automatic disposal**: Nested effects are cleaned up when parent effects re-run
5. **WeakMap usage**: Enables automatic garbage collection of unreferenced objects

This system ensures there are no memory leaks from lingering effect subscriptions.

## Performance Optimizations

Several optimizations make Beacon efficient:

1. **Per-property tracking**: Only notifies effects that read changed properties
2. **Proxy caching**: Reuses the same Proxy instance for each object
3. **Value equality checks**: Uses `Object.is()` to prevent unnecessary updates
4. **Efficient batching**: Queues all updates and processes them together
5. **WeakMap storage**: Allows garbage collection of unused effects and states
6. **Non-enumerable metadata**: Uses Symbols to avoid property iteration overhead

---

## License

This project is licensed under the MIT License. See the [LICENSE][1] file for details.

<div align="center">
  <img src="https://raw.githubusercontent.com/nerdalytics/nerdalytics/refs/heads/main/nerdalytics-logo-gray-transparent.svg" width="128px">
</div>

<!-- Links collection -->

[1]: ./LICENSE
