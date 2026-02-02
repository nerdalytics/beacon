# Effect

## Overview

`effect()` creates reactive functions that automatically re-run when their dependencies change. Effects are the bridge between reactive state and side effects like DOM updates, network requests, or logging.

## Core Concepts

### Basic Usage

```typescript
import { state, effect } from '@nerdalytics/beacon';

const counter = state({ count: 0 });

// Effect automatically tracks dependencies
const dispose = effect(() => {
  console.log(`Count is: ${counter.count}`);
});
// Effect runs immediately to establish state dependency
// Logs immediately: "Count is: 0"

counter.count++;  // Logs: "Count is: 1"
counter.count++;  // Logs: "Count is: 2"

// Clean up when done
dispose();
counter.count++;  // No log (effect disposed)
```

### Automatic Dependency Tracking

Effects automatically detect which reactive values they use:

```typescript
const user = state({ name: 'Alice', age: 30, role: 'admin' });

effect(() => {
  // Only tracks 'name' and 'age', not 'role'
  console.log(`${user.name} is ${user.age} years old`);
});

user.name = 'Bob';  // Triggers effect
user.age = 31;      // Triggers effect
user.role = 'user'; // Does NOT trigger effect
```

## How It Works

### Execution Flow

1. **Initial Run**: Effect runs immediately when created
2. **Dependency Tracking**: During execution, any reactive property access is recorded
3. **Subscription**: Effect subscribes to all accessed properties
4. **Re-execution**: When dependencies change, effect is queued for re-run
5. **Cleanup**: Old dependencies are cleaned up before new run

```
Create Effect -> Set as Current -> Run Function -> Track Deps -> Wait for Changes
                                       ^                              |
                                       |<---- Dependency Changed <----|
```

### Nested Effects

Effects can create other effects:

```typescript
const config = state({ enabled: true, value: 0 });
const data = state({ multiplier: 2 });

effect(() => {
  console.log('Outer effect: config.enabled =', config.enabled);

  if (config.enabled) {
    // This inner effect is created conditionally
    effect(() => {
      console.log('Inner effect: result =', config.value * data.multiplier);
    });
  }
});

// Initial output:
// Outer effect: config.enabled = true
// Inner effect: result = 0

data.multiplier = 3;
// Inner effect: result = 0 (inner effect re-runs)

config.value = 5;
// Inner effect: result = 15 (inner effect re-runs)

config.enabled = false;
// Outer effect: config.enabled = false (outer re-runs, inner is disposed)

data.multiplier = 10;
// No output (inner effect was disposed when outer re-ran)
```

### Parent-Child Relationships

When an effect creates another effect, they form a parent-child relationship:

```typescript
const parent = effect(() => {
  console.log('Parent running');

  // Child effect
  effect(() => {
    console.log('Child running');
  });
});

// When parent is disposed, child is also cleaned up
```

## Advanced Patterns

### 1. Conditional Dependencies

Effects only track what they actually access:

```typescript
const state = state({ useA: true, a: 1, b: 2 });

effect(() => {
  if (state.useA) {
    console.log(`A: ${state.a}`);  // Only tracks 'useA' and 'a'
  } else {
    console.log(`B: ${state.b}`);  // Would track 'useA' and 'b'
  }
});
```

### 2. Computed Side Effects

Combine with `derive` for computed values with side effects:

```typescript
const items = state({ list: [1, 2, 3] });

const sum = derive(() => items.list.reduce((a, b) => a + b, 0));

effect(() => {
  console.log(`Sum changed to: ${sum.value}`);
  // Send analytics, update localStorage, etc.
});
```

## Infinite Loop Prevention

Beacon prevents effects from updating their own dependencies:

```typescript
const counter = state({ count: 0 });

// This will throw an error
effect(() => {
  const value = counter.count;
  counter.count = value + 1;  // Error: Infinite loop detected!
});
```

**Note**: *Beacon detects this pattern and throws an error, as Beacon is not a compiler and cannot statically analyze the side-effect function to determine if the function could break the infinite loop and exit.*

### Safe Patterns

```typescript
// ✅ Update different state
const source = state({ value: 0 });
const target = state({ value: 0 });

effect(() => {
  target.value = source.value * 2;  // Safe: different states
});

// ✅ Use derive for computed values
const doubled = derive(() => counter.count * 2);
```

## Performance Considerations

### 1. Effect Granularity

Fine-grained effects are more efficient:

```typescript
// ❌ One big effect
effect(() => {
  updateHeader(user.name);
  updateSidebar(user.role);
  updateContent(user.preferences);
});

// ✅ Separate focused effects
effect(() => updateHeader(user.name));
effect(() => updateSidebar(user.role));
effect(() => updateContent(user.preferences));
```

### 2. Debouncing Effects

For expensive operations:

```typescript
// Create a debounced effect that only executes after changes stop
let timeout;
effect(() => {
  const currentData = state.data;  // Access state to track changes

  clearTimeout(timeout);
  timeout = setTimeout(() => {
    console.log('Saving to server:', currentData);
    saveToServer(currentData);
  }, 500);
});

// Rapid updates will cancel previous timeouts
state.data = 'update1';  // Starts 500ms timer
state.data = 'update2';  // Cancels previous, starts new 500ms timer
state.data = 'update3';  // Cancels previous, starts new 500ms timer
// Only 'update3' gets saved after 500ms of inactivity
```

### 3. Batching Updates

Effects are automatically batched within `batch()`:

