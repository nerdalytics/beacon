# Beacon Hooks Architecture

## Overview

Beacon's Hook Architecture is a powerful extensibility system introduced in Epoch 2 (v2000.0.0) that provides zero-cost instrumentation points throughout the reactive system. Hooks enable debugging, persistence, analytics, and other cross-cutting concerns without impacting production bundle size or runtime performance when not used.

## Core Concepts

### Zero-Cost Abstraction

When no hooks are provided, the overhead is a single falsy check that modern JavaScript engines optimize away:

```typescript
// Without hooks - single falsy check
const hasRead = hooks?.onRead != null;  // false
if (hasRead) hooks.onRead!(...);        // Never executed

// JIT compilers can eliminate this entirely in hot paths
```

### Tree-Shaking

Hooks are distributed as separate modules. If you don't import them, they don't exist in your bundle:

```typescript
// Development: Import hooks for debugging
import { logRead, logWrite } from '@nerdalytics/beacon/hooks';

// Production: No imports = no code in bundle
// Hooks are completely eliminated by bundler
```

### Composability

Multiple hooks can be combined for the same operation using arrays:

```typescript
import { logWrite, persist, validate } from '@nerdalytics/beacon/hooks';

const hooks = {
  onWrite: [
    logWrite(),           // Log changes (runs first)
    validate(rules),      // Validate new values (runs second)
    persist('storage')    // Save to localStorage (runs third)
  ]
};
```

Hooks can be provided as either a single function or an array of functions that execute in order.

## Architecture

### Module Structure

```
@nerdalytics/beacon/
├── src/
│   ├── index.ts              # Core library (state, effect, derive, batch)
│   ├── types.ts              # Hook interfaces
│   └── hooks/
│       ├── index.ts          # Re-exports all hooks
│       ├── compose.ts        # Hook composition utility (internal use only)
│       └── [hook].ts         # Individual hook implementations
└── dist/
    ├── index.js              # Core bundle
    └── hooks/
        └── *.js              # Separate hook bundles
```

### Hook Interfaces

Beacon provides hook interfaces for all major operations:

- **StateHooks**: Intercept state read/write/delete operations
- **EffectHooks**: Monitor effect lifecycle and dependencies
- **DeriveHooks**: Track computed value calculations
- **BatchHooks**: Observe batch operation boundaries

See [HOOKS_API.md](./HOOKS_API.md) for complete interface documentation.

## Usage

### Basic Example

```typescript
import { state } from '@nerdalytics/beacon';
import { logRead, logWrite } from '@nerdalytics/beacon/hooks';

// Development: Add logging hooks
const $user = state({ name: 'Alice', age: 30 }, {
  onRead: logRead(),
  onWrite: logWrite()
});

$user.name = 'Bob';  // Logs: [WRITE] name: Alice → Bob
console.log($user.age);  // Logs: [READ] age = 30
```

### Nested Objects

Hooks automatically propagate to nested objects accessed through the reactive proxy:

```typescript
const $store = state({
  user: {
    name: 'Alice',
    settings: {
      theme: 'dark',
      notifications: true
    }
  },
  items: [1, 2, 3]
}, {
  onWrite: (prop, oldValue, newValue) => {
    console.log(`[${String(prop)}]: ${oldValue} → ${newValue}`);
  }
});

// Hooks apply to all nested properties automatically
$store.user.name = 'Bob';                    // Logs: "[name]: Alice → Bob"
$store.user.settings.theme = 'light';        // Logs: "[theme]: dark → light"
$store.user.settings.notifications = false;  // Logs: "[notifications]: true → false"
$store.items.push(4);                        // Logs array mutation
```

### Production Build

```typescript
import { state } from '@nerdalytics/beacon';

// No hooks imported = zero overhead
const $user = state({ name: 'Alice', age: 30 });

$user.name = 'Bob';  // No logging, no overhead
```

### Advanced Patterns

#### Conditional Hooks

```typescript
// Load hooks based on environment or feature flags
const hooks = process.env.NODE_ENV === 'development'
  ? { onWrite: (await import('@nerdalytics/beacon/hooks')).logWrite() }
  : undefined;

const $state = state(initial, hooks);
```

#### Custom Hooks

```typescript
// Create your own hooks
function myCustomHook<T>(): StateHooks<T>['onWrite'] {
  return (prop, oldValue, newValue, target) => {
    analytics.track('state_change', {
      prop: String(prop),
      oldValue,
      newValue
    });
  };
}

const $state = state(initial, {
  onWrite: myCustomHook()
});
```

#### Multiple Hooks (Array-Based)

```typescript
// Use arrays to combine multiple hooks
const $state = state(initial, {
  onWrite: [
    logWrite('[DEBUG]'),        // Runs first
    persist('app-state'),       // Runs second
    trackMutation('state_change') // Runs third
  ]
});

// Mix single and array hooks
const $user = state(userData, {
  onRead: logRead(),           // Single hook
  onWrite: [                   // Multiple hooks
    validate(rules),
    persist('user'),
    notifyChange()
  ]
});
```

