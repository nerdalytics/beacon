# Derive

## Overview

`derive()` creates computed values that automatically update when their dependencies change. It's a read-only reactive value that memoizes expensive computations and only recalculates when necessary.

## API Reference

### Function Signature

```typescript
function derive<T>(computeFn: () => T, hooks?: DeriveHooks<T>): ComputedValue<T>

type ComputedValue<T> = {
  readonly value: T | undefined | null
  reactive: boolean
}
```

- `value` — the cached computed result (read-only)
- `reactive` — controls the internal effect lifecycle; set to `false` to dispose, `true` to recreate

For hooks, see [Hooks](./README.hooks.md).

## Core Concepts

### Basic Usage

```typescript
import { state, derive } from '@nerdalytics/beacon';

const items = state({ list: [1, 2, 3] });

// Computed value that depends on state
const sum = derive(() => items.list.reduce((a, b) => a + b, 0));

console.log(sum.value);  // 6

items.list.push(4);
console.log(sum.value);  // 10 (automatically updated)
```

### Eager Evaluation

Derived values are computed eagerly - immediately when created and when dependencies change:

```typescript
const expensive = derive(() => {
  console.log('Computing...');
  return items.list.filter(x => x > 10).length;
});
// Logs: "Computing..." immediately

items.list.push(15);
// Logs: "Computing..." again (dependency changed)

console.log(expensive.value);  // No additional computation, returns cached value
// Returns: 1
```

## How It Works

### Internal Implementation

`derive()` uses an effect under the hood to automatically track and respond to dependency changes:

1. **Creation**: Creates an effect that runs the compute function immediately
2. **Initial Computation**: Executes the function, tracks dependencies, caches result
3. **Dependency Change**: Effect re-runs automatically, updates cached value
4. **Access**: Returns the cached value (no computation on access)

```
Create Derive → Create Effect → Run Compute Function → Track Dependencies → Cache Result
                                        ↓
                    Dependency Changes → Effect Re-runs → Update Cache
                                        ↓
                    Access .value → Return Cached Value (no computation)
```

### Dependency Tracking

Just like effects, derive automatically tracks what it reads:

```typescript
const user = state({ firstName: 'Jane', lastName: 'Doe', age: 30 });

// Only tracks firstName and lastName
const fullName = derive(() => `${user.firstName} ${user.lastName}`);

user.age = 31;  // Doesn't invalidate fullName
user.firstName = 'John';  // Invalidates fullName
```

## Advanced Patterns

### 1. Chained Derivations

Derived values can depend on other derived values:

```typescript
const prices = state({ items: [10, 20, 30] });

const subtotal = derive(() => prices.items.reduce((a, b) => a + b, 0));
const tax = derive(() => subtotal.value * 0.08);
const total = derive(() => subtotal.value + tax.value);

console.log(total.value);  // 64.8
```

### 2. Conditional Computations

```typescript
const config = state({ useCache: true, data: null });
const cache = state({ data: 'cached' });

const result = derive(() => {
  if (config.useCache && cache.data) {
    return cache.data;  // Only depends on cache when useCache is true
  }
  return config.data;
});
```

### 3. Collection Transformations

```typescript
const todos = state([
  { id: 1, text: 'Learn Beacon', done: false },
  { id: 2, text: 'Build app', done: true }
]);

const activeTodos = derive(() => todos.filter(t => !t.done));
const completedCount = derive(() => todos.filter(t => t.done).length);
const progress = derive(() => {
  const total = todos.length;
  return total ? (completedCount.value / total) * 100 : 0;
});
```

### 4. Expensive Computations

```typescript
const dataset = state({ points: generateLargeDataset() });

// Only recalculates when points change
const statistics = derive(() => {
  const points = dataset.points;
  return {
    mean: calculateMean(points),
    median: calculateMedian(points),
    stdDev: calculateStdDev(points)
  };
});

// Access multiple times, computed only once
console.log(statistics.value.mean);
console.log(statistics.value.median);
```

## Performance Characteristics

### Memoization

Derived values cache their results:

```typescript
const data = state({ value: 100 });
let computeCount = 0;

const expensive = derive(() => {
  computeCount++;
  // Simulate expensive operation
  return data.value * Math.random();
});

const v1 = expensive.value;  // computeCount: 1
const v2 = expensive.value;  // computeCount: 1 (cached)

data.value = 200;
const v3 = expensive.value;  // computeCount: 2 (recomputed)
```

### Batch Optimization

When multiple source mutations change different dependencies, batch ensures the derive recomputes once instead of once per mutation. This is a multi-mutation optimization — a single source mutation already propagates consistently through a derive chain without batch, because effects run in creation order (which matches dependency order).

