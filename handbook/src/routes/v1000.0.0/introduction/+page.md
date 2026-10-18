---
title: Introduction
description: Introduction to Beacon
---

<script>
import Version from '#lib/components/Version.svelte'
import VersionLink from '#lib/components/VersionLink.svelte'
</script>

Beacon is a reactive dependency graph runtime for Node.js. It tracks which values a function reads and re-runs that function when those values change.

Seven functions make up the API:

- `state(initialValue)` creates a readable and writable signal
- `derive(fn)` computes a read-only value from other signals
- `effect(fn)` runs a function when its dependencies change
- `batch(fn)` groups updates so effects run once
- `select(source, selectorFn, equalityFn?)` subscribes to a computed slice of state
- `readonlyState(state)` hides the write methods on a state
- `protectedState(initialValue)` separates read and write into a tuple

When you read a signal inside an effect, Beacon records the dependency. When the signal changes, the effect re-runs. You write no manual subscriptions, event names, or wiring.

## Changes from v1.0.0

<Version /> is a complete rewrite of the library internals and API surface:

- `derived()` renamed to `derive()`, now returns `ReadOnlyState<T>` (no `.set()`/`.update()`)
- `select()` added for property-level subscriptions on state objects
- `readonlyState()` and `protectedState()` added for access control
- Effects that write to a state they depend on throw instead of looping
- Re-entrance is skipped when an effect triggers itself indirectly
- Nested effects track parent-child relationships; cleanup propagates downward
- Effects created inside `batch()` are deferred until the batch completes
- `derive()` is lazy. It computes on first read, not on creation.

See the <VersionLink path="/migration">migration guide</VersionLink> for the full list of breaking changes.

## Constraints

Beacon is a single TypeScript file of about 427 lines with zero dependencies. It requires Node.js 20 or later and offers full type inference. Its internals are a `StateImpl` class with static methods.

## Use cases

Beacon fits configuration objects that trigger side effects on change, in-memory caches that recompute derived data when inputs update, and event-driven pipelines where state changes propagate through a dependency graph. Use `select()` with large state objects to avoid recomputation from unrelated changes.

Beacon is not a frontend framework. It has no DOM bindings and no component model. It tracks plain JavaScript values on the server.
