---
title: v1000.1.0 → v1000.1.1
description: Migrating from Beacon v1000.1.0 to v1000.1.1
---

v1000.1.1 is a patch release with no API changes.

## Package entry point fix

The `main` and `types` fields in `package.json` were corrected from `dist/index.js` to `dist/src/index.js`. This fixes module resolution for consumers that rely on these fields rather than the `exports` map.

If your bundler or runtime resolved Beacon correctly in v1000.1.0, this patch has no effect on your code.

## Upgrade

```bash
npm install @nerdalytics/beacon@1000.1.1 --save-exact
```

No code changes required.
