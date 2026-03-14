---
title: Batch
description: Group multiple state updates into a single notification cycle
---

# Batch

`batch()` collapses multiple state mutations into a single notification cycle. Without batch, each mutation triggers its own propagation — effects see intermediate states. With batch, all mutations apply first, then effects run once with the final state.

## API

```typescript
function batch<T>(fn: () => T, hooks?: BatchHooks): T
```

Returns the value returned by `fn`. See [Hooks](/hooks) for the optional hooks parameter.

## Basic usage

```typescript
import { state, effect, batch } from '@nerdalytics/beacon'

const user = state({ name: 'John', role: 'user' })
const app = state({ theme: 'light', sidebarOpen: true })

effect(() => {
  console.log(`User ${user.name} changed`)
})

effect(() => {
  console.log(`Theme is now ${app.theme}`)
})

// Without batch: triggers effects separately
user.name = 'Jane' // Log: "User Jane changed"
app.theme = 'dark' // Log: "Theme is now dark"

// With batch: triggers effects after all updates
batch(() => {
  user.name = 'Bob'
  user.role = 'admin'
  app.theme = 'light'
  app.sidebarOpen = false
})
// Then logs:
// "User Bob changed"
// "Theme is now light"
```

A single property mutation already propagates consistently through derive chains without batch. Batch is for coordinating multiple mutations into one notification cycle.

## How it works

1. **Batch start**: Increments `batchDepth` counter
2. **Fast path** (`!onWrite && !currentEffect`): Mutations skip subscriber scheduling — only track dirty target-property pairs in `dirtyTargets`
3. **Normal path** (write hooks exist or inside an effect): Standard scheduling with hooks and infinite loop detection
4. **Effect creation**: Effects created inside batch go into `deferredEffectCreations` instead of running immediately
5. **Dirty target processing**: At `batchDepth === 1`, iterate `dirtyTargets` and call `scheduleSubscribersForTarget` once per unique property
6. **Batch end**: Decrements `batchDepth`
7. **Flush**: When depth reaches 0, run deferred effects, then flush all pending effects

```
batch() -> batchDepth++ -> Execute fn -> fast path: track dirty targets
                                       -> normal path: schedule subscribers
                                       -> effect() calls deferred
         depth === 1? -> process dirtyTargets
         batchDepth-- -> depth === 0? -> run deferred effects -> flushEffects()
                                      -> otherwise wait for outer batch
```

### Nested batches

Batches nest. Notifications fire only when the outermost batch completes:

```typescript
const s = state({ a: 0, b: 0, c: 0 })

effect(() => console.log(`Sum: ${s.a + s.b + s.c}`))

batch(() => {
  s.a = 1

  batch(() => {
    s.b = 2
    batch(() => {
      s.c = 3
    }) // Inner batch - no notification
  }) // Middle batch - no notification

  s.a = 10
}) // Outer batch completes - single notification
// Logs once: "Sum: 15"
```

## Performance

### Benchmarks

For 1,000,000 iterations (median of 7 runs):

| Scenario | Time |
|----------|------|
| batch + derive | 36ms |
| batch + derive + 2 effects | 35ms |
| state + derive (unbatched) | 294ms |
| state + derive + 2 effects (unbatched) | 671ms |

### Why batch is fast

1. **Deferred scheduling**: The set handler fast path skips subscriber scheduling entirely during batch — only tracks dirty target-property pairs
2. **Single notification cycle**: N mutations produce 1 flush instead of N flushes
3. **Reduced effect executions**: Effects depending on multiple changed properties run once
4. **Predictable timing**: All updates complete before any effects run

```typescript
// Without batch: 3 effect executions
state1.value = 10 // scheduleSubscribers -> flushEffects()
state2.value = 20 // scheduleSubscribers -> flushEffects()
state3.value = 30 // scheduleSubscribers -> flushEffects()

// With batch: 1 flush at the end
batch(() => {
  state1.value = 10 // scheduleSubscribers (deferred)
  state2.value = 20 // scheduleSubscribers (deferred)
  state3.value = 30 // scheduleSubscribers (deferred)
}) // flushEffects() once
```

## Patterns

