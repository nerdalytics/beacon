---
title: Hooks Catalog
description: Built-in hooks for debugging, performance, persistence, validation, and more
---

# Hooks Catalog

All built-in hooks provided by Beacon. Each hook is available as a separate import from `@nerdalytics/beacon/hooks`.

For hook interfaces and type definitions, see the [Hooks API Reference](/hooks-api).

## Debugging hooks

### logRead

Logs property read operations to the console.

```typescript
import { logRead } from '@nerdalytics/beacon/hooks/logRead'
```

```typescript
function logRead<T>(options?: {
  prefix?: string
  logger?: (...args: any[]) => void
  includeStack?: boolean
}): StateHooks<T>['onRead']
```

| Option | Default | Description |
| --- | --- | --- |
| `prefix` | `'[READ]'` | Custom prefix for log messages |
| `logger` | `console.log` | Custom logging function |
| `includeStack` | `false` | Include stack trace |

```typescript
const $state = state(
  { count: 0 },
  {
    onRead: logRead({
      prefix: '[DEBUG]',
      includeStack: true,
    }),
  }
)

const value = $state.count
// "[DEBUG] count = 0"
// Plus stack trace if includeStack is true
```

### logWrite

Logs property write operations to the console.

```typescript
import { logWrite } from '@nerdalytics/beacon/hooks/logWrite'
```

```typescript
function logWrite<T>(options?: {
  prefix?: string
  logger?: (...args: any[]) => void
  includeStack?: boolean
  logUnchanged?: boolean
}): StateHooks<T>['onWrite']
```

| Option | Default | Description |
| --- | --- | --- |
| `prefix` | `'[WRITE]'` | Custom prefix for log messages |
| `logger` | `console.log` | Custom logging function |
| `includeStack` | `false` | Include stack trace |
| `logUnchanged` | `false` | Log even when value doesn't change |

```typescript
const $state = state(
  { name: 'Alice' },
  {
    onWrite: logWrite({
      prefix: '[MUTATION]',
      logUnchanged: true,
    }),
  }
)

$state.name = 'Bob'
// "[MUTATION] name: Alice → Bob"

$state.name = 'Bob' // same value
// "[MUTATION] name: Bob → Bob (unchanged)"
```

### logEffect

Logs effect lifecycle events.

```typescript
import { logEffect } from '@nerdalytics/beacon/hooks/logEffect'
```

```typescript
function logEffect(options?: {
  logRun?: boolean
  logDispose?: boolean
  logDependencies?: boolean
  logTiming?: boolean
}): EffectHooks['onRun'] & EffectHooks['onDispose']
```

| Option | Default | Description |
| --- | --- | --- |
| `logRun` | `true` | Log when effect runs |
| `logDispose` | `true` | Log when effect is disposed |
| `logDependencies` | `false` | Log tracked dependencies |
| `logTiming` | `false` | Log execution time |

```typescript
const dispose = effect(
  () => {
    // effect body
  },
  'myEffect',
  {
    onRun: logEffect({
      logTiming: true,
      logDependencies: true,
    }),
  }
)
// "[EFFECT:myEffect] Running..."
// "[EFFECT:myEffect] Dependencies: ..."
// "[EFFECT:myEffect] Completed in 0.5ms"
```

### logDerive

Logs derive computation and caching.

```typescript
import { logDerive } from '@nerdalytics/beacon/hooks/logDerive'
```

```typescript
function logDerive<T>(options?: {
  logCompute?: boolean
  logCache?: boolean
  logValue?: boolean
  maxValueLength?: number
}): DeriveHooks<T>
```

| Option | Default | Description |
| --- | --- | --- |
| `logCompute` | `true` | Log computations |
| `logCache` | `true` | Log cache hits |
| `logValue` | `false` | Include computed value in logs |
| `maxValueLength` | `100` | Truncate logged values |

```typescript
const $sum = derive(() => a + b, {
  onCompute: logDerive({
    logValue: true,
    maxValueLength: 50,
  }).onCompute,
})
// "[DERIVE] Computing... Result: 15"
// On cache hit: "[DERIVE] Cache hit #3: 15"
```

### trace

Captures and logs stack traces for operations.

```typescript
import { trace } from '@nerdalytics/beacon/hooks/trace'
```

```typescript
function trace<T>(options?: {
  maxDepth?: number
  filter?: (line: string) => boolean
  onTrace?: (stack: string) => void
}): StateHooks<T>['onRead'] | StateHooks<T>['onWrite']
```

