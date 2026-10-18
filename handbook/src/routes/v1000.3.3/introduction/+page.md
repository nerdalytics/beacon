---
title: Introduction
description: Introduction to Beacon
---

<script>
import Version from '#lib/components/Version.svelte'
import VersionLink from '#lib/components/VersionLink.svelte'
</script>

Beacon is a reactive dependency graph runtime for Node.js. It tracks which values each function reads and re-runs that function when those values change.

Eight functions make up the API:

- **`state(initialValue, equalityFn?)`** creates a readable and writable signal
- **`derive(fn)`** computes a read-only value from other signals
- **`effect(fn)`** runs a function when its dependencies change
- **`batch(fn)`** groups updates so effects run once
- **`select(source, selectorFn, equalityFn?)`** subscribes to a computed slice of state
- **`lens(source, accessor)`** creates a two-way binding to a nested property
- **`readonlyState(state)`** hides the write methods on a state
- **`protectedState(initialValue, equalityFn?)`** separates read and write into a tuple

When you read a signal inside an effect, Beacon records the dependency. When the signal changes, the effect re-runs. You write no manual subscriptions, event names, or wiring.

## Changes from v1000.3.1

<Version /> adds a proto-key denylist to `lens()` path extraction. Beacon silently rejects accessor paths that traverse `__proto__`, `constructor`, or `prototype` as a defense-in-depth measure against prototype pollution. Legitimate use sees no API or behavioral changes. See the <VersionLink path="/migration">migration guide</VersionLink>.

## Constraints

Beacon is a single TypeScript file of about 480 lines with zero dependencies. It supports Node.js 20 or later and provides full type inference. Its internals are standalone functions with module-level tracking state.

## Use cases

Typical uses are configuration objects that trigger side effects on change, in-memory caches that recompute derived data when inputs update, and event-driven pipelines where state changes propagate through a dependency graph. `select()` avoids unrelated recomputation on large state objects. `lens()` gives subsystems two-way ownership of a slice of shared state.

Beacon is not a frontend framework. It has no DOM bindings and no component model. It tracks plain JavaScript values on the server.
