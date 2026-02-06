# Batch

## Overview

`batch()` is a performance optimization that collapses multiple source mutations into a single notification cycle. Without batch, each mutation triggers its own propagation cycle — effects see the result of mutation 1 before mutation 2 happens. With batch, all mutations apply first, then effects run once with the final state. This matters when coordinating updates across multiple state objects or properties.

## API Reference

```typescript
function batch<T>(fn: () => T, hooks?: BatchHooks): T
```

Returns the value returned by `fn`. For hooks, see [Hooks](./README.hooks.md).

## Core Concepts

### Basic Usage

```typescript
import { state, effect, batch } from '@nerdalytics/beacon';

const user = state({ name: 'John', role: 'user' });
const app = state({ theme: 'light', sidebarOpen: true });

effect(() => {
  console.log(`User ${user.name} changed`);
});

effect(() => {
  console.log(`Theme is now ${app.theme}`);
});

// Without batch: triggers both effects separately
user.name = 'Jane';        // Log: "User Jane changed"
app.theme = 'dark';        // Log: "Theme is now dark"

// With batch: triggers both effects after all updates complete
batch(() => {
  user.name = 'Bob';
  user.role = 'admin';
  app.theme = 'light';
  app.sidebarOpen = false;
});
// Then logs:
// "User Bob changed"
// "Theme is now light"

// Note: A single property mutation already propagates consistently
// through derive chains without batch. Batch is for coordinating
// multiple mutations into one notification cycle.
```

## How It Works

### Execution Flow

1. **Batch Start**: Increments `batchDepth` counter
2. **State Updates (fast path)**: When `!onWrite && !currentEffect`, mutations skip subscriber scheduling entirely — only track dirty target-property pairs in `dirtyTargets`
3. **State Updates (normal path)**: When write hooks exist or inside an effect, mutations use the standard path (hooks fire per-mutation, infinite loop detection active)
4. **Effect Creation**: Effects created inside batch go into `deferredEffectCreations` instead of running immediately
5. **Dirty Target Processing**: At `batchDepth === 1` (before decrement), iterate `dirtyTargets` and call `scheduleSubscribersForTarget` once per unique property
6. **Batch End**: Decrements `batchDepth`
7. **Flush**: When depth reaches 0, run deferred effects, then flush all pending effects

```
batch() → batchDepth++ → Execute fn → fast path: track dirty targets (skip scheduling)
                                     → normal path: schedule subscribers (hooks/effects)
                                     → effect() calls go to deferredEffectCreations
         depth === 1?  → Yes → process dirtyTargets → scheduleSubscribersForTarget per prop
         batchDepth--  → depth === 0? → Yes → run deferred effects → flushEffects()
                                      → No  → wait for outer batch
```

### Nested Batches

Batches can be nested - notifications only fire when the outermost batch completes:

```typescript
const state = state({ a: 0, b: 0, c: 0 });

effect(() => console.log(`Sum: ${state.a + state.b + state.c}`));

batch(() => {
  state.a = 1;

  batch(() => {
    state.b = 2;
    batch(() => {
      state.c = 3;
    });  // Inner batch - no notification
  });  // Middle batch - no notification

  state.a = 10;
});  // Outer batch completes - single notification
// Logs once: "Sum: 15"
```

## Performance Impact

### Benchmark Results

For 1,000,000 iterations (median of 7 runs):

| Scenario | Time |
|----------|------|
| batch + derive | 36ms |
| batch + derive + 2 effects | 35ms |
| state + derive (unbatched) | 294ms |
| state + derive + 2 effects (unbatched) | 671ms |

### Why Batch is Fast

The primary performance benefit of batch is **collapsing multiple mutation cycles into one**:

1. **Deferred Scheduling**: During batch, the set handler fast path skips subscriber scheduling entirely — only tracks dirty target-property pairs. Scheduling happens once at batch end.
2. **Single Notification Cycle**: N source mutations produce 1 flush instead of N flushes
3. **Reduced Effect Executions**: Effects that depend on multiple changed properties only run once
4. **Predictable Timing**: All related updates complete before any effects run

Note: For a single source mutation, derive chains already propagate consistently without batch — effects run in creation order (Set insertion order), which matches dependency order. Batch optimizes the multi-mutation case.

```typescript
// Without batch: 3 effect executions
state1.value = 10;  // → scheduleSubscribers → flushEffects()
state2.value = 20;  // → scheduleSubscribers → flushEffects()
state3.value = 30;  // → scheduleSubscribers → flushEffects()

// With batch: 1 flush at the end
batch(() => {
  state1.value = 10;  // → scheduleSubscribers (deferred)
  state2.value = 20;  // → scheduleSubscribers (deferred)
  state3.value = 30;  // → scheduleSubscribers (deferred)
});  // → flushEffects() once
```

## Common Patterns

### 1. Coordinating Multiple States

```typescript
const account1 = state({ balance: 1000 });
const account2 = state({ balance: 500 });
const ledger = state({ entries: [] });

effect(() => {
  console.log(`Account 1: $${account1.balance}`);
});

effect(() => {
  console.log(`Account 2: $${account2.balance}`);
});

effect(() => {
  console.log(`Ledger has ${ledger.entries.length} entries`);
});

// Without batch: Shows intermediate invalid state
function transfer(amount) {
  account1.balance -= amount;  // Effect shows: "Account 1: $900"
  account2.balance += amount;  // Effect shows: "Account 2: $600"
  ledger.entries.push({        // Effect shows: "Ledger has 1 entries"
    from: 'account1',
    to: 'account2',
    amount
  });
  // Problem: Observers saw inconsistent state during transfer!
}

// With batch: Atomic update
function transferBatched(amount) {
  batch(() => {
    account1.balance -= amount;
    account2.balance += amount;
    ledger.entries.push({
      from: 'account1',
      to: 'account2',
      amount
    });
  });
  // All three effects run AFTER the complete transfer
  // Observers never see inconsistent state
}
```

