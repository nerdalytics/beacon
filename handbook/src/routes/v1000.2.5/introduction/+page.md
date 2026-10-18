---
title: Introduction
description: Introduction to Beacon
---

<script>
import VersionLink from '#lib/components/VersionLink.svelte'
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

## Changes from v1000.2.4

This is a patch release. The README was restructured, and the API did not change. See the <VersionLink path="/migration">migration guide</VersionLink>.

## Constraints

Beacon is a single TypeScript file of ~633 lines with zero dependencies. It requires Node.js 20 or later and provides full type inference. Its internals are a `StateImpl` class with static methods.

## Use cases

Typical use cases are configuration objects that trigger side effects on change, in-memory caches that recompute derived data when inputs update, and event-driven pipelines where state changes propagate through a dependency graph. `select()` avoids unrelated recomputation on large state objects. `lens()` lets subsystems read and write a slice of shared state.

Beacon is not a frontend framework. It has no DOM bindings and no component model. It tracks plain JavaScript values on the server.
