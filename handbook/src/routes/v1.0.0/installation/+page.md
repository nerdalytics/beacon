---
title: Installation
description: Install Beacon and set up your project
---

## Requirements

- **Node.js** >= 20.0.0 (LTS v20 or v22)
- **TypeScript** >= 5.x (recommended, not required)

## Install

```bash
npm install @nerdalytics/beacon
```

## Project setup

### package.json

Beacon is an ESM package. Your project must use `"type": "module"`:

```json
{
  "type": "module"
}
```

### tsconfig.json (recommended)

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "verbatimModuleSyntax": true
  }
}
```

## Verify installation

```typescript
import { state, effect } from '@nerdalytics/beacon'

const $count = state(0)
effect(() => console.log($count()))
// => 0

$count.set(1)
// => 1
```

If you see `0` then `1` printed, Beacon is working.
