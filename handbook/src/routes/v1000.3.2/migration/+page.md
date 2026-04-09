---
title: v1000.3.1 → v1000.3.2
description: Migrating from Beacon v1000.3.1 to v1000.3.2
---

No API changes. No breaking changes. Drop-in upgrade.

This release adds a proto-key denylist to lens path extraction. The public interface, behavior, and type signatures are identical to v1000.3.1.

## What changed

`lens()` now rejects `__proto__`, `constructor`, and `prototype` as path segments. If an accessor traverses one of these keys, the lens treats the path as invalid and silently ignores writes. Reads still reflect the source value.

The guard runs once during path extraction via a `tainted` flag in the Proxy trap. When a dangerous key appears at any depth in the path, the entire path is discarded, not just the offending segment.

`lensSet` checks for an empty path and returns early, making the write a no-op. `lensUpdate` delegates to `lensSet`, so both write methods are covered.

## Why

Prototype pollution through `constructor.prototype` is a known attack vector with multiple CVEs in libraries like lodash, protobuf.js, and tree-kit. Beacon's spread-then-assign pattern in `setValueAtPath` is safe on current V8, but that safety comes from engine behavior, not explicit guards. The denylist makes the safety explicit.

## Upgrade

```bash
npm install @nerdalytics/beacon@1000.3.2 --save-exact
```

No code changes required unless your code intentionally accessed `__proto__`, `constructor`, or `prototype` through lens paths, which would be a bug.
