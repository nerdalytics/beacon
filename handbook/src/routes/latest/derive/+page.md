---
title: Derive
description: Compute derived values that cache results and auto-update
---


`derive()` creates computed values that update automatically when their dependencies change. It memoizes the result and only recalculates when necessary.

## API

```typescript
function derive<T>(computeFn: () => T, hooks?: DeriveHooks<T>): ComputedValue<T>

type ComputedValue<T> = {
  readonly value: T | undefined | null
  reactive: boolean
}
```

- `value` — the cached computed result (read-only)
- `reactive` — controls the internal effect lifecycle; set to `false` to dispose, `true` to recreate

See [Hooks](/latest/hooks-overview) for the optional hooks parameter.

## Basic usage

```typescript
import { state, derive } from '@nerdalytics/beacon'

const $items = state({ list: [1, 2, 3] })

const sum = derive(() => $items.list.reduce((a, b) => a + b, 0))

console.log(sum.value) // 6

$items.list.push(4)
console.log(sum.value) // 10 (automatically updated)
```

## Eager evaluation

Derived values compute immediately on creation and again when dependencies change:

```typescript
const expensive = derive(() => {
  console.log('Computing...')
  return $items.list.filter((x) => x > 10).length
})
// Logs: "Computing..." immediately

$items.list.push(15)
// Logs: "Computing..." again

console.log(expensive.value) // No recomputation, returns cached value
// Returns: 1
```

## How it works

`derive()` uses an internal `state()` + `effect()` pair:

1. Creates an effect that runs the compute function immediately
2. Executes the function, tracks dependencies, caches the result
3. When a dependency changes, the effect re-runs and updates the cache
4. Accessing `.value` returns the cached result without recomputation

```
Create Derive -> Create Effect -> Run Compute -> Track Deps -> Cache Result
                                       |
                   Dependency Changes -> Effect Re-runs -> Update Cache
                                       |
                   Access .value -> Return Cached Value (no computation)
```

### Dependency tracking

Like effects, derive tracks only what it reads:

```typescript
const $user = state({ firstName: 'Jane', lastName: 'Doe', age: 30 })

// Only tracks firstName and lastName
const fullName = derive(() => `${$user.firstName} ${$user.lastName}`)

$user.age = 31 // Doesn't invalidate fullName
$user.firstName = 'John' // Invalidates and recomputes
```

## Patterns

### Chained derivations

Derived values can depend on other derived values:

```typescript
const $prices = state({ items: [10, 20, 30] })

const subtotal = derive(() => $prices.items.reduce((a, b) => a + b, 0))
const tax = derive(() => subtotal.value * 0.08)
const total = derive(() => subtotal.value + tax.value)

console.log(total.value) // 64.8
```

### Conditional computations

```typescript
const $config = state({ useCache: true, data: null })
const $cache = state({ data: 'cached' })

const result = derive(() => {
  if ($config.useCache && $cache.data) {
    return $cache.data // Only depends on $cache when useCache is true
  }
  return $config.data
})
```

### Collection transformations

```typescript
const $todos = state([
  { id: 1, text: 'Learn Beacon', done: false },
  { id: 2, text: 'Build app', done: true },
])

const activeTodos = derive(() => $todos.filter((t) => !t.done))
const completedCount = derive(() => $todos.filter((t) => t.done).length)
const progress = derive(() => {
  const total = $todos.length
  return total ? (completedCount.value / total) * 100 : 0
})
```

### Search and filtering

```typescript
const $products = state([
  { id: 1, name: 'Laptop', price: 999, category: 'electronics' },
  { id: 2, name: 'Shirt', price: 29, category: 'clothing' },
])

const $filters = state({
  search: '',
  category: 'all',
  maxPrice: 1000,
})

const filteredProducts = derive(() => {
  let result = $products

  if ($filters.search) {
    result = result.filter((p) => p.name.toLowerCase().includes($filters.search.toLowerCase()))
  }

  if ($filters.category !== 'all') {
    result = result.filter((p) => p.category === $filters.category)
  }

  return result.filter((p) => p.price <= $filters.maxPrice)
})
```

### Form validation

```typescript
const $form = state({
  email: '',
  password: '',
  confirmPassword: '',
})

const validation = derive(() => {
  const errors = []

  if (!$form.email.includes('@')) {
    errors.push('Invalid email')
  }

  if ($form.password.length < 8) {
    errors.push('Password too short')
  }

  if ($form.password !== $form.confirmPassword) {
    errors.push('Passwords do not match')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
})
```

## Performance

### Memoization

Derived values cache their results:

```typescript
const $data = state({ value: 100 })
let computeCount = 0

const expensive = derive(() => {
  computeCount++
  return $data.value * Math.random()
})

const v1 = expensive.value // computeCount: 1
const v2 = expensive.value // computeCount: 1 (cached)

$data.value = 200
const v3 = expensive.value // computeCount: 2 (recomputed)
```

### Batch optimization

When multiple mutations change different dependencies, `batch()` ensures the derive recomputes once instead of once per mutation.