| Option | Default | Description |
| --- | --- | --- |
| `maxDepth` | `10` | Maximum stack frames to capture |
| `filter` | exclude node_modules | Filter stack frames |
| `onTrace` | `console.trace` | Custom trace handler |

```typescript
const $state = state(
  { value: 0 },
  {
    onWrite: trace({
      maxDepth: 5,
      filter: (line) => !line.includes('node_modules'),
    }),
  }
)

$state.value = 1
// Logs stack trace showing where the write originated
```

## Performance hooks

### profile

Measures and reports performance metrics.

```typescript
import { profile } from '@nerdalytics/beacon/hooks/profile'
```

```typescript
function profile<T>(options?: {
  name?: string
  warnThreshold?: number
  onSlow?: (duration: number, operation: string) => void
}): StateHooks<T> & EffectHooks & DeriveHooks
```

| Option | Default | Description |
| --- | --- | --- |
| `name` | auto-generated | Profile name for identification |
| `warnThreshold` | `16` | Milliseconds before warning (one frame) |
| `onSlow` | — | Callback for slow operations |

```typescript
const $state = state(
  { data: [] },
  {
    onWrite: profile({
      name: 'DataState',
      warnThreshold: 10,
      onSlow: (ms, op) => {
        console.warn(`Slow ${op}: ${ms}ms`)
      },
    }).onWrite,
  }
)
```

### throttle

Limits the frequency of operations.

```typescript
import { throttle } from '@nerdalytics/beacon/hooks/throttle'
```

```typescript
function throttle<T>(
  ms: number,
  options?: {
    leading?: boolean
    trailing?: boolean
  }
): StateHooks<T>['onWrite']
```

| Option | Default | Description |
| --- | --- | --- |
| `ms` | — | Throttle interval in milliseconds |
| `leading` | `true` | Allow immediate execution |
| `trailing` | `true` | Execute after throttle period |

```typescript
const $search = state(
  { query: '' },
  {
    onWrite: throttle(500, {
      leading: false,
      trailing: true,
    }),
  }
)

// Rapid updates are throttled
$search.query = 'a' // queued
$search.query = 'ab' // replaces queued
$search.query = 'abc' // replaces queued
// After 500ms: executes with 'abc'
```

### debounce

Delays operations until after a period of inactivity.

```typescript
import { debounce } from '@nerdalytics/beacon/hooks/debounce'
```

```typescript
function debounce<T>(
  ms: number,
  options?: {
    maxWait?: number
  }
): StateHooks<T>['onWrite']
```

| Option | Default | Description |
| --- | --- | --- |
| `ms` | — | Debounce delay in milliseconds |
| `maxWait` | — | Maximum time to wait before forcing execution |

```typescript
const $input = state(
  { value: '' },
  {
    onWrite: debounce(300, {
      maxWait: 1000,
    }),
  }
)

// Rapid typing is debounced
$input.value = 'h' // timer starts
$input.value = 'he' // timer resets
$input.value = 'hel' // timer resets
$input.value = 'hell' // timer resets
$input.value = 'hello' // timer resets
// After 300ms of inactivity: executes with 'hello'
// Or after 1000ms total: forces execution
```

## Persistence hooks

### persist

Persists state to storage (localStorage, sessionStorage, etc).

```typescript
import { persist } from '@nerdalytics/beacon/hooks/persist'
```

```typescript
function persist<T>(
  key: string,
  options?: {
    storage?: Storage
    serialize?: (value: T) => string
    deserialize?: (data: string) => T
    debounce?: number
  }
): StateHooks<T>['onWrite']
```

| Option | Default | Description |
| --- | --- | --- |
| `key` | — | Storage key |
| `storage` | `localStorage` | Storage backend |
| `serialize` | `JSON.stringify` | Custom serializer |
| `deserialize` | `JSON.parse` | Custom deserializer |
| `debounce` | `0` | Debounce writes in ms |

```typescript
const $settings = state(
  {
    theme: 'dark',
    language: 'en',
  },
  {
    onWrite: persist('app-settings', {
      storage: sessionStorage,
      debounce: 500,
    }),
  }
)

$settings.theme = 'light' // saved to sessionStorage after 500ms
```

### hydrate

Loads initial state from storage.

```typescript
import { hydrate } from '@nerdalytics/beacon/hooks/hydrate'
```

```typescript
function hydrate<T>(
  key: string,
  options?: {
    storage?: Storage
    deserialize?: (data: string) => Partial<T>
    merge?: (stored: Partial<T>, initial: T) => T
  }
): (initial: T) => T
```