### Coordinating multiple states

```typescript
const account1 = state({ balance: 1000 })
const account2 = state({ balance: 500 })
const ledger = state({ entries: [] })

// Without batch: observers see inconsistent state during transfer
function transfer(amount) {
  account1.balance -= amount // Effect fires: "Account 1: $900"
  account2.balance += amount // Effect fires: "Account 2: $600"
  ledger.entries.push({ from: 'account1', to: 'account2', amount })
}

// With batch: atomic update
function transferBatched(amount) {
  batch(() => {
    account1.balance -= amount
    account2.balance += amount
    ledger.entries.push({ from: 'account1', to: 'account2', amount })
  })
  // All effects run AFTER the complete transfer
}
```

### Bulk updates with loops

```typescript
const items = state([])
const stats = state({ total: 0, average: 0 })

effect(() => {
  console.log(`Stats: total=${stats.total}, avg=${stats.average}`)
})

// Without batch: effects run on every iteration (~300 executions for 100 items)
function addManyItems(newItems) {
  for (const item of newItems) {
    items.push(item)
    stats.total += item.value
    stats.average = stats.total / items.length
  }
}

// With batch: effects run once (2 executions for 100 items)
function addManyItemsBatched(newItems) {
  batch(() => {
    for (const item of newItems) {
      items.push(item)
      stats.total += item.value
      stats.average = stats.total / items.length
    }
  })
}
```

### Conditional batching

```typescript
function processItems(data, immediate = false) {
  const update = () => {
    ui.processing = true
    data.forEach((item) => {
      items.list.push(item)
      ui.processedCount++
    })
    ui.processing = false
  }

  if (immediate) {
    update() // Effects run per-iteration for live feedback
  } else {
    batch(update) // Effects run once after all updates
  }
}
```

## Integration with derive

```typescript
const list = state({ items: [], filter: '', sort: 'name' })

const filtered = derive(() => {
  return list.items
    .filter((item) => item.name.includes(list.filter))
    .sort((a, b) => a[list.sort].localeCompare(b[list.sort]))
})

function updateFilters(newFilter, newSort) {
  batch(() => {
    list.filter = newFilter
    list.sort = newSort
  }) // Single recomputation
}
```

## Best practices

### Batch related updates

```typescript
// Good: related updates together
batch(() => {
  user.firstName = 'Jane'
  user.lastName = 'Doe'
  user.fullName = 'Jane Doe'
})

// Avoid: unrelated updates mixed with side effects
batch(() => {
  user.name = 'Jane'
  app.theme = 'dark' // Unrelated
  socket.connect() // Side effect
})
```

### Don't overuse

```typescript
// Unnecessary for a single update
batch(() => {
  s.value = 10
})

// Just update directly
s.value = 10

// Good use: multiple updates
batch(() => {
  s.x = 10
  s.y = 20
  s.z = 30
})
```

## Pitfalls

### Async operations break the batch context

```typescript
// Won't batch: async breaks out of batch
batch(async () => {
  form.email = email
  const isValid = await validateEmail(email) // API call
  form.emailValid = isValid // NOT batched
  form.canSubmit = isValid // Triggers effects immediately
})

// Correct: await first, then batch
const isValid = await validateEmail(email)
batch(() => {
  form.email = email
  form.emailValid = isValid
  form.canSubmit = isValid
})
```

## Testing

```typescript
test('batch groups notifications', () => {
  const s = state({ a: 0, b: 0 })
  let effectCount = 0

  effect(() => {
    effectCount++
    const sum = s.a + s.b
  })

  expect(effectCount).toBe(1) // Initial run

  batch(() => {
    s.a = 5
    s.b = 10
  })

  expect(effectCount).toBe(2) // Only one additional run
  expect(s.a).toBe(5)
  expect(s.b).toBe(10)
})
```

## Tips

1. **Batch multiple state objects** — when updating different states that trigger the same effects
2. **Batch for derive** — when changing filter/sort/pagination that a derive depends on
3. **Keep batches synchronous** — async operations break the batch context
4. **Use for bulk operations** — essential for loops that update state repeatedly
5. **Don't nest unnecessarily** — nested batches work but add no benefit
