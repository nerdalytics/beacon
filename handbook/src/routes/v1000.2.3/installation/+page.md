---
title: Installation
description: Install Beacon and set up your project
---

## Requirements

- Node.js 20.0.0 or later (LTS v20 or v22)
- TypeScript 5.x recommended, not required

## Install

```bash
npm install @nerdalytics/beacon --save-exact
```

## Project setup

Beacon ships as ESM. Set `"type": "module"` in your `package.json`:

```json
{
  "type": "module"
}
```

For TypeScript, these compiler options work well with Beacon:

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

## Verify

```typescript
import { state, derive, effect } from '@nerdalytics/beacon'

const $count = state(0)
const $doubled = derive(() => $count() * 2)

effect(() => console.log($doubled()))
// => 0

$count.set(1)
// => 2
```

If you see `0` then `2`, the installation is correct.
