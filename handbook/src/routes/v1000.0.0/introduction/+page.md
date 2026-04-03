---
title: Introduction
description: What Beacon v1000.0.0 is and what changed from v1.0.0
---

Beacon is a reactive state library for Node.js. It tracks which values each function reads and re-runs that function when those values change.

The API is seven functions:

- **`state(initialValue)`** creates a signal that holds a value
- **`derive(fn)`** computes a read-only value from other signals
- **`effect(fn)`** runs a function when its dependencies change
- **`batch(fn)`** groups updates so effects run once
- **`select(source, selectorFn, equalityFn?)`** subscribes to a computed slice of state
- **`readonlyState(state)`** creates a read-only view of a state signal
- **`protectedState(initialValue)`** separates read and write into a tuple

When you read a signal inside an effect, Beacon records the dependency. When the signal changes, the effect re-runs. There are no manual subscriptions, event names, or selectors to wire up.

## Changes from v1.0.0

v1000.0.0 is a complete rewrite. Key changes:

- **`derived()` renamed to `derive()`** and now returns `ReadOnlyState<T>` (no `.set()`/`.update()`)
- **`select()`** added for efficient subscription to a slice of state
- **`readonlyState()`** and **`protectedState()`** added for access control patterns
- **Infinite loop detection** — effects that write to a state they depend on throw
- **Re-entrance prevention** — effects already running are skipped on re-entry
- **Parent-child effect tracking** — nested effects are tracked hierarchically, cleanup propagates to children
- **Deferred effect creation in batches** — effects created inside `batch()` run after the batch completes
- **`derive()` is lazy-initialized** — computes on first read if dependencies haven't triggered yet

## Constraints

Beacon is a single TypeScript file, approximately 427 lines, with zero dependencies. It targets Node.js 20+ and provides full type inference out of the box. Internals are implemented as a `StateImpl` class with static methods.

## Use cases

Beacon is for backend developers who want reactive patterns on the server. Configuration objects that trigger side effects on change. In-memory caches that recompute derived data when inputs update. Event-driven pipelines where state changes propagate through a dependency graph. The `select()` primitive makes it practical to work with large state objects without triggering unnecessary recomputation.

It is not a frontend framework. There are no DOM bindings and no component model. It manages plain JavaScript values.
