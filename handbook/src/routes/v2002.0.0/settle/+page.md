---
title: Settle
description: Wait on the reactive graph from imperative code
---

<script>
import VersionLink from '#lib/components/VersionLink.svelte'
</script>

## until

`until(predicate, options?)` returns a promise that resolves with the predicate's value once a settled evaluation of the predicate is truthy. It connects imperative code, such as request handlers, startup sequences, and test harnesses, to the reactive graph.

```typescript
import { state, until } from '@nerdalytics/beacon'

const cache = state({ warm: false, entries: 0 })

// inside a request handler
await until(() => cache.warm, { timeout: 5000 })
serve(cache.entries)
```

Behavior:

1. **Settled reads only.** While an async computation the predicate depends on is pending, evaluations do not resolve the promise. Resolution waits for the settle.
2. **Reactive scope prohibition.** Calling `until` inside an effect or computation throws. Use an effect for reactive responses.
3. **Self-disposal.** When the promise resolves, rejects, times out, or aborts, Beacon releases the internal subscription, timer, and abort listener. None of them outlives the promise.
4. **Throwing predicate.** If an evaluation throws, the promise rejects with that error. The write that triggered the evaluation does not throw.

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

## onIdle

`onIdle(callback)` calls the callback each time the reactive graph becomes idle after doing work: no effect queued and no microtask flush armed. That happens after a synchronous flush or an async settlement. A pending async computation does not keep the graph from being idle, so the callback runs after the flush that started the computation and again when it settles. It returns an unsubscribe function.

```typescript
import { batch, onIdle, state } from '@nerdalytics/beacon'

const metrics = state({ flushes: 0 })

const stop = onIdle(() => {
  metrics.flushes++
})

batch(() => {
  cache.warm = true
  cache.entries = 42
})
// one callback after the batched flush, not one per write

stop()
```

Behavior:

1. **Writes inside a callback.** A callback's state writes apply at once, including writes inside `batch()`. The effects they schedule run after every callback has returned. They run before the flush that notified returns. Callbacks then run again for that cycle. A write that schedules no effect starts no new cycle.
2. **Runaway callbacks.** If callbacks still schedule effects after 100 notifications in one flush, the remaining effects are dropped and an `Infinite loop detected` error is thrown to the code that started the flush. A microtask flush reports it with `console.error`. An async settlement reports it as an unhandled rejection. The example above reaches this limit if an effect reads `metrics.flushes`. A callback write that wakes only `'microtask'` effects starts a new microtask flush instead of a new cycle, so this limit does not count it. The microtask chain limit in Effects stops that loop after 100 flushes.

## See also

- <VersionLink path="/derive">Derive</VersionLink> covers async computations whose settlements leave the graph idle
- <VersionLink path="/effects">Effects</VersionLink> covers reactive runners, including microtask scheduling
