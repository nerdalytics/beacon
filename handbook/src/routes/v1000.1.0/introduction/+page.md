---
title: Introduction
description: What Beacon v1000.1.0 is and what changed from v1000.0.0
---

Beacon is a reactive state library for Node.js. It tracks which values each function reads and re-runs that function when those values change.

Eight functions make up the API:

- **`state(initialValue)`** creates a readable and writable signal
- **`derive(fn)`** computes a read-only value from other signals
- **`effect(fn)`** runs a function when its dependencies change
- **`batch(fn)`** groups updates so effects run once
- **`select(source, selectorFn, equalityFn?)`** subscribes to a computed slice of state
- **`lens(source, accessor)`** two-way binding to a nested property
- **`readonlyState(state)`** hides the write methods on a state
- **`protectedState(initialValue)`** separates read and write into a tuple

When you read a signal inside an effect, Beacon records the dependency. When the signal changes, the effect re-runs. No manual subscriptions, event names, or wiring.

## Changes from v1000.0.0

v1000.1.0 is a minor release adding one new primitive:

- `lens()` added for two-way bindings to nested properties of state objects

No breaking changes. All existing v1000.0.0 code works without modification.

See the [migration guide](/v1000.1.0/migration) for details.

## Constraints

Single TypeScript file, ~633 lines, zero dependencies. Node.js 20+, full type inference. Internals are a `StateImpl` class with static methods.

## Use cases

Configuration objects that trigger side effects on change. In-memory caches that recompute derived data when inputs update. Event-driven pipelines where state changes propagate through a dependency graph. `select()` makes it practical to work with large state objects without triggering unrelated recomputation. `lens()` adds two-way binding to nested properties, useful when a subsystem needs to own a slice of shared state.

Beacon is not a frontend framework. No DOM bindings, no component model. It manages plain JavaScript values on the server.