```typescript
const stats = state({ a: 0, b: 0, c: 0 });

effect(() => {
  console.log(`Total: ${stats.a + stats.b + stats.c}`);
});

// Without batch: logs 3 times
stats.a = 1;  // Log: "Total: 1"
stats.b = 2;  // Log: "Total: 3"
stats.c = 3;  // Log: "Total: 6"

// With batch: logs once
batch(() => {
  stats.a = 1;
  stats.b = 2;
  stats.c = 3;
});  // Log: "Total: 6"
```

Multiple independent effects are also batched together:

```typescript
// Two separate states
const userState = state({ name: 'Alice', age: 30 });
const settingsState = state({ theme: 'light', notifications: true });

// Two separate effects watching individual states
effect(() => {
  console.log(`User updated: ${userState.name}, age ${userState.age}`);
});

effect(() => {
  console.log(`Settings updated: theme=${settingsState.theme}, notifications=${settingsState.notifications}`);
});

// Initial output:
// User updated: Alice, age 30
// Settings updated: theme=light, notifications=true

// Without batch: each update triggers its effect immediately
userState.name = 'Bob';           // Log: "User updated: Bob, age 30"
userState.age = 31;                // Log: "User updated: Bob, age 31"
settingsState.theme = 'dark';     // Log: "Settings updated: theme=dark, notifications=true"

// With batch: all updates complete, then all effects run once
batch(() => {
  userState.name = 'Charlie';
  userState.age = 25;
  settingsState.theme = 'blue';
  settingsState.notifications = false;
});
// Output (both effects run once after batch completes):
// User updated: Charlie, age 25
// Settings updated: theme=blue, notifications=false
```

## Memory Management

### Disposal

Always dispose effects when no longer needed:

```typescript
const dispose = effect(() => {
  // Effect logic
});

// Later, clean up
dispose();
```

### Automatic Cleanup

Child effects are automatically cleaned up:

```typescript
let disposeChild;

const disposeParent = effect(() => {
  // Previous child is cleaned up automatically
  disposeChild = effect(() => {
    console.log('Child effect');
  });
});

disposeParent();  // Both parent and child are cleaned up
```

### WeakMap References

Beacon uses WeakMaps internally, allowing garbage collection:

```typescript
function createTempEffect() {
  const temp = state({ value: 0 });

  effect(() => {
    console.log(temp.value);
  });

  // When function exits, both state and effect can be GC'd
}
```

## Common Pitfalls

### 1. Forgetting to Dispose

```typescript
// ❌ Memory leak
function setupComponent() {
  effect(() => {
    // Never disposed
  });
}

// ✅ Proper cleanup
function setupComponent() {
  const dispose = effect(() => {
    // Effect logic
  });

  return dispose;  // Return for caller to dispose
}
```

### 2. Accessing Properties in Callbacks

**Why callbacks don't track dependencies:** Beacon tracks dependencies by setting a global `currentEffect` variable during effect execution. When you access reactive state, the proxy's get trap checks if `currentEffect` exists and registers the dependency. However, async callbacks (setTimeout, Promise.then, event handlers) execute **after** the effect has finished running, when `currentEffect` is no longer set.

```typescript
// ❌ Won't track dependencies
effect(() => {
  // currentEffect is set here
  setTimeout(() => {
    // currentEffect is null here - callback runs later
    console.log(state.value);  // Not tracked!
  }, 1000);
  // currentEffect is cleared when effect finishes
});

// ✅ Access in effect body
effect(() => {
  // currentEffect is set here
  const value = state.value;  // Tracked - accessed while currentEffect exists
  setTimeout(() => {
    // currentEffect is null here, but we already captured the value
    console.log(value);
  }, 1000);
});
```

This same principle applies to:
- Promise callbacks (`.then()`, `.catch()`, `async/await`)
- Event handlers (`addEventListener`)
- Any other deferred execution

### 3. Array Index Dependencies

Beacon tracks array indices with fine-grained precision:

```typescript
const list = state({ items: [1, 2, 3] });

// Effect that only tracks index 0
effect(() => {
  console.log(list.items[0]);  // Only tracks index 0
});

// Effect that tracks array length
effect(() => {
  console.log(list.items.length);  // Only tracks length property
});

list.items[1] = 99;  // Won't trigger either effect
list.items[0] = 99;  // Only triggers first effect
list.items[5] = 99;  // Triggers second effect (length changes from 3 to 6)
```

**Note**: Array mutating methods like `push()`, `pop()`, `splice()` notify all subscribers because they can affect multiple properties (indices, length).

## Integration Examples

### With Network Requests

```typescript
const filters = state({
  search: '',
  category: 'all'
});

effect(() => {
  const params = new URLSearchParams({
    search: filters.search,
    category: filters.category
  });

  fetch(`/api/products?${params}`)
    .then(res => res.json())
    .then(data => {
      // Update results
    });
});
```

### With Local Storage

```typescript
const settings = state({
  theme: 'light',
  language: 'en'
});

// Persist to localStorage
effect(() => {
  localStorage.setItem('settings', JSON.stringify({
    theme: settings.theme,
    language: settings.language
  }));
});
```

## Testing Effects

```typescript
import { state, effect } from '@nerdalytics/beacon';

test('effect tracks dependencies', () => {
  const counter = state({ count: 0 });
  const calls = [];

  const dispose = effect(() => {
    calls.push(counter.count);
  });

  expect(calls).toEqual([0]);  // Initial run

  counter.count = 1;
  expect(calls).toEqual([0, 1]);  // Triggered

  dispose();
  counter.count = 2;
  expect(calls).toEqual([0, 1]);  // Not triggered after disposal
});
```
