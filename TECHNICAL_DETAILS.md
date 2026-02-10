# Beacon Technical Details

## Migration from v1000.x to v2000.0.0

Version 2000.0.0 shifts from function-based to Proxy-based reactive state.

### Key Changes

1. **Natural JavaScript Syntax**: Direct property access instead of `state()` function calls
2. **Proxy-based Reactivity**: All state objects wrapped in Proxies for automatic tracking
3. **Per-property Tracking**: Dependencies tracked at the property level, not object level
4. **Always-eager Computed Values**: No lazy evaluation; simpler mental model
5. **Removed APIs**: `select`, `lens`, `readonlyState`, `protectedState` are gone

### API Comparison

| v1000.x | v2000.0.0 |
|---------|-----------|
| `const count = state(0)` | `const signal = state({ count: 0 })` |
| `count()` | `signal.count` |
| `count.set(5)` | `signal.count = 5` |
| `derive(() => count() * 2)` | `derive(() => signal.count * 2)` |
| Returns function | Returns `{ value: T }` |

## Dependency Tracking

When an effect or derived value runs:

1. The global `currentEffect` variable is set to the running effect
2. Proxy get/has/ownKeys traps track property access at a granular level
3. A three-level tracking system records dependencies:
   - Per-property reads: `WeakMap<Subscriber, WeakMap<object, Set<PropertyKey>>>()`
   - Dependency objects: `WeakMap<Subscriber, Set<object>>()`
   - Subscriber sets: stored on objects via Symbol or in WeakMap fallback
4. When a property changes, only effects that read that specific property run

## Computed Values (derive)

```typescript
export function derive<T>(computeFn: () => T): ComputedValue<T>
```

Implementation details:

1. **Eager Evaluation**: Computes immediately when dependencies change
2. **Circular Dependency Detection**: Throws if computation creates a cycle
3. **Value Caching**: Stores the computed value to avoid recalculation
4. **Proxy Wrapper**: Returns a Proxy with a `value` getter
5. **Effect-based Updates**: Uses an internal effect to track dependencies
6. **Batch Optimization**: Recomputes once per batch, not once per dependency change

A computed value acts as both subscriber (to its dependencies) and publisher (to effects that read it).

### Batch Interaction

Derive functions recompute once per batch instead of once per dependency change:

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

A derive that depends on multiple filter criteria recomputes once when all criteria change together in a batch, reducing N recomputations to 1.

