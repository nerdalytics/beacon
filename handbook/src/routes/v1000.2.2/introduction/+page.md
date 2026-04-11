---
title: Introduction
description: Introduction to Beacon
---

<script>
import VersionLink from '$lib/components/VersionLink.svelte'
</script>

Beacon is a reactive dependency graph runtime for Node.js. It tracks which values each function reads and re-runs that function when those values change.

Eight functions make up the API:

- **`state(initialValue, equalityFn?)`** creates a readable and writable signal
- **`derive(fn)`** computes a read-only value from other signals
- **`effect(fn)`** runs a function when its dependencies change
- **`batch(fn)`** groups updates so effects run once
- **`select(source, selectorFn, equalityFn?)`** subscribes to a computed slice of state
- **`lens(source, accessor)`** two-way binding to a nested property
- **`readonlyState(state)`** hides the write methods on a state
- **`protectedState(initialValue, equalityFn?)`** separates read and write into a tuple

When you read a signal inside an effect, Beacon records the dependency. When the signal changes, the effect re-runs. No manual subscriptions, event names, or wiring.

## Changes from v1000.2.1

`Unsubscribe` type is now exported. You can import it for explicit typing of effect cleanup functions. `STATE_ID` is now a named unique symbol. See the <VersionLink path="/migration">migration guide</VersionLink>.

## Constraints

Single TypeScript file, ~633 lines, zero dependencies. Node.js 20+, full type inference. Internals are a `StateImpl` class with static methods.

## Use cases

Configuration objects that trigger side effects on change. In-memory caches that recompute derived data when inputs update. Event-driven pipelines where state changes propagate through a dependency graph. `select()` avoids unrelated recomputation on large state objects. `lens()` gives subsystems two-way ownership of a slice of shared state.

Beacon is not a frontend framework. No DOM bindings, no component model. It tracks plain JavaScript values on the server.
