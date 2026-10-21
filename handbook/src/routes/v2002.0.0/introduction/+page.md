---
title: Introduction
description: What Beacon is and why it exists
---


Beacon is a reactive state management library for Node.js backends. It tracks which properties each function reads and re-runs only when those properties change.

## What it does

Beacon wraps plain objects in ES Proxies. When you read a property inside an effect, Beacon records that dependency. When you write to that property later, Beacon re-runs the effect. You need no manual subscriptions, event names, or selectors.

Four primitives cover the reactive graph:

- `state(obj)` wraps an object in a reactive Proxy
- `effect(fn)` runs a function and re-runs it when its dependencies change
- `derive(fn)` computes a value that stays in sync with its dependencies
- `batch(fn)` groups multiple state changes into a single update cycle

Two functions connect imperative code to the graph:

- `until(predicate)` resolves once a settled evaluation of the predicate is truthy
- `onIdle(callback)` runs the callback each time the graph becomes idle after doing work

That's the whole library.

## Design constraints

- Zero dependencies
- ~9kb minified, ~4kb gzipped
- Single-file core
- TypeScript-first with full type inference
- Deep reactivity: nested objects are automatically wrapped
- Automatic dependency tracking at the property level

## Who this is for

Backend developers who want reactive patterns on the server. If you have used signals or observables on the frontend and want the same thing in your Node.js services, Beacon provides it.

Common use cases:

- Configuration objects that trigger side effects on change
- In-memory caches that recompute derived data automatically
- Event-driven pipelines where state changes propagate through a dependency graph
- Testing harnesses that need observable state

## Who this is not for

Beacon is not a frontend framework. It has no DOM bindings and no component model. It manages plain JavaScript objects.
