---
title: v1000.2.1 → v1000.2.2
description: Migrating from Beacon v1000.2.1 to v1000.2.2
---

`Unsubscribe` type is now a named export. `STATE_ID` is a named unique symbol for better debuggability. Internal refactors reduce memory usage per reactive instance.

## Exported `Unsubscribe` type

Previously internal-only. Now a named export you can use for explicit typing:

```typescript
import { type Unsubscribe, state, effect } from '@nerdalytics/beacon'

const $count = state(0)
const unsubscribe: Unsubscribe = effect(() => {
  console.log($count())
})
```

Additive change. Existing code that infers the type works without modification.

## Named `STATE_ID` symbol

`STATE_ID` changed from `Symbol()` to `Symbol('STATE_ID')` with a `unique symbol` type. The description is visible in stack traces and console output. No behavioral change.

## Performance improvements

`derive`, `select`, and `lens` internals were refactored to use a container pattern that minimizes closure variable captures. This reduces memory allocation per reactive instance. Comments are also stripped from the shipped source before publishing, reducing package size further.

No behavioral changes. All existing code works without modification.

## Upgrade

```bash
npm install @nerdalytics/beacon@1000.2.2 --save-exact
```

No code changes required.