```typescript
const a = state({ value: 1 });
const b = state({ value: 2 });
const c = state({ value: 3 });

let computeCount = 0;
const sum = derive(() => {
  computeCount++;
  return a.value + b.value + c.value;
});

// Without batch: derive recomputes for EACH change
a.value = 10;  // Recomputes (count: 1)
b.value = 20;  // Recomputes (count: 2)
c.value = 30;  // Recomputes (count: 3)
// Total: 3 computations

// With batch: derive recomputes ONCE after all changes
batch(() => {
  a.value = 100;
  b.value = 200;
  c.value = 300;
});
// Total: 1 computation (4x performance improvement!)
```

This optimization is especially valuable for complex filtering and sorting:

```typescript
const list = state({
  items: [...],
  filter: '',
  sort: 'name'
});

let computeCount = 0;
const filtered = derive(() => {
  computeCount++;
  return list.items
    .filter(item => item.name.includes(list.filter))
    .sort((a, b) => a[list.sort].localeCompare(b[list.sort]));
});

// Without batch: 2 expensive recomputations
list.filter = 'apple';  // Full filter + sort
list.sort = 'price';    // Full filter + sort again

// With batch: 1 computation for both changes
batch(() => {
  list.filter = 'apple';
  list.sort = 'price';
});
// 2x performance improvement!
```

### Comparison with Effects

Both `derive()` and `effect()` run eagerly, but serve different purposes:

```typescript
// derive - Computes and caches a value
const computedSum = derive(() => {
  console.log('Computing derived');
  return items.list.reduce((a, b) => a + b, 0);
});
// Logs: "Computing derived" immediately

// effect - Performs side effects
let effectSum = 0;
const dispose = effect(() => {
  console.log('Computing effect');
  effectSum = items.list.reduce((a, b) => a + b, 0);
});
// Logs: "Computing effect" immediately

items.list.push(4);
// Both log immediately when dependency changes
// Logs: "Computing derived"
// Logs: "Computing effect"

// Key difference: derive provides a cached value
console.log(computedSum.value);  // No recomputation, returns cached value
computedSum.reactive = false;    // Stop tracking dependencies

// Effect must be manually disposed via its return value
dispose();  // Clean up the effect
```

## Common Patterns

### 1. Derived State Slices

```typescript
const appState = state({
  user: { id: 1, name: 'Alice', role: 'admin' },
  permissions: ['read', 'write', 'delete']
});

const isAdmin = derive(() => appState.user.role === 'admin');
const canDelete = derive(() =>
  isAdmin.value || appState.permissions.includes('delete')
);
```

### 2. Search and Filtering

```typescript
const products = state([
  { id: 1, name: 'Laptop', price: 999, category: 'electronics' },
  { id: 2, name: 'Shirt', price: 29, category: 'clothing' }
]);

const filters = state({
  search: '',
  category: 'all',
  maxPrice: 1000
});

const filteredProducts = derive(() => {
  let result = products;

  if (filters.search) {
    result = result.filter(p =>
      p.name.toLowerCase().includes(filters.search.toLowerCase())
    );
  }

  if (filters.category !== 'all') {
    result = result.filter(p => p.category === filters.category);
  }

  return result.filter(p => p.price <= filters.maxPrice);
});
```

### 3. Form Validation

```typescript
const form = state({
  email: '',
  password: '',
  confirmPassword: ''
});

const validation = derive(() => {
  const errors = [];

  if (!form.email.includes('@')) {
    errors.push('Invalid email');
  }

  if (form.password.length < 8) {
    errors.push('Password too short');
  }

  if (form.password !== form.confirmPassword) {
    errors.push('Passwords do not match');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
});
```

## Memory Management

### Disposal via `reactive` Toggle

Derived values create an internal `state()` + `effect()` pair. Set `reactive` to `false` to dispose the internal effect and stop tracking dependencies:

```typescript
const local = state({ value: 10 });
const computed = derive(() => local.value * 2);

console.log(computed.value);  // 20

// Dispose: stop reacting to dependency changes
computed.reactive = false;

// After disposal, .value still returns the last computed value
console.log(computed.value);  // 20 (retained, not undefined)

// Re-enable: recreates the internal effect and recomputes
computed.reactive = true;
```

### Preventing Memory Leaks

Without disposal, derived values accumulate and their internal effects keep running:

```typescript
// ❌ Bad - Memory leak
function createLeakyDerived() {
  const computed = derive(() => globalState.value * 2);
  return computed.value;  // Returns value but effect keeps running!
}

// ✅ Good - Proper cleanup
function createCleanDerived() {
  const computed = derive(() => globalState.value * 2);
  const value = computed.value;
  computed.reactive = false;  // Clean up after getting value
  return value;
}

// ✅ Better - Return derive for caller to manage lifecycle
function createManagedDerived() {
  return derive(() => globalState.value * 2);
  // Caller sets reactive = false when done
}
```

### Circular References

This code fails at runtime because `c` is not yet defined when `b` is created — it is a JavaScript `ReferenceError`, not a Beacon-specific check:

```typescript
const a = state({ value: 1 });

const b = derive(() => c.value + 1);  // ReferenceError: c is not defined
const c = derive(() => b.value + 1);
```

## Gotchas and Best Practices

### 1. Always Dispose When Done

Derived values create internal effects that must be cleaned up:

```typescript
// ❌ Bad - Creates memory leak
function leakyComponent() {
  const computed = derive(() => expensiveCalculation());
  return computed.value;  // Returns value but effect keeps running
}

// ✅ Good - Proper cleanup
function cleanComponent() {
  const computed = derive(() => expensiveCalculation());
  const value = computed.value;
  computed.reactive = false;
  return value;
}

// ✅ Better - Let caller manage lifecycle
function reusableComponent() {
  return derive(() => expensiveCalculation());
  // Caller sets reactive = false when done
}
```

### 2. Don't Mutate in Derive

Derived values should be pure - no side effects:

```typescript
// ❌ Bad - has side effects
const bad = derive(() => {
  localStorage.setItem('value', state.value);  // Side effect!
  return state.value * 2;
});

// ✅ Good - pure computation
const good = derive(() => state.value * 2);

// Use effect for side effects
effect(() => {
  localStorage.setItem('value', good.value);
});
```

### 3. Avoid Creating Objects Unnecessarily

```typescript
// ❌ Creates new object every access
const bad = derive(() => ({
  x: state.x,
  y: state.y
}));

// ✅ Only creates new object when values change
const good = derive(() => {
  const x = state.x;
  const y = state.y;
  return { x, y };  // Memoized until x or y changes
});
```

### 4. Use for Expensive Computations

```typescript
const data = state({ numbers: [1, 2, 3, ...] });

// ❌ Recalculates on every render
function Component() {
  const sorted = data.numbers.sort((a, b) => b - a);
}

// ✅ Calculates once, caches result
const sorted = derive(() =>
  [...data.numbers].sort((a, b) => b - a)
);
```

## Integration Examples

### With UI Frameworks

```typescript
// React-like usage
function TodoList() {
  const todos = state([...]);
  const stats = derive(() => ({
    total: todos.length,
    completed: todos.filter(t => t.done).length,
    pending: todos.filter(t => !t.done).length
  }));

  return {
    todos,
    stats: stats.value  // Access in render
  };
}
```

### With Async Data

```typescript
const userId = state({ id: 1 });
const userData = state({ data: null, loading: false });

// Derived loading state
const isReady = derive(() =>
  !userData.loading && userData.data !== null
);

// Effect to load data when userId changes
effect(() => {
  userData.loading = true;
  fetch(`/api/users/${userId.id}`)
    .then(res => res.json())
    .then(data => {
      userData.data = data;
      userData.loading = false;
    });
});
```

## Testing Derived Values

```typescript
test('derive updates when dependencies change', () => {
  const source = state({ value: 10 });
  const doubled = derive(() => source.value * 2);

  expect(doubled.value).toBe(20);

  source.value = 15;
  expect(doubled.value).toBe(30);

  // Clean up
  doubled.reactive = false;
});

test('derive computes eagerly', () => {
  let computeCount = 0;
  const source = state({ value: 10 });

  const computed = derive(() => {
    computeCount++;
    return source.value * 2;
  });

  expect(computeCount).toBe(1);  // Computed immediately on creation

  const v1 = computed.value;
  expect(computeCount).toBe(1);  // No additional computation on access

  source.value = 20;
  expect(computeCount).toBe(2);  // Recomputed when dependency changes

  const v2 = computed.value;
  expect(computeCount).toBe(2);  // No additional computation on access

  computed.reactive = false;
});

test('derive supports disposal via reactive toggle', () => {
  const source = state({ value: 10 });
  const computed = derive(() => source.value * 2);

  expect(computed.value).toBe(20);

  // Dispose the derive
  computed.reactive = false;

  // .value still returns the last computed value
  expect(computed.value).toBe(20);

  // Changes to source no longer trigger recomputation
  source.value = 30;
  expect(computed.value).toBe(20);  // Still the old value

  // Re-enable reactivity
  computed.reactive = true;
  expect(computed.value).toBe(60);  // Recomputed with current source
});
```

## Hooks

`derive()` accepts an optional `hooks` parameter for observing computation, cache hits, disposal, errors, and dependency changes. See [Hooks](./README.hooks.md) for the full API and examples.

## Performance Tips

1. **Set `reactive = false` on unused derives**: Prevent memory leaks and unnecessary computations
2. **Use batch for multiple updates**: Derive only recomputes once per batch
3. **Keep computations simple**: Complex derives run on every dependency change
4. **Avoid deep nesting**: Chains of derives add overhead
5. **Cache external data**: Don't refetch in derive functions
6. **Use effects for side effects**: Keep derives pure
7. **Profile before optimizing**: Not all computations need memoization
8. **Consider lifecycle**: Short-lived derives should set `reactive = false` promptly