| Option | Default | Description |
| --- | --- | --- |
| `key` | — | Storage key |
| `storage` | `localStorage` | Storage backend |
| `deserialize` | `JSON.parse` | Custom deserializer |
| `merge` | `Object.assign` | Merge strategy |

```typescript
const initial = hydrate('app-settings')({
  theme: 'dark',
  language: 'en',
})

const $settings = state(initial, {
  onWrite: persist('app-settings'),
})
// State is hydrated from storage if available
```

## Validation hooks

### validate

Validates values before they are set.

```typescript
import { validate } from '@nerdalytics/beacon/hooks/validate'
```

```typescript
function validate<T>(
  rules:
    | {
        [K in keyof T]?: (value: T[K]) => boolean | string
      }
    | ((prop: PropertyKey, value: unknown) => boolean | string),
  options?: {
    onError?: (error: ValidationError) => void
    preventDefault?: boolean
  }
): StateHooks<T>['onWrite']
```

| Option | Default | Description |
| --- | --- | --- |
| `rules` | — | Validation rules per property or global validator |
| `onError` | `console.error` | Error handler |
| `preventDefault` | `false` | Prevent invalid writes |

```typescript
const $user = state(
  {
    email: '',
    age: 0,
  },
  {
    onWrite: validate(
      {
        email: (value) => {
          if (!value.includes('@')) {
            return 'Invalid email format'
          }
          return true
        },
        age: (value) => value >= 0 && value <= 120,
      },
      {
        preventDefault: true,
        onError: (error) => {
          console.error(`Validation failed: ${error.message}`)
        },
      }
    ),
  }
)

$user.email = 'invalid' // prevented, logs error
$user.email = 'user@example.com' // allowed
```

### freeze

Prevents modifications to certain properties.

```typescript
import { freeze } from '@nerdalytics/beacon/hooks/freeze'
```

```typescript
function freeze<T>(
  properties: Array<keyof T> | ((prop: PropertyKey) => boolean),
  options?: {
    throwError?: boolean
    onAttempt?: (prop: PropertyKey) => void
  }
): StateHooks<T>['onWrite'] & StateHooks<T>['onDelete']
```

| Option | Default | Description |
| --- | --- | --- |
| `properties` | — | Properties to freeze or predicate function |
| `throwError` | `false` | Throw on modification attempt |
| `onAttempt` | — | Callback for modification attempts |

```typescript
const $config = state(
  {
    id: '123',
    name: 'App',
    version: '1.0.0',
  },
  {
    onWrite: freeze(['id', 'version'], {
      throwError: true,
      onAttempt: (prop) => {
        console.warn(`Attempted to modify frozen property: ${String(prop)}`)
      },
    }),
  }
)

$config.name = 'MyApp' // allowed
$config.id = '456' // throws error
```

## Analytics hooks

### trackMutation

Tracks state mutations for analytics.

```typescript
import { trackMutation } from '@nerdalytics/beacon/hooks/trackMutation'
```

```typescript
function trackMutation<T>(options?: {
  eventName?: string
  tracker?: (event: MutationEvent) => void
  includeValue?: boolean
  includePrevious?: boolean
}): StateHooks<T>['onWrite']
```

| Option | Default | Description |
| --- | --- | --- |
| `eventName` | `'state_mutation'` | Event name for tracking |
| `tracker` | `console.log` | Custom tracking function |
| `includeValue` | `true` | Include new value in event |
| `includePrevious` | `false` | Include old value in event |

```typescript
const $user = state(
  {
    name: 'Alice',
    lastLogin: null,
  },
  {
    onWrite: trackMutation({
      eventName: 'user_update',
      tracker: (event) => {
        analytics.track(event.name, {
          property: event.property,
          timestamp: event.timestamp,
          value: event.value,
        })
      },
      includePrevious: true,
      includeValue: true,
    }),
  }
)
```

### trackAccess

Tracks state access patterns for analytics.

```typescript
import { trackAccess } from '@nerdalytics/beacon/hooks/trackAccess'
```

```typescript
function trackAccess<T>(options?: {
  eventName?: string
  tracker?: (event: AccessEvent) => void
  sampleRate?: number
}): StateHooks<T>['onRead']
```

| Option | Default | Description |
| --- | --- | --- |
| `eventName` | `'state_access'` | Event name for tracking |
| `tracker` | — | Custom tracking function |
| `sampleRate` | `1.0` | Sampling rate 0–1 |