Note: This optimization applies when updating multiple independent sources. For a single source mutation feeding into a derive chain, consistency is guaranteed without batch — effects run in Set insertion order, which matches creation order, which necessarily matches dependency order (you can't reference a derive before it exists).

## Cyclical Dependencies

Beacon uses queue-based update propagation to handle cyclical dependencies:

- **Non-recursive propagation**: Updates are processed in a queue, preventing stack overflows
- **Value equality checks**: Updates only trigger when values actually change, breaking potential loops

### Process Flow

When a state property changes:

1. The state checks if the new value differs (using `Object.is`)
2. If different, it adds all subscribers to a global `pendingSubscribers` set
3. If not in a batch, `notifySubscribers` processes all pending effects
4. If any effect triggers further updates, those are added to the queue
5. Processing continues until no more effects fire

### Behavior with Different Cycle Types

1. **Converging values**: The system stops when values stabilize
2. **Mathematical feedback loops**:
   - Values converging to zero stop at floating-point precision limits
   - Values growing unbounded continue until reaching JavaScript limits (e.g., Infinity)
   - Systems with a stable point (like a factor of 1.0) stop quickly

## Infinite Loop Detection

Beacon detects direct self-mutation — where an effect reads from a state and then writes to that same state.

When an effect runs, Beacon tracks which states it reads via the `stateTracking` system. Before a state update completes, Beacon checks:

1. The update is happening inside an effect
2. The effect read from the same state it now writes to
3. The effect is not part of a nested effect chain (a legitimate use case)

If all three hold, Beacon throws: "Infinite loop detected: effect() cannot update a state() it depends on!"

```typescript
// This throws
effect(() => {
  const value = signal.count;
  signal.count = value + 1; // Error: Infinite loop detected!
});
```

### Direct vs. Indirect Cycles

Direct infinite loops (an effect reads and writes the same state) throw an error. Cyclic dependencies across different effects are allowed:

```typescript
// DIRECT LOOP — BLOCKED
effect(() => {
  const value = signal.count;
  signal.count = value + 1; // Error thrown
});

// INDIRECT CYCLE — ALLOWED
effect(() => {
  target.value = source.value * 2; // reads source, updates target
});

effect(() => {
  source.value = target.value / 2; // different effect
});
```

### Safe Patterns

1. **Separate states**: Read from one state, write to another
   ```typescript
   effect(() => {
     target.value = source.value * 2;
   });
   ```

2. **Derived values**: Use `derive()` for computed values
   ```typescript
   const doubled = derive(() => source.value * 2);
   ```

3. **Conditional updates**: Only write when the value changes significantly
   ```typescript
   effect(() => {
     const newValue = calculate();
     if (Math.abs(newValue - state.value) > 0.01) {
       state.value = newValue;
     }
   });
   ```

4. **Stabilizing cycles**: Multi-effect cycles that converge
   ```typescript
   effect(() => { signalB.value = signalA.value * 2 });
   effect(() => { signalC.value = signalB.value + 5 });
   effect(() => {
     const newA = signalC.value / 5;
     if (Math.abs(newA - signalA.value) > 0.001) {
       signalA.value = newA;
     }
   });
   ```

### Breaking a Derive-State Cycle

Instead of:
```typescript
const signal = state({ value: 0 });
const b = derive(() => signal.value + 1);
effect(() => { signal.value = b.value; }); // Creates a cycle
```

Add a stabilization condition:
```typescript
const signal = state({ value: 0 });
const b = derive(() => signal.value + 1);
effect(() => {
  const newValue = b.value;
  // Only update if significantly different, breaking the cycle
  if (Math.abs(newValue - signal.value) > 0.01) {
    signal.value = newValue;
  }
});
```

## Batching Implementation

The batching system uses a depth counter and deferred scheduling:

1. Entering a batch increments the `batchDepth` counter
2. The set handler takes a fast path when `!onWrite && !currentEffect`: skips subscriber scheduling, only tracks dirty target-property pairs in `dirtyTargets`
3. State objects with write hooks use the normal path (hooks fire per-mutation)
4. At `batchDepth === 1` (before decrement): dirty targets are processed, calling `scheduleSubscribersForTarget` once per unique property
5. When the outermost batch completes (`batchDepth` reaches 0): deferred effects run, then all pending effects flush
6. Effects run once, even if multiple values they depend on changed

## Proxy Edge Cases

**Array Methods**: Mutating methods (`push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`) are intercepted to trigger reactivity.

**Frozen/Sealed Objects**: WeakMap fallbacks store metadata when objects are not extensible:
```typescript
const frozen = Object.freeze({ value: 42 });
const reactive = state(frozen); // Works via WeakMap storage
```

**Symbol Properties**: Special handling avoids interference with internal symbols:
```typescript
const SUBSCRIBERS = Symbol('[[beacon_subscribers]]');
const PROXY = Symbol('[[beacon_proxy]]');
```

**Spread Operations**: Handled without triggering stack overflows:
```typescript
const signal = state({ a: 1, b: 2 });
const copy = { ...signal }; // Works correctly
```

## Memory Management

Beacon manages subscriptions automatically:

1. **Dependency cleanup**: `cleanupEffect()` removes an effect from all its subscribers and clears `__prevDeps`/`__prevReads`
2. **Child effect cleanup**: `cleanupEffectCompletely()` recursively cleans up nested effects
3. **Parent-child tracking**: Maintains relationships between effects for proper cleanup
4. **Automatic disposal**: Nested effects are cleaned up when parent effects re-run
5. **WeakMap usage**: Enables garbage collection of unreferenced objects
6. **Stable dependency skip**: On re-runs, `depsMatch` compares new deps against previous. If stable, previous tracking structures are restored (no subscriber set work). If changed, only stale deps are removed.

## Performance Optimizations

1. **Per-property tracking**: Only notifies effects that read changed properties
2. **Proxy caching**: Reuses the same Proxy instance for each object
3. **Value equality checks**: Uses `Object.is()` to prevent unnecessary updates
4. **Batch fast path**: During batch, set handler defers subscriber scheduling to `dirtyTargets` map, processing once per unique property at batch end
5. **Stable dependency skip**: Effect re-runs compare deps via `depsMatch` and skip subscriber teardown/rebuild when unchanged
6. **Deferred registration**: On subsequent runs with stable deps, `trackingOnly` mode skips `getSubscribers` + `Set.add` in proxy handlers
7. **WeakMap storage**: Allows garbage collection of unused effects and states
8. **Non-enumerable metadata**: Uses Symbols to avoid property iteration overhead

---

## License

This project is licensed under the MIT License. See the [LICENSE][1] file for details.

<div align="center">
  <img src="https://raw.githubusercontent.com/nerdalytics/nerdalytics/refs/heads/main/nerdalytics-logo-gray-transparent.svg" width="128px">
</div>

<!-- Links collection -->

[1]: ./LICENSE
