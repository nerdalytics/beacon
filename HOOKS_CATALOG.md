# Beacon Hooks Catalog

## Overview

This catalog documents all built-in hooks provided by Beacon. Each hook is available as a separate import from `@nerdalytics/beacon/hooks`.

## Table of Contents

- [Debugging Hooks](#debugging-hooks)
  - [logRead](#logread)
  - [logWrite](#logwrite)
  - [logEffect](#logeffect)
  - [logDerive](#logderive)
  - [trace](#trace)
- [Performance Hooks](#performance-hooks)
  - [profile](#profile)
  - [throttle](#throttle)
  - [debounce](#debounce)
- [Persistence Hooks](#persistence-hooks)
  - [persist](#persist)
  - [hydrate](#hydrate)
- [Validation Hooks](#validation-hooks)
  - [validate](#validate)
  - [freeze](#freeze)
- [Analytics Hooks](#analytics-hooks)
  - [trackMutation](#trackmutation)
  - [trackAccess](#trackaccess)
- [DevTools Hooks](#devtools-hooks)
  - [devtools](#devtools)
- [Utility Hooks](#utility-hooks)
  - [compose](#compose)
  - [once](#once)
  - [filter](#filter)

---

## Debugging Hooks

### logRead

Logs property read operations to the console.

**Import:**
```typescript
import { logRead } from '@nerdalytics/beacon/hooks/logRead';
```

**Signature:**
```typescript
function logRead<T>(
  options?: {
    prefix?: string;
    logger?: (...args: any[]) => void;
    includeStack?: boolean;
  }
): StateHooks<T>['onRead']
```

**Options:**
- `prefix` - Custom prefix for log messages (default: `'[READ]'`)
- `logger` - Custom logging function (default: `console.log`)
- `includeStack` - Include stack trace (default: `false`)

**Example:**
```typescript
const $state = state({ count: 0 }, {
  onRead: logRead({ 
    prefix: '[DEBUG]',
    includeStack: true 
  })
});

const value = $state.count;
// Logs: "[DEBUG] count = 0"
// Plus stack trace if includeStack is true
```

---

### logWrite

Logs property write operations to the console.

**Import:**
```typescript
import { logWrite } from '@nerdalytics/beacon/hooks/logWrite';
```

**Signature:**
```typescript
function logWrite<T>(
  options?: {
    prefix?: string;
    logger?: (...args: any[]) => void;
    includeStack?: boolean;
    logUnchanged?: boolean;
  }
): StateHooks<T>['onWrite']
```

**Options:**
- `prefix` - Custom prefix for log messages (default: `'[WRITE]'`)
- `logger` - Custom logging function (default: `console.log`)
- `includeStack` - Include stack trace (default: `false`)
- `logUnchanged` - Log even when value doesn't change (default: `false`)

**Example:**
```typescript
const $state = state({ name: 'Alice' }, {
  onWrite: logWrite({ 
    prefix: '[MUTATION]',
    logUnchanged: true 
  })
});

$state.name = 'Bob';
// Logs: "[MUTATION] name: Alice → Bob"

$state.name = 'Bob';  // Same value
// Logs: "[MUTATION] name: Bob → Bob (unchanged)"
```

---

### logEffect

Logs effect lifecycle events.

**Import:**
```typescript
import { logEffect } from '@nerdalytics/beacon/hooks/logEffect';
```

**Signature:**
```typescript
function logEffect(
  options?: {
    logRun?: boolean;
    logDispose?: boolean;
    logDependencies?: boolean;
    logTiming?: boolean;
  }
): EffectHooks['onRun'] & EffectHooks['onDispose']
```

**Options:**
- `logRun` - Log when effect runs (default: `true`)
- `logDispose` - Log when effect is disposed (default: `true`)
- `logDependencies` - Log tracked dependencies (default: `false`)
- `logTiming` - Log execution time (default: `false`)

**Example:**
```typescript
const dispose = effect(() => {
  // Effect body
}, 'myEffect', {
  onRun: logEffect({ 
    logTiming: true,
    logDependencies: true 
  })
});
// Logs: "[EFFECT:myEffect] Running..."
// Logs: "[EFFECT:myEffect] Dependencies: ..."
// Logs: "[EFFECT:myEffect] Completed in 0.5ms"
```

---

### logDerive

Logs derive computation and caching.

**Import:**
```typescript
import { logDerive } from '@nerdalytics/beacon/hooks/logDerive';
```

**Signature:**
```typescript
function logDerive<T>(
  options?: {
    logCompute?: boolean;
    logCache?: boolean;
    logValue?: boolean;
    maxValueLength?: number;
  }
): DeriveHooks<T>
```

**Options:**
- `logCompute` - Log computations (default: `true`)
- `logCache` - Log cache hits (default: `true`)
- `logValue` - Include computed value in logs (default: `false`)
- `maxValueLength` - Truncate logged values (default: `100`)

**Example:**
```typescript
const $sum = derive(() => a + b, {
  onCompute: logDerive({ 
    logValue: true,
    maxValueLength: 50 
  }).onCompute
});
// Logs: "[DERIVE] Computing... Result: 15"
// On cache hit: "[DERIVE] Cache hit #3: 15"
```

---

### trace

Captures and logs stack traces for operations.

**Import:**
```typescript
import { trace } from '@nerdalytics/beacon/hooks/trace';
```

**Signature:**
```typescript
function trace<T>(
  options?: {
    maxDepth?: number;
    filter?: (line: string) => boolean;
    onTrace?: (stack: string) => void;
  }
): StateHooks<T>['onRead'] | StateHooks<T>['onWrite']
```

**Options:**
- `maxDepth` - Maximum stack frames to capture (default: `10`)
- `filter` - Filter stack frames (default: exclude node_modules)
- `onTrace` - Custom trace handler (default: console.trace)

**Example:**
```typescript
const $state = state({ value: 0 }, {
  onWrite: trace({ 
    maxDepth: 5,
    filter: (line) => !line.includes('node_modules')
  })
});

$state.value = 1;
// Logs stack trace showing where the write originated
```

---

## Performance Hooks

### profile

Measures and reports performance metrics.

**Import:**
```typescript
import { profile } from '@nerdalytics/beacon/hooks/profile';
```

**Signature:**
```typescript
function profile<T>(
  options?: {
    name?: string;
    warnThreshold?: number;
    onSlow?: (duration: number, operation: string) => void;
  }
): StateHooks<T> & EffectHooks & DeriveHooks
```

**Options:**
- `name` - Profile name for identification (default: auto-generated)
- `warnThreshold` - Milliseconds before warning (default: `16` - one frame)
- `onSlow` - Callback for slow operations

**Example:**
```typescript
const $state = state({ data: [] }, {
  onWrite: profile({ 
    name: 'DataState',
    warnThreshold: 10,
    onSlow: (ms, op) => {
      console.warn(`Slow ${op}: ${ms}ms`);
      // Could send to monitoring service
    }
  }).onWrite
});
```

---

### throttle

Limits the frequency of operations.

**Import:**
```typescript
import { throttle } from '@nerdalytics/beacon/hooks/throttle';
```

**Signature:**
```typescript
function throttle<T>(
  ms: number,
  options?: {
    leading?: boolean;
    trailing?: boolean;
  }
): StateHooks<T>['onWrite']
```

**Options:**
- `ms` - Throttle interval in milliseconds
- `leading` - Allow immediate execution (default: `true`)
- `trailing` - Execute after throttle period (default: `true`)

**Example:**
```typescript
const $search = state({ query: '' }, {
  onWrite: throttle(500, { 
    leading: false,
    trailing: true 
  })
});

// Rapid updates are throttled
$search.query = 'a';     // Queued
$search.query = 'ab';    // Replaces queued
$search.query = 'abc';   // Replaces queued
// After 500ms: Executes with 'abc'
```

---

### debounce

Delays operations until after a period of inactivity.

**Import:**
```typescript
import { debounce } from '@nerdalytics/beacon/hooks/debounce';
```

**Signature:**
```typescript
function debounce<T>(
  ms: number,
  options?: {
    maxWait?: number;
  }
): StateHooks<T>['onWrite']
```

**Options:**
- `ms` - Debounce delay in milliseconds
- `maxWait` - Maximum time to wait before forcing execution

**Example:**
```typescript
const $input = state({ value: '' }, {
  onWrite: debounce(300, { 
    maxWait: 1000 
  })
});

// Rapid typing is debounced
$input.value = 'h';      // Timer starts
$input.value = 'he';     // Timer resets
$input.value = 'hel';    // Timer resets
$input.value = 'hell';   // Timer resets
$input.value = 'hello';  // Timer resets
// After 300ms of inactivity: Executes with 'hello'
// Or after 1000ms total: Forces execution
```

---

## Persistence Hooks

### persist

Persists state to storage (localStorage, sessionStorage, etc).

**Import:**
```typescript
import { persist } from '@nerdalytics/beacon/hooks/persist';
```

**Signature:**
```typescript
function persist<T>(
  key: string,
  options?: {
    storage?: Storage;
    serialize?: (value: T) => string;
    deserialize?: (data: string) => T;
    debounce?: number;
  }
): StateHooks<T>['onWrite']
```

**Options:**
- `key` - Storage key
- `storage` - Storage backend (default: `localStorage`)
- `serialize` - Custom serializer (default: `JSON.stringify`)
- `deserialize` - Custom deserializer (default: `JSON.parse`)
- `debounce` - Debounce writes in ms (default: `0`)

**Example:**
```typescript
const $settings = state({ 
  theme: 'dark',
  language: 'en' 
}, {
  onWrite: persist('app-settings', {
    storage: sessionStorage,
    debounce: 500
  })
});

$settings.theme = 'light';  // Saved to sessionStorage after 500ms
```

---

### hydrate

Loads initial state from storage.

**Import:**
```typescript
import { hydrate } from '@nerdalytics/beacon/hooks/hydrate';
```

**Signature:**
```typescript
function hydrate<T>(
  key: string,
  options?: {
    storage?: Storage;
    deserialize?: (data: string) => Partial<T>;
    merge?: (stored: Partial<T>, initial: T) => T;
  }
): (initial: T) => T
```

**Options:**
- `key` - Storage key
- `storage` - Storage backend (default: `localStorage`)
- `deserialize` - Custom deserializer (default: `JSON.parse`)
- `merge` - Merge strategy (default: `Object.assign`)

**Example:**
```typescript
const initial = hydrate('app-settings')({
  theme: 'dark',
  language: 'en'
});

const $settings = state(initial, {
  onWrite: persist('app-settings')
});
// State is hydrated from storage if available
```

---

## Validation Hooks

### validate

Validates values before they are set.

**Import:**
```typescript
import { validate } from '@nerdalytics/beacon/hooks/validate';
```

**Signature:**
```typescript
function validate<T>(
  rules: {
    [K in keyof T]?: (value: T[K]) => boolean | string;
  } | ((prop: PropertyKey, value: unknown) => boolean | string),
  options?: {
    onError?: (error: ValidationError) => void;
    preventDefault?: boolean;
  }
): StateHooks<T>['onWrite']
```

**Options:**
- `rules` - Validation rules per property or global validator
- `onError` - Error handler (default: console.error)
- `preventDefault` - Prevent invalid writes (default: `false`)

**Example:**
```typescript
const $user = state({ 
  email: '',
  age: 0 
}, {
  onWrite: validate({
    email: (value) => {
      if (!value.includes('@')) {
        return 'Invalid email format';
      }
      return true;
    },
    age: (value) => value >= 0 && value <= 120
  }, {
    preventDefault: true,
    onError: (error) => {
      console.error(`Validation failed: ${error.message}`);
    }
  })
});

$user.email = 'invalid';  // Prevented, logs error
$user.email = 'user@example.com';  // Allowed
```

---

### freeze

Prevents modifications to certain properties.

**Import:**
```typescript
import { freeze } from '@nerdalytics/beacon/hooks/freeze';
```

**Signature:**
```typescript
function freeze<T>(
  properties: Array<keyof T> | ((prop: PropertyKey) => boolean),
  options?: {
    throwError?: boolean;
    onAttempt?: (prop: PropertyKey) => void;
  }
): StateHooks<T>['onWrite'] & StateHooks<T>['onDelete']
```

**Options:**
- `properties` - Properties to freeze or predicate function
- `throwError` - Throw on modification attempt (default: `false`)
- `onAttempt` - Callback for modification attempts

**Example:**
```typescript
const $config = state({ 
  id: '123',
  name: 'App',
  version: '1.0.0'
}, {
  onWrite: freeze(['id', 'version'], {
    throwError: true,
    onAttempt: (prop) => {
      console.warn(`Attempted to modify frozen property: ${String(prop)}`);
    }
  })
});

$config.name = 'MyApp';  // Allowed
$config.id = '456';  // Throws error
```

---

## Analytics Hooks

### trackMutation

Tracks state mutations for analytics.

**Import:**
```typescript
import { trackMutation } from '@nerdalytics/beacon/hooks/trackMutation';
```

**Signature:**
```typescript
function trackMutation<T>(
  options?: {
    eventName?: string;
    tracker?: (event: MutationEvent) => void;
    includeValue?: boolean;
    includePrevious?: boolean;
  }
): StateHooks<T>['onWrite']
```

**Options:**
- `eventName` - Event name for tracking (default: `'state_mutation'`)
- `tracker` - Custom tracking function (default: console.log)
- `includeValue` - Include new value in event (default: `true`)
- `includePrevious` - Include old value in event (default: `false`)

**Example:**
```typescript
const $user = state({ 
  name: 'Alice',
  lastLogin: null 
}, {
  onWrite: trackMutation({
    eventName: 'user_update',
    tracker: (event) => {
      analytics.track(event.name, {
        property: event.property,
        value: event.value,
        timestamp: event.timestamp
      });
    },
    includeValue: true,
    includePrevious: true
  })
});
```

---

### trackAccess

Tracks state access patterns for analytics.

**Import:**
```typescript
import { trackAccess } from '@nerdalytics/beacon/hooks/trackAccess';
```

**Signature:**
```typescript
function trackAccess<T>(
  options?: {
    eventName?: string;
    tracker?: (event: AccessEvent) => void;
    sampleRate?: number;
  }
): StateHooks<T>['onRead']
```

**Options:**
- `eventName` - Event name for tracking (default: `'state_access'`)
- `tracker` - Custom tracking function
- `sampleRate` - Sampling rate 0-1 (default: `1.0`)

**Example:**
```typescript
const $data = state({ 
  sensitive: 'data',
  public: 'info'
}, {
  onRead: trackAccess({
    eventName: 'data_access',
    sampleRate: 0.1,  // Track 10% of accesses
    tracker: (event) => {
      if (event.property === 'sensitive') {
        audit.log('Sensitive data accessed', event);
      }
    }
  })
});
```

---

## DevTools Hooks

### devtools

Integrates with browser DevTools for debugging.

**Import:**
```typescript
import { devtools } from '@nerdalytics/beacon/hooks/devtools';
```

**Signature:**
```typescript
function devtools<T>(
  options?: {
    name?: string;
    enable?: boolean;
    logStateChanges?: boolean;
    logEffects?: boolean;
    logDerivations?: boolean;
    trace?: boolean;
  }
): StateHooks<T> & EffectHooks & DeriveHooks
```

**Options:**
- `name` - Instance name in DevTools (default: auto-generated)
- `enable` - Enable DevTools integration (default: `true` in dev)
- `logStateChanges` - Log state changes (default: `true`)
- `logEffects` - Log effect executions (default: `true`)
- `logDerivations` - Log derive computations (default: `true`)
- `trace` - Include stack traces (default: `false`)

**Example:**
```typescript
const $app = state({ 
  user: null,
  settings: {}
}, {
  onRead: devtools({ name: 'AppState' }).onRead,
  onWrite: devtools({ name: 'AppState' }).onWrite
});

// Creates DevTools panel with:
// - State tree visualization
// - Change history timeline
// - Effect dependency graph
// - Performance metrics
```

---

## Utility Hooks

### Array-Based Hook Composition

Beacon supports providing hooks as arrays for natural composition without a compose utility:

**Single Hook:**
```typescript
const $state = state(initial, {
  onWrite: logWrite()  // Single hook directly
});
```

**Multiple Hooks (Array):**
```typescript
const $state = state(initial, {
  onWrite: [
    logWrite(),         // Runs first
    validate(rules),    // Runs second
    persist('state-key'), // Runs third
    trackMutation()     // Runs fourth
  ]
});
// Array hooks execute in order
```

**Mixed Usage:**
```typescript
const $complex = state(data, {
  onRead: logRead(),           // Single hook
  onWrite: [                   // Multiple hooks
    validate(rules),
    persist('key'),
    notify()
  ]
});
```

**Note:** The `compose` utility is for internal use only. Users should use arrays for combining hooks.

---

### once

Executes a hook only once.

**Import:**
```typescript
import { once } from '@nerdalytics/beacon/hooks/once';
```

**Signature:**
```typescript
function once<T extends (...args: any[]) => void>(
  hook: T
): T
```

**Example:**
```typescript
const $state = state({ initialized: false }, {
  onWrite: once((prop, oldValue, newValue) => {
    if (prop === 'initialized' && newValue === true) {
      console.log('State initialized!');
      // This only runs once
    }
  })
});

$state.initialized = true;  // Logs
$state.initialized = false;
$state.initialized = true;  // Doesn't log again
```

---

### filter

Conditionally executes hooks based on a predicate.

**Import:**
```typescript
import { filter } from '@nerdalytics/beacon/hooks/filter';
```

**Signature:**
```typescript
function filter<T extends (...args: any[]) => void>(
  predicate: (...args: Parameters<T>) => boolean,
  hook: T
): T
```

**Example:**
```typescript
const $state = state({ 
  public: 'data',
  _private: 'secret'
}, {
  onRead: filter(
    (prop) => !String(prop).startsWith('_'),
    logRead()  // Only logs non-private properties
  )
});

const pub = $state.public;    // Logged
const priv = $state._private; // Not logged
```

---

## Creating Custom Hooks

You can create your own hooks following the same patterns:

```typescript
import type { StateHooks } from '@nerdalytics/beacon';

export function myCustomHook<T>(
  config: MyConfig
): StateHooks<T>['onWrite'] {
  return (prop, oldValue, newValue, target) => {
    // Your custom logic here
    
    // Best practices:
    // 1. Handle errors gracefully
    // 2. Keep operations fast
    // 3. Avoid side effects that could break reactivity
    // 4. Document behavior clearly
  };
}
```

### Hook Development Guidelines

1. **Single Responsibility** - Each hook should do one thing well
2. **Configurable** - Provide options for customization
3. **Type-Safe** - Use TypeScript generics and types
4. **Error Handling** - Don't let errors break core functionality
5. **Performance** - Keep hooks lightweight and fast
6. **Documentation** - Include examples and options
7. **Testing** - Write unit tests for your hooks

### Publishing Custom Hooks

Custom hooks can be published as separate packages:

```json
{
  "name": "@myorg/beacon-hooks-custom",
  "peerDependencies": {
    "@nerdalytics/beacon": "^2000.0.0"
  }
}
```

Users can then install and use your custom hooks:

```typescript
import { state } from '@nerdalytics/beacon';
import { myCustomHook } from '@myorg/beacon-hooks-custom';

const $state = state(initial, {
  onWrite: myCustomHook({ /* config */ })
});
```