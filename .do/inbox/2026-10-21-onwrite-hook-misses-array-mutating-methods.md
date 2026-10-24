# `onWrite` hook never sees array mutating methods on hooked state

**Category:** bug
**Status:** ready-for-agent
**Change:** wrap-array-methods-on-hookless-state

Observed on 2026-10-21 while triaging the hookless array wrap issue, on trunk `cbd7448`. A state created with an `onWrite` hook reports a direct index write but not a `push`. Reproduction: `const s = state({ a: [] }, { onWrite: (p, o, n) => writes.push(...) }); s.a.push(1); s.a[1] = 2` recorded only `"1: undefined -> 2"`. Cause: the wrapper that hooked state installs for `push`, `pop`, `shift`, `unshift`, `splice`, `sort` and `reverse` applies the original method to the raw target, so the Proxy set trap and the write hook never run for the elements and the `length` the method changes. The handbook describes hooks as the way to observe every lifecycle; a user who logs writes with `onWrite` does not see array mutations. Related to `2026-10-21-hookless-state-skips-array-method-wrap.md`, whose Q24 decision gives hookless state the same wrapper, which would extend this gap to nothing new but should be known when that brief is written.

## Agent brief

**Summary:** Fixed by the brief in `2026-10-21-hookless-state-skips-array-method-wrap.md`; this file carries no separate work.

**Current behavior:** see the report above.

**Desired behavior:** on hooked state, `onRead` sees the reads and `onWrite` sees each write a mutating array method performs, with the same arguments a direct property access produces. That is the fourth bullet of the array wrap brief's desired behavior and its fifth acceptance criterion.

**Key interfaces:** as in the array wrap brief.

**Acceptance criteria:**
- [ ] The array wrap change's hook test passes.

**Out of scope:** everything else; propose the array wrap issue, not this one, and give both files the same `**Change:**` line.
