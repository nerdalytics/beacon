---
title: v1000.2.5 → v1000.3.0
description: Migrating from Beacon v1000.2.5 to v1000.3.0
---

Internals decomposed into standalone functions for tree-shaking. One breaking change at the type level.

## Type imports

`Unsubscribe`, `ReadOnlyState`, `WriteableState`, and `State` are now `export type` only. If you import them as values, TypeScript (especially with `verbatimModuleSyntax`) will error.

```typescript
// v1000.2.5 — worked with regular import
import { State, Unsubscribe } from '@nerdalytics/beacon'

// v1000.3.0 — must use import type
import type { State, Unsubscribe } from '@nerdalytics/beacon'
// or
import { state, type State } from '@nerdalytics/beacon'
```

This applies to all four type exports: `State`, `ReadOnlyState`, `WriteableState`, `Unsubscribe`.

## Tree-shaking

Bundlers can now eliminate unused exports. If you only use `state` and `effect`, the code for `derive`, `batch`, `select`, and `lens` is excluded from the bundle. Works automatically with any tree-shaking-capable bundler.

## No runtime changes

All behavior is identical to v1000.2.5. Tests pass without modification. The eight function exports (`state`, `derive`, `effect`, `batch`, `select`, `lens`, `readonlyState`, `protectedState`) and four type exports (`State`, `ReadOnlyState`, `WriteableState`, `Unsubscribe`) are unchanged.

## Upgrade

```bash
npm install @nerdalytics/beacon@1000.3.0 --save-exact
```

Update any bare type imports to use `import type`. No other code changes required.
