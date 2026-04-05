---
title: Introduction
description: What Beacon is and why it exists
---

Beacon is a reactive signal library for Node.js. It tracks which values each function reads and re-runs that function when those values change.

The entire API is four functions:

- **`state(initialValue)`** creates a signal that holds a value
- **`derived(fn)`** computes a value from other signals
- **`effect(fn)`** runs a function when its dependencies change
- **`batch(fn)`** groups updates so effects run once

When you read a signal inside an effect, Beacon records the dependency. When the signal changes, the effect re-runs. There are no manual subscriptions, event names, or selectors.

## Constraints

Beacon is a single TypeScript file under 200 lines with zero dependencies. It targets Node.js 20+ and provides full type inference out of the box. Dependencies are tracked at the signal level and cleaned up automatically on each re-run.

## Use cases

Beacon is for backend developers who want reactive patterns on the server. Configuration objects that trigger side effects on change. In-memory caches that recompute derived data when inputs update. Event-driven pipelines where state changes propagate through a dependency graph.

It is not a frontend framework. There are no DOM bindings and no component model. It tracks plain JavaScript values.
