# Tasks

## 1. Navigation plumbing

- [x] 1.1 Add `hasSettle?: boolean` to `NavConfig` and a guides push for `${prefix}/settle` (title `Settle`) in `buildNav`, mirroring the `hasLens` block, in `handbook/src/lib/navigation.ts`. Verify: `npm run check` in `handbook/` exits 0.
- [x] 1.2 Set `hasSettle: true` on the `latest` entry in `handbook/src/lib/versions.ts` (and only there). Verify: `npm run check` in `handbook/` exits 0.

## 2. Settle page

- [x] 2.1 Create `handbook/src/routes/latest/settle/+page.md` with frontmatter matching sibling pages, sections for `until(predicate, { timeout?, signal? })` (settled-truthy resolution, timeout and abort rejection, reactive-scope throw, self-disposal) and `onSettled(callback)` (quiescence notification, unsubscribe), each with a backend-flavored TypeScript example mirroring the settle-observation main spec scenarios. Verify: `BASE_PATH=/beacon npm run build` in `handbook/` exits 0 and the built settle HTML contains `until` and `onSettled` section anchors.

## 3. Derive and effects sections

- [x] 3.1 Add an async-compute section to `handbook/src/routes/latest/derive/+page.md`: promise-returning compute functions, stale-while-pending `value`/`pending`, trackable `pending`, supersede-discard, rejection routing to `onError`, with an example showing a `pending` guard. Verify: build exits 0 and built derive HTML contains `pending` and a supersede mention.
- [x] 3.2 Add a scheduling section to `handbook/src/routes/latest/effects/+page.md`: `schedule: 'sync' | 'microtask'`, same-turn coalescing, batch-boundary precedence, explicit synchronous-default statement, with a coalescing example. Verify: build exits 0 and built effects HTML contains `microtask` and the synchronous-default statement.

## 4. Migration notes

- [x] 4.1 Add a v2000 → v3000 section to `handbook/src/routes/latest/migration/+page.md`: new `pending` field, asynchronous first settle for async compute functions, new `schedule` option, and the unchanged-sync-behavior statement. Verify: build exits 0 and built migration HTML references `3000.0.0` and `pending`.

## 5. Full handbook and repo gates

- [x] 5.1 Run the complete handbook gate: `BASE_PATH=/beacon npm run build` exits 0 with zero 404/500 prerender lines; built HTML count equals the pre-change count plus one (the settle page); built `latest/llms.txt` contains a `/settle` entry; built `v2000.0.0` page HTML contains no Settle nav item. Verify: all four assertions hold in one build run.
- [x] 5.2 Run repo-level checks: `npm run check` at the repo root exits 0 (biome over handbook sources). Verify: exit 0.

## 6. v3000 version cut and latest alias (added per Denny's ruling 2026-10-14)

- [x] 6.1 Cut `handbook/src/routes/v3000.0.0/` from `latest`, excluding the dead `lens`/`select` pages; retitle its migration page to v2000 → v3000 and drop the older section; rewrite self-references (landing title, Get Started href, llms example URLs). Verify: build contains `v3000.0.0/introduction.html` whose nav includes Settle.
- [x] 6.2 Add the `v3000.0.0` entry to `versions.ts` with `current: true` (v2000.0.0 demoted) and a `versionConfigs` tuple in `navigation.ts` (`hasSettle: true`, migration `v2000.0.0 → v3000.0.0`), replacing the `/latest` tuple. Verify: selector options on a v2000 page include `/v3000.0.0`; v2000 nav has no Settle item.
- [x] 6.3 Replace the `latest` tree with alias routes: `+page.ts` and `[...rest]/+page.ts` 308 redirects to v3000 counterparts, plus `llms.txt`/`llms-full.txt`/`[page].md` proxy endpoints serving v3000 content via the extracted `renderLlmsIndex`/`renderLlmsFull` helpers; `[version]` llms endpoints skip `latest` in `entries()`. Verify: `build/latest/introduction.html` redirects to v3000; `build/latest/llms.txt` and `build/latest/state.md` exist with v3000 links; build exits 0 with zero 404/500 lines.
- [x] 6.4 Re-run all gates on the rebuilt branch: handbook `npm run check` 0 errors 0 warnings (SW side project type-checked via `tsc --noEmit`), root `npm run check` exit 0, strict build exit 0 with 249 HTML files. Verify: cited exit codes and counts.
  - Note: root check on trunk was already red before this change (lint debt merged via #171: untyped params and import order in `handbook/vite.config.ts` and `handbook/src/routes/llms.txt/+server.ts`, formatter diff in `handbook/src/lib/llm-docs.ts`). This branch carries the identical fixes from `epoch-3-async-settle` commit `04cdac9` so the gate holds here; the hunks converge to no-ops when epoch-3 merges.
