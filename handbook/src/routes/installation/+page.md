---
title: Installation
description: Install Beacon and set up your project
---

# Installation

## Requirements

- Node.js >= 22.0.0
- ESM project (`"type": "module"` in your `package.json`)

## Install

```bash
npm install @nerdalytics/beacon
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

## Next steps

Head to [Quick Start](/quick-start) to build your first reactive system.
