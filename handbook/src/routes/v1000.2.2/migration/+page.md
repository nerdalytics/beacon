---
title: v1000.2.1 → v1000.2.2
description: Migrating from Beacon v1000.2.1 to v1000.2.2
---

v1000.2.1 → v1000.2.2. `Unsubscribe` type is now exported. You can import it for explicit typing of effect cleanup functions. `STATE_ID` is now a named unique symbol.

## Exported `Unsubscribe` type

The `Unsubscribe` type was previously internal-only. It is now a named export:

```typescript
import { type Unsubscribe, state, effect } from '@nerdalytics/beacon'

const $count = state(0)
const unsubscribe: Unsubscribe = effect(() => {
  console.log($count())
})
```

This is additive — existing code that infers the type continues to work.

## Named `STATE_ID` symbol

`STATE_ID` changed from `Symbol()` to `Symbol('STATE_ID')` with a `unique symbol` type. This improves debuggability — the symbol now has a description visible in stack traces and console output. No behavioral change.

## Minor formatting changes

- `protectedState` return type formatting adjusted
- Batch internals formatting changes

No behavioral impact.

## Upgrade

```bash
npm install @nerdalytics/beacon@1000.2.2
```

No code changes required.
