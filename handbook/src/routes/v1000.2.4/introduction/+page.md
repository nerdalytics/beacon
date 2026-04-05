---
title: Introduction
description: What Beacon v1000.2.4 is and what changed from v1000.2.3
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

## Changes from v1000.2.3

Internal performance optimization. Batch flush now swaps collection references instead of copying, avoiding array allocations. No API changes. See the [migration guide](/v1000.2.4/migration).

## Constraints

Single TypeScript file, ~633 lines, zero dependencies. Node.js 20+, full type inference. Internals are a `StateImpl` class with static methods.

## Use cases

Configuration objects that trigger side effects on change. In-memory caches that recompute derived data when inputs update. Event-driven pipelines where state changes propagate through a dependency graph. `select()` avoids unrelated recomputation on large state objects. `lens()` gives subsystems two-way ownership of a slice of shared state.

Beacon is not a frontend framework. No DOM bindings, no component model. It tracks plain JavaScript values on the server.
