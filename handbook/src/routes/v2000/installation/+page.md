---
title: Installation
description: Install Beacon and set up your project
---


## Requirements

- ESM project (`"type": "module"` in your `package.json`)
- One of: Node.js >= 22.0.0, Bun >= 1.3, or Deno >= 2.7

## Runtime compatibility

| Runtime | Status | Notes |
|---|---|---|
| Node.js >= 22 | Full support | Primary target. All tests pass. |
| Bun >= 1.3 | Near-full support | 192/193 tests pass. One `deepStrictEqual` edge case with array symbol properties — a Bun compat difference, not a Beacon bug. |
| Deno >= 2.7 | Near-full support | 185/193 tests pass. Deno's `node:test` compat layer does not implement `afterEach`, which one test file uses. Core functionality works. |

## Install

### npm

```bash
npm install @nerdalytics/beacon
```

### JSR

```bash
npx jsr add @nerdalytics/beacon
```

## Project setup

Beacon is ESM-only. Your `package.json` needs the module type:

```json
{
  "type": "module"
}
```

If you're using TypeScript, target `ES2022` or later and set module resolution to `NodeNext` or `Bundler`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

## Import

```typescript
import { state, effect, derive, batch } from '@nerdalytics/beacon'
```

All four primitives are named exports from the package root. There are no subpath exports or separate entry points.

## TypeScript

Beacon ships source files and declaration maps. Type inference works out of the box — no `@types` package needed.