### 2. Bulk Updates with Loops

```typescript
const items = state([]);
const stats = state({ total: 0, average: 0 });
const metadata = state({ lastUpdated: null, updateCount: 0 });

let effectCount = 0;
effect(() => {
  effectCount++;
  console.log(`Stats: total=${stats.total}, avg=${stats.average}`);
});

effect(() => {
  effectCount++;
  console.log(`Last updated: ${metadata.lastUpdated}`);
});

// Without batch: Effects run on EVERY iteration
function addManyItemsNoBatch(newItems) {
  effectCount = 0;
  for (const item of newItems) {
    items.push(item);                    // Each push triggers array subscribers
    stats.total += item.value;           // Triggers first effect
    stats.average = stats.total / items.length;  // Triggers first effect again
    metadata.updateCount++;               // Triggers second effect
  }
  metadata.lastUpdated = Date.now();     // Triggers second effect again
  console.log(`Effects ran ${effectCount} times for ${newItems.length} items`);
  // For 100 items: ~300 effect executions!
}

// With batch: Effects run ONCE after loop
function addManyItemsBatched(newItems) {
  effectCount = 0;
  batch(() => {
    for (const item of newItems) {
      items.push(item);
      stats.total += item.value;
      stats.average = stats.total / items.length;
      metadata.updateCount++;
    }
    metadata.lastUpdated = Date.now();
  });
  console.log(`Effects ran ${effectCount} times for ${newItems.length} items`);
  // For 100 items: 2 effect executions total!
}
```

## Advanced Usage

### Conditional Batching

```typescript
const items = state({ list: [] });
const ui = state({ processing: false, processedCount: 0 });

effect(() => {
  console.log(`Processed ${ui.processedCount} items`);
});

function processItems(data, immediate = false) {
  const update = () => {
    ui.processing = true;
    data.forEach(item => {
      items.list.push(item);
      ui.processedCount++;
    });
    ui.processing = false;
  };

  if (immediate) {
    update();  // Effect runs multiple times for immediate feedback
  } else {
    batch(update);  // Effect runs once after all updates
  }
}

// Usage:
processItems([1, 2, 3], true);   // Shows progress: "1 items", "2 items", "3 items"
processItems([4, 5, 6], false);  // Shows final only: "6 items"
```

## Integration with Effects

### Preventing Over-Rendering

```typescript
const list = state({ items: [], filter: '', sort: 'name' });

// This effect runs once per batch, not per property
const filtered = derive(() => {
  console.log('Recomputing filtered list');
  return list.items
    .filter(item => item.name.includes(list.filter))
    .sort((a, b) => a[list.sort].localeCompare(b[list.sort]));
});

function updateFilters(newFilter, newSort) {
  batch(() => {
    list.filter = newFilter;
    list.sort = newSort;
  });  // Single recomputation
}
```

## Best Practices

### 1. Batch Related Updates

```typescript
// ✅ Good - related updates together
batch(() => {
  user.firstName = 'Jane';
  user.lastName = 'Doe';
  user.fullName = 'Jane Doe';  // Derived, but keeping in sync
});

// ❌ Bad - unrelated updates
batch(() => {
  user.name = 'Jane';
  app.theme = 'dark';  // Unrelated
  socket.connect();    // Side effect
});
```

### 2. Don't Overuse

```typescript
// ❌ Unnecessary for single update
batch(() => {
  state.value = 10;
});

// ✅ Just update directly
state.value = 10;

// ✅ Good use - multiple updates
batch(() => {
  state.x = 10;
  state.y = 20;
  state.z = 30;
});
```

## Common Pitfalls

### 1. Async Operations

```typescript
// ❌ Won't batch - async breaks out of batch context
batch(async () => {
  form.email = email;
  const isValid = await validateEmail(email);  // API call
  form.emailValid = isValid;  // This is NOT batched!
  form.canSubmit = isValid;   // Triggers effects immediately
});

// ✅ Correct - await first, then batch state updates
const isValid = await validateEmail(email);
batch(() => {
  form.email = email;
  form.emailValid = isValid;
  form.canSubmit = isValid;
});
```

## Hooks

`batch()` accepts an optional `hooks` parameter for observing the batch lifecycle — start, end, and error. See [Hooks](./README.hooks.md) for the full API and examples.

## General Tips

1. **Batch multiple state objects**: When updating different states that trigger the same effects
2. **Batch multiple properties for derive**: When changing filter/sort/pagination that a derive depends on
3. **Keep batches synchronous**: Async operations break the batch context
4. **Use for bulk operations**: Essential for loops that update state repeatedly
5. **Don't nest unnecessarily**: Nested batches work but add no benefit

## Testing Batches

```typescript
test('batch groups notifications', () => {
  const state = state({ a: 0, b: 0 });
  let effectCount = 0;

  effect(() => {
    effectCount++;
    const sum = state.a + state.b;
  });

  expect(effectCount).toBe(1);  // Initial run

  batch(() => {
    state.a = 5;
    state.b = 10;
  });

  expect(effectCount).toBe(2);  // Only one additional run
  expect(state.a).toBe(5);
  expect(state.b).toBe(10);
});
```
