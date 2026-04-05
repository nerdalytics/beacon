---
title: Introduction
description: What Beacon v1000.3.1 is and what changed from v1000.3.0
---

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

## Changes from v1000.3.0

v1000.3.1 reduces allocations in three hot paths: `protectedState` reader caching, `stateTracking` Set reuse on effect re-runs, and index-based iteration in `lens` path updates. Nested effect disposal now fully cleans up child references. No API or behavioral changes. ~480 LOC. See the [migration guide](/v1000.3.1/migration).

## Constraints

Single TypeScript file, ~480 lines, zero dependencies. Node.js 20+, full type inference. Internals are standalone functions with module-level tracking state.

## Use cases

Configuration objects that trigger side effects on change. In-memory caches that recompute derived data when inputs update. Event-driven pipelines where state changes propagate through a dependency graph. `select()` avoids unrelated recomputation on large state objects. `lens()` gives subsystems two-way ownership of a slice of shared state.

Beacon is not a frontend framework. No DOM bindings, no component model. It manages plain JavaScript values on the server.
