---
title: v1000.2.2 → v1000.2.3
description: Migrating from Beacon v1000.2.2 to v1000.2.3
---

The TypeScript source file (`index.ts`) is back in the published npm package. The unneeded compiled `dist/src/index.js` has been removed.

## Package contents

Two packaging fixes:

- **`index.ts` re-included.** It had been accidentally excluded from the npm tarball. Editor go-to-definition works again for consumers who rely on the source TypeScript.
- **`dist/src/index.js` removed.** Only the minified `dist/src/index.min.js` ships for runtime. The unminified compiled output was unnecessary weight.

Net result: source TypeScript for tooling, minified JS for runtime. Nothing else changed.

## Upgrade

```bash
npm install @nerdalytics/beacon@1000.2.3 --save-exact
```

No code changes required.