```typescript
const $data = state(
  {
    public: 'info',
    sensitive: 'data',
  },
  {
    onRead: trackAccess({
      eventName: 'data_access',
      sampleRate: 0.1, // track 10% of accesses
      tracker: (event) => {
        if (event.property === 'sensitive') {
          audit.log('Sensitive data accessed', event)
        }
      },
    }),
  }
)
```

## DevTools hooks

### devtools

Integrates with browser DevTools for debugging.

```typescript
import { devtools } from '@nerdalytics/beacon/hooks/devtools'
```

```typescript
function devtools<T>(options?: {
  name?: string
  enable?: boolean
  logDerivations?: boolean
  logEffects?: boolean
  logStateChanges?: boolean
  trace?: boolean
}): StateHooks<T> & EffectHooks & DeriveHooks
```

| Option | Default | Description |
| --- | --- | --- |
| `name` | auto-generated | Instance name in DevTools |
| `enable` | `true` in dev | Enable DevTools integration |
| `logStateChanges` | `true` | Log state changes |
| `logEffects` | `true` | Log effect executions |
| `logDerivations` | `true` | Log derive computations |
| `trace` | `false` | Include stack traces |

```typescript
const $app = state(
  {
    settings: {},
    user: null,
  },
  {
    onRead: devtools({ name: 'AppState' }).onRead,
    onWrite: devtools({ name: 'AppState' }).onWrite,
  }
)

// Creates DevTools panel with:
// - State tree visualization
// - Change history timeline
// - Effect dependency graph
// - Performance metrics
```

## Utility hooks

### Array-based composition

Beacon supports providing hooks as arrays for natural composition. The `compose` utility is internal only — use arrays directly:

```typescript
// Single hook
const $state = state(initial, {
  onWrite: logWrite(),
})

// Multiple hooks (array)
const $state = state(initial, {
  onWrite: [logWrite(), validate(rules), persist('state-key'), trackMutation()],
})

// Mixed usage
const $complex = state(data, {
  onRead: logRead(), // single hook
  onWrite: [validate(rules), persist('key'), notify()], // multiple hooks
})
```

Array hooks execute in order. Each is wrapped in error isolation — if one throws, the rest still run.

### once

Executes a hook only once.

```typescript
import { once } from '@nerdalytics/beacon/hooks/once'
```

```typescript
function once<T extends (...args: any[]) => void>(hook: T): T
```

```typescript
const $state = state(
  { initialized: false },
  {
    onWrite: once((prop, oldValue, newValue) => {
      if (prop === 'initialized' && newValue === true) {
        console.log('State initialized!')
      }
    }),
  }
)

$state.initialized = true // logs
$state.initialized = false
$state.initialized = true // does not log again
```

### filter

Conditionally executes hooks based on a predicate.

```typescript
import { filter } from '@nerdalytics/beacon/hooks/filter'
```

```typescript
function filter<T extends (...args: any[]) => void>(predicate: (...args: Parameters<T>) => boolean, hook: T): T
```

```typescript
const $state = state(
  {
    _private: 'secret',
    public: 'data',
  },
  {
    onRead: filter(
      (prop) => !String(prop).startsWith('_'),
      logRead() // only logs non-private properties
    ),
  }
)

const pub = $state.public // logged
const priv = $state._private // not logged
```

## Creating custom hooks

Follow the same patterns as built-in hooks:

```typescript
import type { StateHooks } from '@nerdalytics/beacon'

export function myCustomHook<T>(config: MyConfig): StateHooks<T>['onWrite'] {
  return (prop, oldValue, newValue, target) => {
    // Your custom logic here
  }
}
```

### Guidelines

1. **Single responsibility** — each hook should do one thing well
2. **Configurable** — provide options for customization
3. **Type-safe** — use TypeScript generics
4. **Error handling** — don't let errors break core functionality
5. **Performance** — keep hooks lightweight and fast
6. **Documentation** — include examples and describe options
7. **Testing** — write unit tests for your hooks

### Publishing custom hooks

Custom hooks can be published as separate packages:

```json
{
  "name": "@myorg/beacon-hooks-custom",
  "peerDependencies": {
    "@nerdalytics/beacon": "^2000.0.0"
  }
}
```

```typescript
import { state } from '@nerdalytics/beacon'
import { myCustomHook } from '@myorg/beacon-hooks-custom'

const $state = state(initial, {
  onWrite: myCustomHook({ /* config */ }),
})
```
