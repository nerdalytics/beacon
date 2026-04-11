---
title: Effects
description: Write side effects that auto-run when their dependencies change
---


`effect()` creates reactive functions that re-run automatically when their dependencies change. Effects bridge reactive state to side effects — logging, network requests, DOM updates, and so on.

## API

```typescript
function effect(fn: EffectCallback, name?: EffectName, hooks?: EffectHooks): Unsubscribe

type EffectCallback = () => void
type EffectName = string
type Unsubscribe = () => void
```

Returns a dispose function. Call it to stop the effect and clean up all subscriptions. See [Hooks](/v2000.0.0/hooks-overview) for the optional hooks parameter.

## Basic usage

```typescript
import { state, effect } from '@nerdalytics/beacon'

const $counter = state({ count: 0 })

// Runs immediately to establish dependencies
const dispose = effect(() => {
  console.log(`Count is: ${$counter.count}`)
})
// Logs: "Count is: 0"

$counter.count++ // Logs: "Count is: 1"
$counter.count++ // Logs: "Count is: 2"

// Clean up when done
dispose()
$counter.count++ // No log (effect disposed)
```

## Automatic dependency tracking

Effects detect which reactive values they access during execution:

```typescript
const $user = state({ name: 'Alice', age: 30, role: 'admin' })

effect(() => {
  // Only tracks 'name' and 'age', not 'role'
  console.log(`${$user.name} is ${$user.age} years old`)
})

$user.name = 'Bob' // Triggers effect
$user.age = 31 // Triggers effect
$user.role = 'user' // Does NOT trigger effect
```

## How it works

1. **Initial run**: Effect runs immediately when created
2. **Dependency tracking**: During execution, any reactive property access is recorded
3. **Subscription**: Effect subscribes to all accessed properties
4. **Re-execution**: When dependencies change, the effect is queued for re-run
5. **Cleanup**: Old dependencies are cleaned up before each new run

```
Create Effect -> Set as Current -> Run Function -> Track Deps -> Wait for Changes
                                       ^                              |
                                       |<---- Dependency Changed <----|
```

### Nested effects

Effects can create other effects. They form a parent-child relationship:

```typescript
const $config = state({ enabled: true, value: 0 })
const $data = state({ multiplier: 2 })

effect(() => {
  console.log('Outer: config.enabled =', $config.enabled)

  if ($config.enabled) {
    effect(() => {
      console.log('Inner: result =', $config.value * $data.multiplier)
    })
  }
})

// Initial output:
// Outer: config.enabled = true
// Inner: result = 0

$data.multiplier = 3
// Inner: result = 0

$config.enabled = false
// Outer: config.enabled = false
// (inner effect is disposed when outer re-runs)

$data.multiplier = 10
// No output (inner effect was disposed)
```

When a parent is disposed, all children are cleaned up automatically.

## Infinite loop prevention

Beacon prevents effects from writing to state they read:

```typescript
const $counter = state({ count: 0 })

// Throws an error
effect(() => {
  const value = $counter.count
  $counter.count = value + 1 // Error: Infinite loop detected!
})
```

Beacon is not a compiler. It cannot statically analyze whether the effect would eventually exit, so it treats any read-then-write to the same property as an error.

### Safe patterns

```typescript
// Write to different state
const $source = state({ value: 0 })
const $target = state({ value: 0 })

effect(() => {
  $target.value = $source.value * 2 // Safe: different state objects
})

// Use derive for computed values
const doubled = derive(() => $counter.count * 2)
```

## Conditional dependencies

Effects only track what they actually access in a given run:

```typescript
const $s = state({ useA: true, a: 1, b: 2 })

effect(() => {
  if ($s.useA) {
    console.log(`A: ${$s.a}`) // Tracks 'useA' and 'a'
  } else {
    console.log(`B: ${$s.b}`) // Would track 'useA' and 'b'
  }
})
```

## Performance

### Prefer fine-grained effects

```typescript
// Avoid: one big effect
effect(() => {
  updateHeader($user.name)
  updateSidebar($user.role)
  updateContent($user.preferences)
})

// Better: separate focused effects
effect(() => updateHeader($user.name))
effect(() => updateSidebar($user.role))
effect(() => updateContent($user.preferences))
```

### Debouncing

For expensive operations, debounce inside the effect:

```typescript
let timeout
effect(() => {
  const currentData = s.data // Track the dependency

  clearTimeout(timeout)
  timeout = setTimeout(() => {
    saveToServer(currentData)
  }, 500)
})

// Rapid updates cancel previous timeouts
s.data = 'update1' // Starts 500ms timer
s.data = 'update2' // Cancels previous, starts new timer
s.data = 'update3' // Only this one saves after 500ms
```

### Batching updates

Effects are automatically batched within `batch()`:

```typescript
const $stats = state({ a: 0, b: 0, c: 0 })

effect(() => {
  console.log(`Total: ${$stats.a + $stats.b + $stats.c}`)
})

// Without batch: logs 3 times
$stats.a = 1 // Log: "Total: 1"
$stats.b = 2 // Log: "Total: 3"
$stats.c = 3 // Log: "Total: 6"

// With batch: logs once
batch(() => {
  $stats.a = 1
  $stats.b = 2
  $stats.c = 3
}) // Log: "Total: 6"
```

## Memory management

### Disposal

Always dispose effects when no longer needed:

```typescript
const dispose = effect(() => {
  // Effect logic
})

// Later, clean up
dispose()
```

### Automatic cleanup

Child effects are cleaned up when the parent is disposed:

```typescript
const disposeParent = effect(() => {
  effect(() => {
    console.log('Child effect')
  })
})

disposeParent() // Both parent and child are cleaned up
```

### Garbage collection

Beacon uses WeakMaps internally, allowing garbage collection when state and effects go out of scope:

```typescript
function createTempEffect() {
  const $temp = state({ value: 0 })

  effect(() => {
    console.log($temp.value)
  })

  // When function exits, both state and effect can be GC'd
}
```

## Pitfalls

### Forgetting to dispose

```typescript
// Memory leak
function setupComponent() {
  effect(() => {
    // Never disposed
  })
}

// Proper cleanup
function setupComponent() {
  const dispose = effect(() => {
    // Effect logic
  })

  return dispose // Return for caller to dispose
}
```

### Async callbacks don't track dependencies

Beacon tracks dependencies by setting a global `currentEffect` during effect execution. Async callbacks — `setTimeout`, `Promise.then`, event handlers — run after the effect finishes, when `currentEffect` is null.

```typescript
// Won't track dependencies
effect(() => {
  setTimeout(() => {
    console.log(s.value) // Not tracked
  }, 1000)
})

// Access state in the effect body instead
effect(() => {
  const value = s.value // Tracked
  setTimeout(() => {
    console.log(value) // Uses captured value
  }, 1000)
})
```

This applies to Promise callbacks (`.then()`, `.catch()`, `async/await`) and event handlers too.

### Array index tracking

Beacon tracks array indices with fine-grained precision:

```typescript
const $list = state({ items: [1, 2, 3] })

// Only tracks index 0
effect(() => {
  console.log($list.items[0])
})

// Only tracks length
effect(() => {
  console.log($list.items.length)
})

$list.items[1] = 99 // Won't trigger either effect
$list.items[0] = 99 // Triggers first effect only
$list.items[5] = 99 // Triggers second effect (length changes)
```

Array mutating methods like `push()`, `pop()`, `splice()` notify all subscribers because they can affect multiple properties (indices, length).

## Integration examples

### Network requests

```typescript
const $filters = state({ search: '', category: 'all' })

effect(() => {
  const params = new URLSearchParams({
    search: $filters.search,
    category: $filters.category,
  })

  fetch(`/api/products?${params}`)
    .then((res) => res.json())
    .then((data) => {
      // Update results
    })
})
```

### Local storage

```typescript
const $settings = state({ theme: 'light', language: 'en' })

effect(() => {
  localStorage.setItem(
    'settings',
    JSON.stringify({
      theme: $settings.theme,
      language: $settings.language,
    })
  )
})
```

## Testing

```typescript
import { state, effect } from '@nerdalytics/beacon'

test('effect tracks dependencies', () => {
  const $counter = state({ count: 0 })
  const calls = []

  const dispose = effect(() => {
    calls.push($counter.count)
  })

  expect(calls).toEqual([0]) // Initial run

  $counter.count = 1
  expect(calls).toEqual([0, 1]) // Triggered

  dispose()
  $counter.count = 2
  expect(calls).toEqual([0, 1]) // Not triggered after disposal
})
```
