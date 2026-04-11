---
title: Architecture
description: How Beacon's reactive system works under the hood
---


Beacon is a single-file reactive system built on ES Proxies. No virtual DOM, no compiler, no framework runtime. State mutations flow through Proxy traps into a dependency graph that triggers effects with surgical precision.

## Design principles

1. **Natural syntax** — standard property access (`state.value`), not function calls
2. **Fine-grained tracking** — dependencies tracked per property, not per object
3. **Automatic cleanup** — subscriptions managed through WeakMaps and parent-child relationships
4. **Zero-cost instrumentation** — optional hooks observe internals without affecting behavior

## Proxy-based state

Every object passed to `state()` gets wrapped in a Proxy. The Proxy intercepts five operations:

```
   User Code
  state.count++
        |
        ↓
      Proxy
        |
     get           → Track dependencies
     set           → Notify subscribers
     has           → Track 'in' operator
     deleteProperty → Delete with notification
     ownKeys       → Track key enumeration
        |
        ↓
   Raw Target   (actual data storage)
```

Nested objects are wrapped lazily — the first time you access a nested property, Beacon wraps the child object in its own Proxy. A proxy cache prevents duplicate wrapping.

## Dependency tracking

The system uses a three-level tracking mechanism:

```typescript
// Level 1: Per-property reads
effectStateReads: WeakMap<Subscriber, WeakMap<object, Set<PropertyKey>>>

// Level 2: Object dependencies
effectDependencies: WeakMap<Subscriber, Set<object>>

// Level 3: Subscriber sets
subscriberCache: WeakMap<object, Set<Subscriber>>
```

When an effect runs:

1. Beacon sets `currentEffect` to the running effect
2. Every property read hits the Proxy `get` trap
3. The trap records: this effect reads this property of this object
4. When a property changes, only effects that read **that specific property** re-run

### Stable dependency skip

On re-runs, effects compare new dependencies against the previous run via `depsMatch`. If dependencies haven't changed, Beacon restores previous tracking structures — no subscriber set teardown or rebuild. If dependencies did change, only stale deps are removed.

Subsequent runs use a `trackingOnly` flag that tells Proxy handlers to use lightweight `trackRead` instead of full `registerEffectRead`, skipping `getSubscribers` + `Set.add`.

## Effect execution

Effects run in a controlled environment:

```
Effect Creation → Run Function → Compare Deps → Stable? → Restore previous tracking
      ↑                                         → Changed? → Clean stale deps only
      ╰--------------------------- Dependency Change ←-------- Queue Re-runs ←--╯
```

1. Set `currentEffect`
2. Save previous dependency snapshot (`__prevDeps`, `__prevReads`)
3. Run the effect function — dependencies auto-tracked via proxy traps
4. Compare new deps against previous
5. Handle nested effects via parent-child relationships
6. Queue for re-execution on dependency changes

## The flush queue

Beacon uses non-recursive, queue-based propagation:

1. A state property changes (via `Object.is` comparison)
2. All subscribers are added to `pendingSubscribers`
3. If not in a batch, `flushEffects` processes them
4. Effects copy to an array, `pendingEffects` is cleared, array is iterated
5. New effects triggered during iteration go into `pendingEffects` for the next loop iteration
6. Processing continues until no more effects fire

This queue-based approach prevents stack overflows from deep dependency chains and handles cyclical dependencies between different effects.

## Batch internals

Both batched and unbatched paths use direct property access. They differ in notification timing:

```
Unbatched:
  set trap → Object.is → direct set → scheduleSubscribers → flushEffects

Batched:
  set trap → Object.is → direct set → track in dirtyTargets → [batch end] → flush once
```

The batch fast path (`!onWrite && !currentEffect`):

1. Entering a batch increments `batchDepth`
2. Set handler skips subscriber scheduling — only tracks dirty target-property pairs in `dirtyTargets`
3. Effects created during batch go into `deferredEffectCreations`
4. At `batchDepth === 1` (before decrement): process `dirtyTargets`, call `scheduleSubscribersForTarget` once per unique property
5. When outermost batch completes: run deferred effects, then `flushEffects()`

State objects with write hooks always use the normal path — hooks fire per-mutation.

## Cycle handling

### Direct loops — blocked

An effect that reads and writes the same state throws immediately:

```typescript
effect(() => {
  const value = signal.count
  signal.count = value + 1 // Error: Infinite loop detected!
})
```

Beacon detects this by checking: (1) the update is inside an effect, (2) the effect read from the same state, (3) it's not a nested effect chain.

### Indirect cycles — allowed

Cyclic dependencies across different effects are allowed because queue-based propagation handles them:

```typescript
effect(() => { target.value = source.value * 2 })
effect(() => { source.value = target.value / 2 })
```

Value equality checks (`Object.is`) break the loop when values stabilize. Converging values stop at floating-point precision limits. Unbounded values continue until hitting JavaScript limits (e.g., `Infinity`).

## Memory management

### Subscription cleanup

```
Effect Disposed
       |
       ├→ cleanupEffect() — removes from subscribers, clears __prevDeps/__prevReads
       ╰→ cleanupEffectCompletely() — also cleans up children
```

### WeakMap usage

All tracking maps use WeakMaps:

- Allows garbage collection of unused objects
- No manual cleanup needed for object references
- Handles frozen/sealed objects via fallback storage

### Proxy edge cases

**Array methods**: `push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse` are intercepted to trigger reactivity.

**Frozen/sealed objects**: WeakMap fallbacks store metadata when objects are not extensible.

**Symbol properties**: Internal symbols (`[[beacon_subscribers]]`, `[[beacon_proxy]]`) get special handling to avoid interference.

**Spread operations**: Handled without triggering stack overflows.
