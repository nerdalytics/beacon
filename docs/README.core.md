# Beacon Architecture

## Overview

Beacon is a Proxy-based reactive state management library that provides natural JavaScript syntax while maintaining fine-grained reactivity. The architecture prioritizes developer experience while achieving acceptable performance through aggressive optimizations.

## Core Design Principles

1. **Natural JavaScript Syntax**: Use standard property access (`state.value`) instead of function calls
2. **Fine-grained Reactivity**: Track dependencies at the property level, not object level
3. **Automatic Cleanup**: Prevent memory leaks through proper subscription management
4. **Performance Optimization**: Minimize overhead in hot paths through direct property manipulation
5. **Optional Instrumentation**: All four primitives accept optional hooks for observing internal operations without affecting behavior

## System Architecture

### 1. Proxy-based State Management

```
   User Code
  state.count++
        |
        ↓
      Proxy   (Intercepts all operations)
        |
     - get           → Track dependencies
     - set           → Notify subscribers
     - has           → Track 'in' operator
     - deleteProperty → Delete with notification
     - ownKeys       → Track key enumeration
        |
        ↓
   Raw Target   (Actual data storage)
```

### 2. Dependency Tracking System

The system uses a three-level tracking mechanism:

```typescript
// Level 1: Per-property reads
effectStateReads: WeakMap<Subscriber, WeakMap<object, Set<PropertyKey>>>

// Level 2: Object dependencies
effectDependencies: WeakMap<Subscriber, Set<object>>

// Level 3: Subscriber sets
subscriberCache: WeakMap<object, Set<Subscriber>>
```

This allows precise tracking of which effect reads which property of which object.

### 3. Effect System

Effects are functions that re-run when their dependencies change:

```
Effect Creation → Cleanup Old Deps → Track New Deps → Run Function → Queue Re-runs
      ↑                                                                        |
      ╰--------------------------- Dependency Change ←-------------------------╯
```

### 4. Batch Optimization

Both paths use optimized direct access, but differ in notification timing:

```
Normal (Unbatched) Path:
  set trap → direct access → Object.is → direct set → notifySubscribers → flushEffects

Batched Path:
  set trap → direct access → Object.is → direct set → mark dirty → [end of batch] → notifySubscribers once → flushEffects
```

The key difference: unbatched operations notify immediately (one flush per mutation), batched operations defer notifications (one flush after all mutations). A single unbatched mutation still propagates consistently through derive chains because `flushEffects` processes effects in Set insertion order, which matches creation and dependency order.

## Key Components

### State Creation (`state()`)

1. Receives an object to make reactive
2. Checks proxy cache to avoid duplicates
3. Creates proxy with handler traps
4. Stores proxy-target relationship
5. Returns proxy to user

### Dependency Tracking

When code reads a reactive property:
1. Proxy `get` trap fires
2. Checks if there's a `currentEffect`
3. Records the effect as a subscriber to the object
4. Records the specific property that was read
5. Returns the value (potentially wrapping nested objects)

### Change Notification

When code writes to a reactive property:
1. Proxy `set` trap fires
2. Checks for infinite loops (effect updating its dependency)
3. Compares old and new values
4. Updates the raw target directly (optimization)
5. Notifies all subscribers or marks as dirty (if batched)

### Effect Execution

Effects run in a controlled environment:
1. Sets global `currentEffect`
2. Cleans up previous dependencies
3. Runs the effect function (dependencies auto-tracked)
4. Handles nested effects via parent-child relationships
5. Queues for re-execution on dependency changes

## Performance Optimizations

### 1. Direct Property Access

Instead of expensive `Reflect.get/set` (100x slower), we use direct property access for both batched and unbatched operations:
```javascript
// Slow
Reflect.get(target, prop, receiver)
Reflect.set(target, prop, value, receiver)

// Fast
target[prop]  // read
target[prop] = value  // write
```

### 2. Pending Effects Queue

During batch operations:
- Skip `flushEffects` while `batchDepth > 0`
- State mutations still add affected effects to `pendingEffects`
- Effects created during batch go into `deferredEffectCreations`
- When outermost batch ends (`batchDepth` returns to 0): run deferred effect creations, then `flushEffects()`
- Reduces many notification cycles to one

### 3. Array-Based Flush in flushEffects

Instead of iterating `pendingEffects` directly (which could cause issues with mutation during iteration):
- Copy effects to an array
- Clear `pendingEffects`
- Iterate the array
- New effects triggered during iteration are added to `pendingEffects` and processed in the next while-loop iteration

### 4. Subscriber Cache

Multi-level caching to avoid repeated lookups:
- Cache subscribers at object level
- Fast path checks cache first
- Only compute if not cached

## Memory Management

### Subscription Cleanup

```
Effect Disposed
       |
       ├-→ cleanupEffect() - removes from dependencies
       ╰-→ cleanupEffectCompletely() - also cleans up children
```

### WeakMap Usage

All tracking maps use WeakMaps:
- Allows garbage collection of unused objects
- No manual cleanup needed for object references
- Handles frozen/sealed objects via fallback storage

## Limitations

### Inherent Proxy Overhead

- Every property access goes through proxy traps (~12x slower than direct)
- Cannot be optimized away by V8 JIT
- Polymorphic handlers cause deoptimization

### Trade-offs

| Aspect | v1000 (Function-based) | v2000 (Proxy-based) |
|--------|------------------------|---------------------|
| Syntax | `state()`, `state.set()` | `state.value` |
| Batch Performance (1M updates) | 19ms | 75ms (4x slower) |
| Unbatched Performance (1M updates) | 362ms | 1100ms (3x slower) |
| Developer Experience | Verbose | Natural |

## Future Considerations

1. **Selective Proxy Usage**: Mix proxy and function approaches based on usage patterns
2. **V8 Optimization Hints**: Research ways to help V8 optimize proxy handlers
