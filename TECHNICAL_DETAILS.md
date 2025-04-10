# Beacon Technical Details

This document describes the internal implementation details of the Beacon library. It's intended for developers who want to understand how Beacon works under the hood or need to troubleshoot advanced scenarios.

## Reactive System Architecture

Beacon uses a fine-grained reactivity system with automatic dependency tracking. Here's how the core architecture works:

1. **State Primitives**: Base reactive values that can be read and modified
2. **Derived Values**: Computed values that depend on other reactive states
3. **Effects**: Side effects that run when dependencies change
4. **Batching**: Optimization for multiple state changes
5. **Dependency Tracking**: Automatic tracking of dependencies
6. **Selectors**: Targeted subscriptions to subsets of state objects

### Core API Components

Beacon's API consists of the following key functions:

- **state**: Creates a reactive state container
- **derive**: Creates a computed value that updates when dependencies change
- **effect**: Registers side effects that run when dependencies change
- **batch**: Groups multiple updates to optimize performance
- **select**: Creates efficient subscriptions to subsets of state
- **readonlyState**: Creates a read-only view of a mutable state
- **protectedState**: Creates a state with separated read and write capabilities

### Dependency Tracking Mechanism

When an effect or derived state runs:

1. The global `currentSubscriber` variable is set to the current effect
2. Reading any state during execution registers the state as a dependency
3. A bidirectional relationship is established:
   - The state keeps track of its subscribers (effects that depend on it)
   - The effect keeps track of its dependencies (states it depends on)
4. When a state changes, it notifies all its subscribers

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
  const value = counter();
  counter.set(value + 1); // Error: Infinite loop detected!
});
```

### Direct vs. Indirect Cycles

It's important to understand the difference between:

1. **Direct infinite loops**: An effect reads and writes to the same state (blocked with error)
2. **Cyclic dependencies**: Multiple states form update cycles through different effects (allowed but managed)

```typescript
// DIRECT LOOP - BLOCKED WITH ERROR
effect(() => {
  const value = counter();
  counter.set(value + 1); // Error thrown
});

// INDIRECT CYCLE - ALLOWED WITH SAFE HANDLING
effect(() => {
  target.set(source() * 2); // Safe: reading source, updating target
});

effect(() => {
  source.set(target() / 2); // Safe: different effect
});
```

### Safe Patterns for Avoiding Infinite Loops

Beacon allows several patterns that appear cyclical but are actually safe:

1. **Separate states pattern**: Use separate source and target states
   ```typescript
   effect(() => {
     // Read from source, write to target
     target.set(source() * 2);
   });
   ```

2. **Derived values pattern**: Use derive() for computed values
   ```typescript
   const doubled = derive(() => source() * 2);
   ```

3. **Conditional update pattern**: Only update when specific conditions are met
   ```typescript
   effect(() => {
     const newValue = calculate();
     // Only update if significantly different
     if (Math.abs(newValue - state()) > 0.01) {
       state.set(newValue);
     }
   });
   ```

4. **Complete cycles with stabilization**: Cycles that eventually stabilize
   ```typescript
   // A → B → C → A cycle that stabilizes
   effect(() => { signalB.set(signalA() * 2) });
   effect(() => { signalC.set(signalB() + 5) });
   effect(() => {
     const newA = signalC() / 5;
     // Stabilization condition
     if (Math.abs(newA - signalA()) > 0.001) {
       signalA.set(newA);
     }
   });
   ```

### Technical Implementation

The infinite loop detection uses a combination of:

1. **Symbol-based state tracking**: Each state has a unique Symbol identifier
2. **Effect context tracking**: The current effect is tracked during execution
3. **Read operation logging**: Every state read is recorded with the state's Symbol
4. **Pre-update checks**: Before updating a state, Beacon checks if the effect has read from that state

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
const a = state(0);
const b = derive(() => a() + 1);
effect(() => { a.set(b()); }); // Creates a cycle
```

Use:
```typescript
// Cycle broken with intermediate value
const a = state(0);
const b = derive(() => a() + 1);
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

## ReadOnly and Protected State

Beacon provides two strategies for controlling access to state:

### ReadOnly State

The `readonlyState` function creates a read-only view of a mutable state:

```typescript
const counter = state(0);
const readonlyCounter = readonlyState(counter);

// readonlyCounter() works to read the state
// but readonlyCounter.set() is not available
```

This is useful when you want to expose a state to parts of your application that should only read but not modify it.

### Protected State

The `protectedState` function provides more fine-grained control by separating read and write capabilities:

```typescript
const [getUser, setUser] = protectedState({ name: 'Alice' });

// getUser() works to read the state
// setUser.set() and setUser.update() work to modify the state
```

This pattern allows you to keep write capabilities private while sharing read capabilities more widely in your application.

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

---

## License

This project is licensed under the MIT License. See the [LICENSE][1] file for details.

<div align="center">
  <img src="https://raw.githubusercontent.com/nerdalytics/nerdalytics/refs/heads/main/nerdalytics-logo-gray-transparent.svg" width="128px">
</div>

<!-- Links collection -->

[1]: ./LICENSE