A single mutation already propagates consistently through a derive chain without batch — effects run in creation order, which matches dependency order. Batch optimizes the multi-mutation case.

```typescript
const $a = state({ value: 1 })
const $b = state({ value: 2 })
const $c = state({ value: 3 })

let computeCount = 0
const sum = derive(() => {
  computeCount++
  return $a.value + $b.value + $c.value
})

// Without batch: recomputes for each change
$a.value = 10 // Recomputes (count: 1)
$b.value = 20 // Recomputes (count: 2)
$c.value = 30 // Recomputes (count: 3)

// With batch: recomputes once
batch(() => {
  $a.value = 100
  $b.value = 200
  $c.value = 300
})
// Total: 1 computation
```

### Derive vs. effect

Both run eagerly, but serve different purposes:

```typescript
// derive: computes and caches a value
const computedSum = derive(() => {
  return $items.list.reduce((a, b) => a + b, 0)
})

// effect: performs side effects
let effectSum = 0
const dispose = effect(() => {
  effectSum = $items.list.reduce((a, b) => a + b, 0)
})

// Key difference: derive provides a cached value
console.log(computedSum.value) // No recomputation
computedSum.reactive = false // Stop tracking

// Effect must be manually disposed
dispose()
```

## Memory management

### Disposal via `reactive` toggle

Derived values create an internal `state()` + `effect()` pair. Set `reactive` to `false` to dispose the internal effect:

```typescript
const $local = state({ value: 10 })
const computed = derive(() => $local.value * 2)

console.log(computed.value) // 20

// Dispose: stop reacting to changes
computed.reactive = false

// .value still returns the last computed value
console.log(computed.value) // 20 (retained)

// Re-enable: recreates the internal effect and recomputes
computed.reactive = true
```

### Preventing memory leaks

Without disposal, derived values accumulate and their internal effects keep running:

```typescript
// Bad: memory leak
function createLeakyDerived() {
  const computed = derive(() => globalState.value * 2)
  return computed.value // Effect keeps running
}

// Good: clean up after getting value
function createCleanDerived() {
  const computed = derive(() => globalState.value * 2)
  const value = computed.value
  computed.reactive = false
  return value
}

// Better: return derive for caller to manage lifecycle
function createManagedDerived() {
  return derive(() => globalState.value * 2)
  // Caller sets reactive = false when done
}
```

### Circular references

This code fails at runtime because `c` is not yet defined when `b` is created — a JavaScript `ReferenceError`, not a Beacon-specific check:

```typescript
const $a = state({ value: 1 })

const b = derive(() => c.value + 1) // ReferenceError: c is not defined
const c = derive(() => b.value + 1)
```

## Gotchas

### Don't mutate in derive

Derived values should be pure — no side effects:

```typescript
// Bad: has side effects
const bad = derive(() => {
  localStorage.setItem('value', s.value) // Side effect
  return s.value * 2
})

// Good: pure computation
const good = derive(() => s.value * 2)

// Use effect for side effects
effect(() => {
  localStorage.setItem('value', good.value)
})
```

### Avoid creating objects unnecessarily

```typescript
// Creates new object every access
const bad = derive(() => ({
  x: s.x,
  y: s.y,
}))

// Only creates new object when values change
const good = derive(() => {
  const x = s.x
  const y = s.y
  return { x, y } // Memoized until x or y changes
})
```

## Testing

```typescript
test('derive updates when dependencies change', () => {
  const $source = state({ value: 10 })
  const doubled = derive(() => $source.value * 2)

  expect(doubled.value).toBe(20)

  $source.value = 15
  expect(doubled.value).toBe(30)

  doubled.reactive = false
})

test('derive computes eagerly', () => {
  let computeCount = 0
  const $source = state({ value: 10 })

  const computed = derive(() => {
    computeCount++
    return $source.value * 2
  })

  expect(computeCount).toBe(1) // Computed immediately
  computed.value // No additional computation
  expect(computeCount).toBe(1)

  $source.value = 20
  expect(computeCount).toBe(2) // Recomputed

  computed.reactive = false
})

test('derive supports disposal via reactive toggle', () => {
  const $source = state({ value: 10 })
  const computed = derive(() => $source.value * 2)

  expect(computed.value).toBe(20)

  computed.reactive = false

  // .value still returns the last computed value
  expect(computed.value).toBe(20)

  // Changes no longer trigger recomputation
  $source.value = 30
  expect(computed.value).toBe(20)

  // Re-enable
  computed.reactive = true
  expect(computed.value).toBe(60)
})
```

## Performance tips

1. **Set `reactive = false` on unused derives** — prevents memory leaks
2. **Use batch for multiple updates** — derive recomputes once per batch
3. **Keep computations simple** — complex derives run on every dependency change
4. **Avoid deep nesting** — chains of derives add overhead
5. **Cache external data** — don't refetch in derive functions
6. **Use effects for side effects** — keep derives pure
7. **Consider lifecycle** — short-lived derives should set `reactive = false` promptly
