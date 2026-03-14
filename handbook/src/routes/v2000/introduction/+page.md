---
title: Introduction
description: What Beacon is and why it exists
---

# Introduction

Beacon is a reactive state management library for Node.js backends. It tracks which properties each function reads and re-runs only when those properties change.

## What it does

Beacon wraps plain objects in ES Proxies. When you read a property inside an effect, Beacon records that dependency. When you write to that property later, Beacon re-runs the effect. No manual subscriptions. No event names. No selectors.

Four primitives cover the entire API:

- **`state(obj)`** — wraps an object in a reactive Proxy
- **`effect(fn)`** — runs a function and re-runs it when its dependencies change
- **`derive(fn)`** — computes a value that stays in sync with its dependencies
- **`batch(fn)`** — groups multiple state changes into a single update cycle

That's the whole library.

## Design constraints

- Zero dependencies
- ~10kb minified
- Single-file core (~900 lines)
- TypeScript-first with full type inference
- Deep reactivity — nested objects are automatically wrapped
- Automatic dependency tracking at the property level

## Who this is for

Backend developers who want reactive patterns on the server. If you've used signals or observables on the frontend and wished you had the same thing in your Node.js services, Beacon fills that gap.

Common use cases:

- Configuration objects that trigger side effects on change
- In-memory caches that recompute derived data automatically
- Event-driven pipelines where state changes propagate through a dependency graph
- Testing harnesses that need observable state

## Who this is not for

Beacon is not a frontend framework. It has no DOM bindings, no virtual DOM, no component model. It runs on Node.js and manages plain JavaScript objects.

## Next steps

- [Installation](/v2000/installation) — get Beacon into your project
- [Quick Start](/v2000/quick-start) — build something reactive in five minutes
