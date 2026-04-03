---
title: v1000.1.1 → v1000.2.0
description: Migrating from Beacon v1000.1.1 to v1000.2.0
---

v1000.2.0 is a non-breaking minor release. All existing code works without changes.

## Custom equality functions

`state()` and `protectedState()` now accept an optional second argument — an equality function that replaces `Object.is` for the same-value check in `.set()`:

```typescript
state(initialValue, equalityFn?)
protectedState(initialValue, equalityFn?)
```

If omitted, behavior is identical to v1000.1.1 (`Object.is` comparison). The equality function receives the current value and the incoming value, and returns `true` if they should be considered equal (i.e., skip notification).

### Use cases

- **Deep equality for objects** — avoid notifications when a structurally identical object is set
- **Structural comparison for arrays** — compare by contents rather than reference
- **Domain-specific equivalence** — ignore irrelevant fields when deciding whether state changed

### Example

```typescript
import { state, effect } from '@nerdalytics/beacon'

const $user = state(
  { name: 'Ada', age: 36 },
  (a, b) => a.name === b.name && a.age === b.age
)

let runs = 0
effect(() => {
  $user()
  runs++
})
// runs = 1

// Structurally identical — no notification
$user.set({ name: 'Ada', age: 36 })
// runs = 1 (still)

// Different value — notifies
$user.set({ name: 'Grace', age: 36 })
// runs = 2
```

## Upgrade

```bash
npm install @nerdalytics/beacon@1000.2.0
```

No code changes required.
