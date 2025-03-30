# Beacon Technical Details

This document describes the internal implementation details of the Beacon library. It's intended for developers who want to understand how Beacon works under the hood or need to troubleshoot advanced scenarios.

## Reactive System Architecture

Beacon uses a fine-grained reactivity system with automatic dependency tracking. Here's how the core architecture works:

1. **State Primitives**: Base reactive values that can be read and modified
2. **Derived Values**: Computed values that depend on other reactive values
3. **Effects**: Side effects that run when dependencies change
4. **Batching**: Optimization for multiple state changes
5. **Dependency Tracking**: Automatic tracking of dependencies

### Dependency Tracking Mechanism

When an effect or derived signal runs:

1. The global `currentEffect` variable is set to the current effect
2. Reading any signal during execution registers the signal as a dependency
3. A bidirectional relationship is established:
   - The signal keeps track of its subscribers (effects that depend on it)
   - The effect keeps track of its dependencies (signals it depends on)
4. When a signal changes, it notifies all its subscribers

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

When a signal's value changes, the following happens:

1. The signal checks if the new value is different (using `Object.is`)
2. If different, it adds all its subscribers to a global `pendingEffects` set
3. If not in a batch operation, the `processEffects` function runs
4. `processEffects` processes all pending effects in the queue
5. If any effect triggers further updates, those are added to the queue
6. Processing continues until no more effects are triggered

This approach ensures that even with cyclical dependencies, the updates will process correctly without causing infinite recursion or stack overflows.

## Best Practices for Avoiding Problematic Cycles

While Beacon handles cycles gracefully in terms of not crashing, applications with unbounded update cycles may experience performance issues as updates continue to propagate. Here are some best practices:

- **Careful dependency design**: Design your signal relationships to avoid unintentional cycles
- **Break circular dependencies**: Use intermediate values that don't depend on both sides of a cycle
- **Limit recursive updates**: Include logic that stabilizes values (e.g., rounding or limiting values)
- **Use batching**: The `batch()` function helps limit cascade effects from rapidly changing values
- **Equality checks**: For complex objects, implement deep equality in update functions to prevent unnecessary cycles

### Example: Breaking a Cycle with Intermediate Value

Instead of:
```typescript
// Problematic cycle
const a = state(0);
const b = derived(() => a() + 1);
effect(() => { a.set(b()); }); // Creates a cycle
```

Use:
```typescript
// Cycle broken with intermediate value
const a = state(0);
const b = derived(() => a() + 1);
// Store the desired update in an intermediate value
effect(() => {
  const newValue = b();
  // Only update if significantly different, breaking the cycle
  if (Math.abs(newValue - a()) > 0.01) {
    a.set(newValue);
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

## Memory Management and Cleanup

Beacon automatically manages subscriptions and cleans up when effects are disposed:

1. When an effect runs, it first cleans up its old dependencies
2. It then tracks new dependencies during execution
3. When an effect is disposed (via the unsubscribe function), all its dependencies are cleaned up

This system ensures there are no memory leaks from lingering effect subscriptions.

## Performance Optimizations

Several optimizations make Beacon efficient:

1. Set-based dependency tracking for fast operations
2. Value equality checks to prevent unnecessary updates
3. Specialized handling for small subscriber sets
4. Efficient batching to minimize effect executions
5. WeakMap for subscriber dependencies to allow garbage collection

<!-- Links collection -->
