---
title: v1000.2.0 → v1000.2.1
description: Migrating from Beacon v1000.2.0 to v1000.2.1
---

No API changes. No breaking changes. Drop-in upgrade.

## Build pipeline changes

The published package now ships a minified `dist/src/index.min.js` as the main entry point, produced by uglify-js. The `main` field in `package.json` points to the minified file, and the `exports` field was updated for correct TypeScript/JS interop. The result is a smaller installed package size.

These are packaging-level changes only. No application code needs to change.

## Upgrade

```bash
npm install @nerdalytics/beacon@1000.2.1 --save-exact
```

No code changes required.
