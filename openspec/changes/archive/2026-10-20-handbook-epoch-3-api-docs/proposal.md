# Proposal

## Why

The epoch-3 API (async `derive` with stale-while-pending `pending`, `until()`, `onSettled()`, per-effect `schedule: 'microtask'`, version 3000.0.0) is implemented on branch `epoch-3-async-settle` (7 commits, pushed, gates green) but the public handbook at nerdalytics.github.io/beacon still documents only v2000 semantics. Denny's sequencing holds the library PR until the handbook documents the new surface; this change adds that documentation to the handbook's `latest` version tree so the library PR can ship documented.

## What Changes

- New `latest/settle` page documenting `until()` and `onSettled()`, plus a nav entry gated by a new per-version `hasSettle` nav flag (same pattern as `hasLens`/`hasSelect` in `handbook/src/lib/navigation.ts` and `handbook/src/lib/versions.ts`).
- `latest/derive` page gains an async-compute section: promise-returning compute functions, stale-while-pending `value`/`pending` semantics, trackable `pending`, supersede-discard, rejection routing to the `onError` hook.
- `latest/effects` page gains a scheduling section: `schedule: 'microtask'` option, same-turn coalescing, batch-boundary precedence, and the explicit statement that the default `'sync'` preserves v2000 timing.
- `latest/migration` page gains v2000 → v3000 consumer-visible notes (new `pending` field, async derive first-settle timing, schedule option; sync behavior unchanged).
- `llms.txt` / `llms-full.txt` pick up the new page automatically because they are generated from the nav-driven page list (`getAllPages`).
- New `v3000.0.0` version tree cut from `latest` (excluding the dead `lens`/`select` pages, which document APIs the library has not shipped since v2000), marked `current` in `versions.ts` so the selector lists it.
- `latest` becomes a true alias of the current version: page routes redirect (308) to their `v3000.0.0` counterparts; `llms.txt`, `llms-full.txt`, and `[page].md` under `latest` proxy v3000 content, because static hosting cannot serve redirects for non-HTML paths.
- Version trees `v2000.0.0` and older remain untouched (frozen epoch-2 semantics).

## Capabilities

### New Capabilities
- `handbook-docs`: documentation coverage, navigation placement, and llms-endpoint inclusion for the epoch-3 API surface in the handbook's `latest` version.

### Modified Capabilities
- none — the three library capabilities (`async-derive`, `settle-observation`, `effect-scheduling`) already exist as main specs from the archived epoch-3 change; this change only documents them.

## Impact

- `handbook/src/lib/navigation.ts`: `NavConfig` gains `hasSettle`, `buildNav` gains the guides entry.
- `handbook/src/lib/versions.ts`: `latest` entry sets `hasSettle: true`.
- Markdown pages: `latest/settle/+page.md` (new), `latest/derive/+page.md`, `latest/effects/+page.md`, `latest/migration/+page.md` (sections added).
- No library code, no dependencies, no root-repo changes.
- Verification through the handbook's own gates: `svelte-check` and the strict prerender build (`BASE_PATH=/beacon npm run build`), asserting built HTML and llms output contain the new sections.
