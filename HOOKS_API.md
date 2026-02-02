# Beacon Hooks API Reference

## Table of Contents

- [Hook Interfaces](#hook-interfaces)
  - [StateHooks](#statehooks)
  - [EffectHooks](#effecthooks)
  - [DeriveHooks](#derivehooks)
  - [BatchHooks](#batchhooks)
- [Core API Integration](#core-api-integration)
- [Hook Utilities](#hook-utilities)
- [TypeScript Support](#typescript-support)

## Hook Interfaces

### StateHooks

Hooks for intercepting state operations on reactive objects.

```typescript
type HookFunction<Args extends any[]> = (...args: Args) => void;
type SingleOrArray<T> = T | T[];

interface StateHooks<T = any> {
  onRead?: SingleOrArray<HookFunction<[prop: PropertyKey, value: unknown, target: T]>>;
  onWrite?: SingleOrArray<HookFunction<[prop: PropertyKey, oldValue: unknown, newValue: unknown, target: T]>>;
  onDelete?: SingleOrArray<HookFunction<[prop: PropertyKey, hadProperty: boolean, target: T]>>;
  onHas?: SingleOrArray<HookFunction<[prop: PropertyKey, exists: boolean, target: T]>>;
  onOwnKeys?: SingleOrArray<HookFunction<[keys: PropertyKey[], target: T]>>;
}
```

Each hook can be provided as either:
- A single function
- An array of functions (executed in order)

**Important:** Hooks automatically propagate to nested objects. When you access a nested object through a reactive proxy, it inherits the parent's hooks:

```typescript
const $store = state({
  user: {
    name: 'Alice',
    settings: {
      theme: 'dark'
    }
  }
}, {
  onWrite: (prop, oldValue, newValue) => {
    console.log(`[${String(prop)}]: ${oldValue} → ${newValue}`);
  }
});

// Hooks apply to nested objects automatically
$store.user.name = 'Bob';              // Logs: "[name]: Alice → Bob"
$store.user.settings.theme = 'light';  // Logs: "[theme]: dark → light"
```

#### onRead

Fired when a property is accessed.

**Parameters:**
- `prop: PropertyKey` - The property being read
- `value: unknown` - The current value of the property
- `target: T` - The raw target object (not the proxy)

**Example:**
```typescript
const $state = state({ count: 0 }, {
  onRead: (prop, value, target) => {
    console.log(`Reading ${String(prop)} = ${value}`);
  }
});

const value = $state.count;  // Logs: "Reading count = 0"
```

#### onWrite

Fired when a property is modified.

**Parameters:**
- `prop: PropertyKey` - The property being written
- `oldValue: unknown` - The previous value
- `newValue: unknown` - The new value being set
- `target: T` - The raw target object (not the proxy)

**Example:**
```typescript
const $state = state({ count: 0 }, {
  onWrite: (prop, oldValue, newValue, target) => {
    console.log(`${String(prop)}: ${oldValue} → ${newValue}`);
  }
});

$state.count = 5;  // Logs: "count: 0 → 5"
```

#### onDelete

Fired when a property is deleted.

**Parameters:**
- `prop: PropertyKey` - The property being deleted
- `hadProperty: boolean` - Whether the property existed before deletion
- `target: T` - The raw target object (not the proxy)

**Example:**
```typescript
const $state = state({ temp: 'value' }, {
  onDelete: (prop, hadProperty, target) => {
    if (hadProperty) {
      console.log(`Deleted property: ${String(prop)}`);
    }
  }
});

delete $state.temp;  // Logs: "Deleted property: temp"
```

#### onHas

Fired when the `in` operator is used.

**Parameters:**
- `prop: PropertyKey` - The property being checked
- `exists: boolean` - Whether the property exists
- `target: T` - The raw target object (not the proxy)

**Example:**
```typescript
const $state = state({ name: 'Alice' }, {
  onHas: (prop, exists, target) => {
    console.log(`Checking ${String(prop)}: ${exists}`);
  }
});

'name' in $state;  // Logs: "Checking name: true"
'age' in $state;   // Logs: "Checking age: false"
```

#### onOwnKeys

Fired when object keys are enumerated (Object.keys, for...in, etc).

**Parameters:**
- `keys: PropertyKey[]` - Array of property keys
- `target: T` - The raw target object (not the proxy)

**Example:**
```typescript
const $state = state({ a: 1, b: 2 }, {
  onOwnKeys: (keys, target) => {
    console.log(`Keys accessed: ${keys.join(', ')}`);
  }
});

Object.keys($state);  // Logs: "Keys accessed: a, b"
```

### EffectHooks

Hooks for monitoring effect lifecycle and behavior.

```typescript
interface EffectHooks {
  onRun?: SingleOrArray<HookFunction<[effectName?: string]>>;
  onDispose?: SingleOrArray<HookFunction<[effectName?: string]>>;
  onError?: SingleOrArray<HookFunction<[error: Error, effectName?: string]>>;
  onDependencyAdd?: SingleOrArray<HookFunction<[target: object, prop: PropertyKey, effectName?: string]>>;
  onSchedule?: SingleOrArray<HookFunction<[effectName?: string]>>;
}
```

Note: `onDependencyTrack` has been renamed to `onDependencyAdd` for clarity.

#### onRun

Fired when an effect executes.

**Parameters:**
- `effectName?: string` - Optional name provided to the effect

**Example:**
```typescript
const dispose = effect(() => {
  console.log('Effect body');
}, 'myEffect', {
  onRun: (name) => {
    console.log(`Running effect: ${name}`);
  }
});
// Logs: "Running effect: myEffect"
// Logs: "Effect body"
```

#### onDispose

Fired when an effect is disposed.

**Parameters:**
- `effectName?: string` - Optional name provided to the effect

**Example:**
```typescript
const dispose = effect(() => {
  // Effect body
}, 'myEffect', {
  onDispose: (name) => {
    console.log(`Disposing effect: ${name}`);
  }
});

dispose();  // Logs: "Disposing effect: myEffect"
```

#### onError

Fired when an effect throws an error.

**Parameters:**
- `error: Error` - The error that was thrown
- `effectName?: string` - Optional name provided to the effect

**Example:**
```typescript
effect(() => {
  throw new Error('Something went wrong');
}, 'errorEffect', {
  onError: (error, name) => {
    console.error(`Error in ${name}: ${error.message}`);
  }
});
// Logs: "Error in errorEffect: Something went wrong"
```

#### onDependencyAdd

Fired when an effect adds a new dependency.

**Parameters:**
- `target: object` - The object being tracked
- `prop: PropertyKey` - The property being tracked
- `effectName?: string` - Optional name provided to the effect

**Example:**
```typescript
const $state = state({ count: 0 });

effect(() => {
  const value = $state.count;  // Dependency tracked here
}, 'tracker', {
  onDependencyAdd: (target, prop, name) => {
    console.log(`${name} tracks ${String(prop)}`);
  }
});
// Logs: "tracker tracks count"
```

#### onSchedule

Fired when an effect is scheduled for re-execution.

**Parameters:**
- `effectName?: string` - Optional name provided to the effect

**Example:**
```typescript
const $state = state({ count: 0 });

effect(() => {
  console.log($state.count);
}, 'counter', {
  onSchedule: (name) => {
    console.log(`Scheduling ${name} for re-run`);
  }
});

$state.count++;  // Logs: "Scheduling counter for re-run"
```

### DeriveHooks

Hooks for monitoring computed values.

```typescript
interface DeriveHooks<T = any> {
  onCompute?: SingleOrArray<HookFunction<[previousValue: T | undefined]>>;
  onCacheHit?: SingleOrArray<HookFunction<[value: T, cacheHit: boolean]>>;
  onDispose?: SingleOrArray<HookFunction<[]>>;
  onError?: SingleOrArray<HookFunction<[error: Error]>>;
  onDependencyChange?: SingleOrArray<HookFunction<[target: object, prop: PropertyKey]>>;
}
```

Note: 
- Hooks no longer track counts internally - hooks can maintain their own metrics if needed

#### onCompute

Fired when a derived value is recomputed.

**Parameters:**
- `previousValue: T | undefined` - The previous computed value

**Example:**
```typescript
const $count = state({ value: 0 });

const $doubled = derive(() => $count.value * 2, {
  onCompute: (prev) => {
    console.log(`Computing... Previous: ${prev}`);
  }
});
// Logs: "Computing... Previous: undefined"

$count.value = 5;
// Logs: "Computing... Previous: 0"
```

#### onCacheHit

Fired when a derived value is accessed.

**Parameters:**
- `value: T` - The value being returned
- `cacheHit: boolean` - Whether this is a cached value or freshly computed

**Example:**
```typescript
const $expensive = derive(() => complexCalculation(), {
  onCacheHit: (value, cacheHit) => {
    if (cacheHit) {
      console.log(`Returning cached value: ${value}`);
    } else {
      console.log(`Computed fresh value: ${value}`);
    }
  }
});

const v1 = $expensive.value;  // Logs: "Computed fresh value: [value]"
const v2 = $expensive.value;  // Logs: "Returning cached value: [value]"
```

#### onDependencyChange

Fired when a dependency changes.

**Parameters:**
- `target: object` - The object that changed
- `prop: PropertyKey` - The property that changed

**Example:**
```typescript
const $state = state({ x: 1, y: 2 });

const $sum = derive(() => $state.x + $state.y, {
  onDependencyChange: (target, prop) => {
    console.log(`Dependency ${String(prop)} changed`);
  }
});

$state.x = 10;  // Logs: "Dependency x changed"
```

### BatchHooks

Hooks for monitoring batch operations.

```typescript
interface BatchHooks {
  onBatchStart?: SingleOrArray<HookFunction<[depth: number]>>;
  onBatchEnd?: SingleOrArray<HookFunction<[depth: number]>>;
  onBatchError?: SingleOrArray<HookFunction<[error: Error, depth: number]>>;
}
```

Note: `onBatchEnd` no longer includes `updateCount` - hooks can track their own metrics if needed

#### onBatchStart

Fired when a batch operation begins.

**Parameters:**
- `depth: number` - Nesting depth of the batch

**Example:**
```typescript
batch(() => {
  // Batch operations
}, {
  onBatchStart: (depth) => {
    console.log(`Batch started at depth ${depth}`);
  }
});
// Logs: "Batch started at depth 1"
```

#### onBatchEnd

Fired when a batch operation completes.

**Parameters:**
- `depth: number` - Nesting depth of the batch

**Example:**
```typescript
const $state = state({ a: 0, b: 0 });

batch(() => {
  $state.a = 1;
  $state.b = 2;
}, {
  onBatchEnd: (depth) => {
    console.log(`Batch at depth ${depth} completed`);
  }
});
// Logs: "Batch at depth 1 completed"
```

#### onBatchError

Fired when a batch operation throws an error.

**Parameters:**
- `error: Error` - The error that was thrown
- `depth: number` - Nesting depth where error occurred

**Example:**
```typescript
batch(() => {
  throw new Error('Batch failed');
}, {
  onBatchError: (error, depth) => {
    console.error(`Batch error at depth ${depth}: ${error.message}`);
  }
});
// Logs: "Batch error at depth 1: Batch failed"
```

## Core API Integration

### state()

```typescript
function state<T extends object>(
  initial: T,
  hooks?: StateHooks<T>
): T
```

**Example:**
```typescript
import { state } from '@nerdalytics/beacon';
import { logRead, logWrite, persist } from '@nerdalytics/beacon/hooks';

// Single hooks
const $user = state({ 
  name: 'Alice',
  age: 30 
}, {
  onRead: logRead(),
  onWrite: logWrite()
});

// Multiple hooks using arrays
const $persistedUser = state({ 
  name: 'Bob',
  age: 25 
}, {
  onWrite: [
    logWrite(),
    persist('user-data')
  ]
});
```

### effect()

```typescript
function effect(
  fn: EffectCallback,
  name?: string,
  hooks?: EffectHooks
): Unsubscribe
```

**Example:**
```typescript
import { effect } from '@nerdalytics/beacon';
import { logEffect, profileEffect } from '@nerdalytics/beacon/hooks';

// Mixed single and array hooks
const dispose = effect(
  () => {
    // Effect body
  },
  'myEffect',
  {
    onRun: [logEffect(), profileEffect()],  // Multiple hooks
    onDispose: () => console.log('Cleanup')  // Single hook
  }
);
```

### derive()

```typescript
function derive<T>(
  computeFn: () => T,
  hooks?: DeriveHooks<T>
): ComputedValue<T>
```

**Example:**
```typescript
import { derive } from '@nerdalytics/beacon';
import { logDerive } from '@nerdalytics/beacon/hooks';

const $computed = derive(
  () => expensiveCalculation(),
  {
    onCompute: logDerive(),
    onCacheHit: (value, cacheHit) => {
      if (cacheHit) console.log('Using cached value');
    }
  }
);
```

### batch()

```typescript
function batch<T>(
  fn: () => T,
  hooks?: BatchHooks
): T
```

**Example:**
```typescript
import { batch } from '@nerdalytics/beacon';
import { profileBatch } from '@nerdalytics/beacon/hooks';

batch(() => {
  // Multiple state updates
}, {
  onBatchStart: () => console.time('batch'),
  onBatchEnd: () => console.timeEnd('batch'),
  onBatchError: [  // Multiple error handlers
    (err) => console.error('Batch failed:', err),
    (err) => rollback(),
    (err) => notifyUser()
  ]
});
```

## Array-Based Hook Composition

Instead of using a `compose` utility, hooks can be provided as arrays for natural composition:

### Single Hook

```typescript
const $state = state({ count: 0 }, {
  onWrite: logWrite()  // Single hook function
});
```

### Multiple Hooks (Array)

```typescript
const $state = state({ count: 0 }, {
  onWrite: [
    logWrite(),              // Executes first
    persist('storage-key'),  // Executes second
    validate(validationRules) // Executes third
  ]
});
```

### Mixed Single and Array

```typescript
effect(() => {
  // effect body
}, 'myEffect', {
  onRun: profileEffect(),      // Single hook
  onError: [                   // Multiple hooks
    logError(),
    reportToSentry(),
    fallbackHandler()
  ]
});
```

**Execution Order:**
- Array hooks execute in the order they appear
- The internal compose function wraps each hook in error isolation - if one throws, others still execute
- Undefined/null hooks are ignored

## TypeScript Support

### Generic Type Parameters

All hooks support TypeScript generics for type safety:

```typescript
interface User {
  name: string;
  age: number;
}

const $user = state<User>({ name: 'Alice', age: 30 }, {
  onWrite: (prop, oldValue, newValue, target) => {
    // TypeScript knows target is User
    // prop is keyof User
    // values are typed based on User properties
  }
});
```

### Custom Hook Types

Create typed custom hooks:

```typescript
import type { StateHooks } from '@nerdalytics/beacon';

function createTypedHook<T>(): StateHooks<T>['onWrite'] {
  return (prop, oldValue, newValue, target) => {
    // Fully typed implementation
  };
}

const $state = state<MyType>(initial, {
  onWrite: createTypedHook<MyType>()
});
```

### Hook Factory Functions

Type-safe hook factories:

```typescript
function createLogger<T>(prefix: string): StateHooks<T>['onRead'] {
  return (prop, value, target) => {
    console.log(`${prefix} ${String(prop)} = ${value}`);
  };
}

const $state = state({ count: 0 }, {
  onRead: createLogger('[COUNTER]')
});
```

## Performance Considerations

### Hook Overhead

Each hook adds a function call to the operation:

```typescript
// Without hooks: Direct property access
target[prop]

// With hooks: Function call + property access
hooks.onRead?.(prop, value, target);
target[prop]
```

### Optimization Strategies

1. **Pre-check hook existence:**
```typescript
const hasHook = hooks?.onRead != null;
if (hasHook) hooks.onRead!(...);
```

2. **Avoid heavy computation in hooks:**
```typescript
// ❌ Bad - Heavy computation in hook
onWrite: (prop, oldValue, newValue) => {
  const analysis = performExpensiveAnalysis(oldValue, newValue);
  // ...
}

// ✅ Good - Defer heavy computation
onWrite: (prop, oldValue, newValue) => {
  queueMicrotask(() => performExpensiveAnalysis(oldValue, newValue));
}
```

3. **Use specific hooks:**
```typescript
// ❌ Bad - Hook for all properties
onWrite: () => { /* ... */ }

// ✅ Good - Check specific properties
onWrite: (prop) => {
  if (prop === 'important') { /* ... */ }
}
```

## Error Handling

Hooks should handle their own errors to prevent breaking the core library:

```typescript
function safeHook<T>(): StateHooks<T>['onWrite'] {
  return (prop, oldValue, newValue, target) => {
    try {
      // Hook logic
    } catch (error) {
      console.error('Hook error:', error);
      // Don't re-throw - let the operation continue
    }
  };
}
```

## Best Practices

1. **Keep hooks fast** - Avoid heavy computation that could slow down operations
2. **Use arrays for related hooks** - Combine related functionality
3. **Handle errors gracefully** - The compose function provides error isolation
4. **Type your hooks** - Use TypeScript for better development experience
5. **Document hook behavior** - Clearly describe what your custom hooks do
6. **Test hooks independently** - Write unit tests for custom hooks
7. **Hooks can mutate** - Validation hooks often need to revert or modify values
8. **Use async sparingly** - Keep hooks synchronous when possible