---
title: Introduction
description: What Beacon is and why it exists
---

Beacon is a lightweight reactive signal library for Node.js backends. It enables reactive state management with automatic dependency tracking and efficient updates for server-side applications.

## What it does

Beacon provides four primitives that cover the entire API:

- **`state(initialValue)`** — creates a reactive signal that holds a value
- **`derived(fn)`** — computes a value that stays in sync with its dependencies
- **`effect(fn)`** — runs a function whenever its dependencies change
- **`batch(fn)`** — groups multiple state changes into a single update cycle

Reading a signal inside an effect automatically tracks the dependency. When the signal's value changes, the effect re-runs. No manual subscriptions. No event names. No selectors.

## Design constraints

- Zero dependencies
- Under 200 lines of code
- Single-file core
- TypeScript-first with full type inference
- Fine-grained reactivity at the signal level
- Automatic dependency cleanup on re-run

## Who this is for

Backend developers who want reactive patterns on the server. If you've used signals or observables on the frontend and wished you had the same thing in your Node.js services, Beacon fills that gap.

Common use cases:

- Configuration objects that trigger side effects on change
- In-memory caches that recompute derived data automatically
- Event-driven pipelines where state changes propagate through a dependency graph
- Testing harnesses that need observable state

## Who this is not for

Beacon is not a frontend framework. It has no DOM bindings and no component model. It manages plain JavaScript values on the server.
