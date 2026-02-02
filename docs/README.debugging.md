# Debugging

## Overview

Beacon provides built-in debugging capabilities to help trace reactive state updates, effect execution, and diagnose issues like infinite loops. Debugging is controlled through environment variables and provides detailed logging without affecting production performance.

## Enabling Debug Mode

Debug mode is controlled by two environment variables:

1. **NODE_ENV**: When set to `production`, debugging is disabled by default
2. **BEACON_DEBUG**: Can override NODE_ENV to force debugging on or off

```bash
# Enable debugging (default)
node app.js

# Disable debugging in production
NODE_ENV=production node app.js

# Explicitly enable debugging
BEACON_DEBUG=true node app.js

# Force debugging even in production
NODE_ENV=production BEACON_DEBUG=true node app.js
```

## Debug Features

### 1. Named Effects

Effects can be given optional names for better debugging:

```typescript
import { state, effect } from '@nerdalytics/beacon';

const counter = state({ count: 0 });

// Named effect for better debugging
const dispose = effect(() => {
  console.log(`Count: ${counter.count}`);
}, 'CountLogger');

// Anonymous effect (no name)
effect(() => {
  document.title = `Count: ${counter.count}`;
});
```

With `BEACON_DEBUG=true`, named effects log their lifecycle:

```
[beacon][effect:CountLogger] Running
[beacon][effect:CountLogger] Disposing
```

### 2. Read/Write Logging

When debugging is enabled, all state reads and writes are logged:

```typescript
const user = state({ name: 'Alice', age: 30 });

user.name = 'Bob';  // Logs: [beacon][write] name Bob { name: 'Alice', age: 30 }
console.log(user.age);  // Logs: [beacon][read] age { name: 'Bob', age: 30 }
```

### 3. Enhanced Error Messages

Infinite loop detection includes effect names when available:

```typescript
const data = state({ value: 0 });

// This will throw an error with the effect name
effect(() => {
  const val = data.value;
  data.value = val + 1;  // Error: Infinite loop detected: effect "IncrementEffect" cannot update property "value" it depends on
}, 'IncrementEffect');
```

## Debug Functions

Beacon uses three internal debug functions that are no-ops in production:

- **devLogRead**: Logs property reads from reactive state
- **devLogWrite**: Logs property writes to reactive state
- **devAssert**: Throws errors with enhanced messages in debug mode

These functions have zero overhead in production builds when `NODE_ENV=production` and `BEACON_DEBUG` is not set.

## Common Debugging Scenarios

### Tracking Unexpected Updates

```typescript
const state1 = state({ value: 0 });
const state2 = state({ value: 0 });

effect(() => {
  console.log('Effect running');
  console.log(state1.value + state2.value);
}, 'SumEffect');

// With BEACON_DEBUG=true, you'll see:
// [beacon][effect:SumEffect] Running
// [beacon][read] value { value: 0 }
// [beacon][read] value { value: 0 }

state1.value = 5;
// [beacon][write] value 5 { value: 0 }
// [beacon][effect:SumEffect] Running
// [beacon][read] value { value: 5 }
// [beacon][read] value { value: 0 }
```

### Debugging Batch Operations

```typescript
batch(() => {
  user.firstName = 'Jane';
  user.lastName = 'Doe';
  user.age = 31;
});

// With debugging, you'll see all writes but effect only runs once:
// [beacon][write] firstName Jane { firstName: 'John', lastName: 'Smith', age: 30 }
// [beacon][write] lastName Doe { firstName: 'Jane', lastName: 'Smith', age: 30 }
// [beacon][write] age 31 { firstName: 'Jane', lastName: 'Doe', age: 30 }
// [beacon][effect:UserDisplay] Running  // Only runs once after batch
```

### Tracking Effect Lifecycle

Named effects help you understand when effects are created and cleaned up:

```typescript
// Beacon automatically cleans up effects when:
// 1. The state object is garbage collected (via WeakMaps)
// 2. Parent effects re-run (child effects are auto-disposed)
// 3. You explicitly call dispose()

// Example: Effects on global/long-lived state
const globalState = state({ value: 0 });

function setupFeature() {
  // This effect persists as long as globalState exists
  const dispose = effect(() => {
    console.log(globalState.value);
  }, 'FeatureEffect');

  // With debugging, you'll see:
  // [beacon][effect:FeatureEffect] Running

  // For global state, explicit disposal may be needed:
  return dispose; // Caller can dispose when feature is disabled
}

// The debug output helps verify cleanup:
// [beacon][effect:FeatureEffect] Disposing
```

## Performance Considerations

1. **Production Zero-Cost**: When `NODE_ENV=production` and `BEACON_DEBUG` is not set, all debug code becomes no-ops with no runtime overhead
2. **Development Logging**: Debug logging can be verbose and impact performance in development
3. **Named Effects**: Effect names are stored as properties on the effect function itself, minimal memory overhead

## Best Practices

### 1. Name Critical Effects

```typescript
// Good - named effects for important logic
effect(() => {
  saveToLocalStorage(appState);
}, 'LocalStoragePersistence');

effect(() => {
  syncWithServer(userData);
}, 'ServerSync');

// OK - anonymous for simple UI updates
effect(() => {
  element.textContent = counter.count;
});
```

### 2. Use Debug Mode During Development

```json
// package.json
{
  "scripts": {
    "dev": "BEACON_DEBUG=true node app.js",
    "start": "NODE_ENV=production node app.js"
  }
}
```

### 3. Disable in Tests When Not Needed

```typescript
// test-setup.js
process.env.BEACON_DEBUG = 'false';  // Disable debug output in tests

// Or selectively enable for specific tests
test('debug infinite loop', () => {
  process.env.BEACON_DEBUG = 'true';
  // Test code that needs debugging
});
```

## Troubleshooting

### Debug Output Not Showing

1. Check environment variables: `echo $NODE_ENV $BEACON_DEBUG`
2. Ensure you're using the development build
3. Verify console.debug is not filtered in your console

### Too Much Debug Output

1. Disable for specific modules by wrapping in a function:

```typescript
function withoutDebug<T>(fn: () => T): T {
  const prev = process.env.BEACON_DEBUG;
  process.env.BEACON_DEBUG = 'false';
  try {
    return fn();
  } finally {
    process.env.BEACON_DEBUG = prev;
  }
}
```

### Effect Names Not Showing

Ensure you're passing the name as the second parameter to `effect()`:

```typescript
// Correct
effect(() => { /* ... */ }, 'MyEffect');

// Incorrect - name must be second parameter
effect('MyEffect', () => { /* ... */ });  // Wrong parameter order
```

## Future Enhancements

Potential future debugging features:

1. **Dependency Graph Visualization**: Export effect dependency graphs
2. **Performance Profiling**: Track effect execution times
3. **State History**: Record state changes over time
4. **Selective Debugging**: Debug only specific effects or state objects
5. **Debug Hooks**: Custom callbacks for debugging events

These would be implemented as separate opt-in modules to maintain zero overhead in production.