## Performance Characteristics

### Without Hooks

- **Check Overhead**: ~0.5ns per operation (single falsy check)
- **Memory**: No additional allocations
- **Bundle Size**: 0 bytes (hooks not imported)

### With Hooks

- **Call Overhead**: Depends on hook implementation
- **Memory**: Depends on hook implementation
- **Bundle Size**: Only imported hooks included

### Optimization Tips

1. **Pre-check hooks once**: Store boolean flags to avoid repeated optional chaining
2. **Use arrays efficiently**: Each hook in the array adds a function call
3. **Lazy load in production**: Use dynamic imports for production debugging
4. **Avoid heavy computation**: Keep hooks lightweight and fast

## Migration from __DEV__

The early Epoch 2 implementation used `__DEV__` checks:

```typescript
// Old approach with __DEV__
if (__DEV__) {
  console.debug('[beacon][read]', prop, target);
}
```

The Hook Architecture replaces this with:

```typescript
// New approach with hooks
import { logRead } from '@nerdalytics/beacon/hooks';

const $state = state(initial, {
  onRead: logRead()
});
```

Benefits of migration:
- No debug code in production bundles
- Extensible beyond just logging
- Cleaner core implementation
- Better tree-shaking

## Available Hooks

Beacon provides a comprehensive set of built-in hooks:

### Debugging Hooks
- `logRead` - Log property reads
- `logWrite` - Log property writes
- `logEffect` - Log effect execution
- `logDerive` - Log derive computation
- `trace` - Capture stack traces

### Performance Hooks
- `profile` - Measure operation timing
- `throttle` - Limit update frequency
- `debounce` - Delay updates

### Persistence Hooks
- `persist` - Sync with localStorage
- `validate` - Validate and optionally mutate values

### Integration Hooks
- `devtools` - Browser DevTools integration
- `trackMutation` - Analytics tracking

See [HOOKS_CATALOG.md](./HOOKS_CATALOG.md) for detailed documentation of each hook.

## Best Practices

### 1. Import Only What You Need

```typescript
// ✅ Good - Specific imports
import { logWrite } from '@nerdalytics/beacon/hooks';

// ❌ Avoid - Importing everything
import * as hooks from '@nerdalytics/beacon/hooks';
```

### 2. Use Arrays for Multiple Hooks

```typescript
// ✅ Good - Use arrays for multiple related hooks
const $state = state(initial, {
  onRead: [logRead(), trace(), profile()]
});

// ✅ Good - Single hook when only one is needed
const $simple = state(data, {
  onWrite: persist('key')
});

// ❌ Avoid - Creating fake hook properties
const $state = state(initial, {
  onRead: logRead(),
  onReadTrace: trace(),  // Not a real API
  onReadProfile: profile()  // Not a real API
});
```

### 3. Keep Hooks Simple

```typescript
// ✅ Good - Simple, focused hook
function logWrite<T>(): StateHooks<T>['onWrite'] {
  return (prop, oldValue, newValue) => {
    console.log(`${String(prop)}: ${oldValue} → ${newValue}`);
  };
}

// ❌ Avoid - Complex logic in hooks
function complexHook<T>(): StateHooks<T>['onWrite'] {
  return async (prop, oldValue, newValue) => {
    await fetch('/api/log', { method: 'POST', body: JSON.stringify({ prop, oldValue, newValue }) });
    localStorage.setItem('lastChange', JSON.stringify({ prop, newValue }));
    // Too much happening
  };
}
```

### 4. Conditional Loading for Production

```typescript
// ✅ Good - Conditional loading
const hooks = isDevelopment
  ? { onWrite: logWrite() }
  : undefined;

// ✅ Also good - Dynamic import
if (needsDebugging) {
  const { logWrite } = await import('@nerdalytics/beacon/hooks');
  // Apply to new states
}
```

## Future Considerations

The Hook Architecture is designed to be extensible. Potential future enhancements:

1. **Async Hooks**: Support for asynchronous operations
2. **Hook Context**: Pass additional context to hooks (stack trace, timestamp)
3. **Hook Middleware**: Transform values in hooks
4. **Global Hooks**: Apply hooks to all states/effects
5. **Hook Priorities**: Control execution order in composition

## Summary

The Hook Architecture transforms Beacon into an extensible platform while maintaining its core principle of simplicity. By moving all instrumentation to optional modules, we achieve:

- **Zero overhead** when not used
- **Full extensibility** for any use case
- **Clean separation** of concerns
- **Better tree-shaking** and smaller bundles
- **Type-safe** instrumentation

This architecture represents a significant improvement over the initial `__DEV__` approach and positions Beacon for future growth and community contributions.
