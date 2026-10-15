---
title: Settle
description: Await reactive convergence from imperative code
---

<script>
import VersionLink from '#lib/components/VersionLink.svelte'
</script>

## until

`until(predicate, options?)` returns a promise that resolves with the predicate's value once a settled evaluation of the predicate is truthy. It is the bridge from imperative code — request handlers, startup sequences, test harnesses — into the reactive graph.

```typescript
import { state, until } from '@nerdalytics/beacon'

const cache = state({ warm: false, entries: 0 })

// inside a request handler
await until(() => cache.warm, { timeout: 5000 })
serve(cache.entries)
```

Behavior:

1. **Settled reads only** — while an async computation the predicate depends on is pending, evaluations do not resolve the promise; resolution waits for the settle
2. **Reactive scope prohibition** — calling `until` inside an effect or computation throws; use an effect for reactive responses
3. **Self-disposal** — on resolve, rejection, timeout, or abort the internal subscription, timer, and abort listener are released; none outlives the promise
4. **Throwing predicate** — if an evaluation throws, the promise rejects with that error; the write that triggered the evaluation does not throw

### Options

| Option | Type | Effect |
|--------|------|--------|
| `timeout` | `number` | Reject with a timeout error if no truthy settled evaluation arrives in time |
| `signal` | `AbortSignal` | Reject with the signal's reason on abort; an already-aborted signal rejects immediately |

```typescript
const controller = new AbortController()

const warm = until(() => cache.warm, { signal: controller.signal }).catch((err) => {
  if (err === controller.signal.reason) return false
  throw err
})

// give up after the request deadline
controller.abort('deadline')
```

## onSettled

`onSettled(callback)` invokes the callback whenever the reactive graph reaches quiescence after processing work — a synchronous flush or an async settlement. It returns an unsubscribe function.

```typescript
import { batch, onSettled, state } from '@nerdalytics/beacon'

const metrics = state({ flushes: 0 })

const stop = onSettled(() => {
  metrics.flushes++
})

batch(() => {
  cache.warm = true
  cache.entries = 42
})
// one callback after the batched flush, not one per write

stop()
```

## See also

- <VersionLink path="/derive">Derive</VersionLink> — async computations whose settlements trigger quiescence
- <VersionLink path="/effects">Effects</VersionLink> — reactive runners, including microtask scheduling
