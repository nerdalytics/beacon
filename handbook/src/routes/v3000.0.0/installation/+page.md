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
| Bun >= 1.3 | Compatible | Core reactivity works. Caveat: Bun's `deepStrictEqual` includes non-enumerable symbol properties on objects, unlike Node. If you compare a Beacon-wrapped array with `deepStrictEqual` on Bun, you will see internal symbols (`[[beacon_proxy]]`, `[[beacon_subscribers]]`) in the diff. This is a Bun deviation from Node's `assert` behavior, not a Beacon bug. |
| Deno >= 2.7 | Compatible | Core reactivity works. Caveat: Deno's `node:test` compat layer does not implement `afterEach`, so one test file fails to load. The reactive system itself runs correctly — the gap is in the test harness, not in Beacon. |

## Install

### npm

```bash
npm install @nerdalytics/beacon
```

### yarn

```bash
yarn add @nerdalytics/beacon
```

### pnpm

```bash
pnpm add @nerdalytics/beacon
```

### Bun

```bash
bun add @nerdalytics/beacon
```

### Deno

```bash
deno install npm:@nerdalytics/beacon
```

### JSR

```bash
npx jsr add @nerdalytics/beacon
```

### vlt

```bash
vlt install @nerdalytics/beacon
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

