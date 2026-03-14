---
title: "Migration: v1000 → v2000"
description: How to upgrade from Beacon v1000 to v2000
---


Version 2000.0.0 shifts from function-based to Proxy-based reactive state. The API is simpler but fundamentally different.

## Key changes

1. **Natural JavaScript syntax** — direct property access instead of `state()` function calls
2. **Proxy-based reactivity** — all state objects wrapped in Proxies for automatic tracking
3. **Per-property tracking** — dependencies tracked at the property level, not object level
4. **Always-eager computed values** — no lazy evaluation; simpler mental model
5. **Removed APIs** — `select`, `lens`, `readonlyState`, `protectedState` are gone

## API comparison

| v1000.x | v2000.0.0 |
|---------|-----------|
| `const count = state(0)` | `const signal = state({ count: 0 })` |
| `count()` | `signal.count` |
| `count.set(5)` | `signal.count = 5` |
| `derive(() => count() * 2)` | `derive(() => signal.count * 2)` |
| Returns function | Returns `{ value: T }` |

## Step-by-step

### 1. Replace primitive state with object state

v1000 allowed primitive values. v2000 requires objects.

```typescript
// Before
const count = state(0)
const name = state('Alice')

// After
const counter = state({ count: 0 })
const user = state({ name: 'Alice' })
```

### 2. Replace getter calls with property access

```typescript
// Before
console.log(count())
console.log(name())

// After
console.log(counter.count)
console.log(user.name)
```

### 3. Replace setter calls with assignment

```typescript
// Before
count.set(5)
name.set('Bob')

// After
counter.count = 5
user.name = 'Bob'
```

### 4. Update derive usage

Derive now returns `{ value: T }` instead of a function.

```typescript
// Before
const doubled = derive(() => count() * 2)
console.log(doubled())

// After
const doubled = derive(() => counter.count * 2)
console.log(doubled.value)
```

### 5. Remove deleted APIs

These APIs no longer exist in v2000:

- `select()` — use `derive()` instead
- `lens()` — access nested properties directly
- `readonlyState()` — not needed; control access through module boundaries
- `protectedState()` — not needed; same approach

### 6. Dispose derived values

v2000 derives create an internal effect. They must be disposed to prevent memory leaks:

```typescript
const doubled = derive(() => counter.count * 2)

// When no longer needed:
doubled[Symbol.dispose]()
```

## Performance impact

Proxy-based reactivity trades raw speed for developer experience:

| Metric | v1000 | v2000 |
|--------|-------|-------|
| Batch (1M updates) | 19ms | 36ms |
| Unbatched (1M updates) | 362ms | 671ms |

The 2x slowdown comes from proxy trap overhead. For most server-side applications, this is negligible. Use `batch()` for bulk updates to minimize the gap.
