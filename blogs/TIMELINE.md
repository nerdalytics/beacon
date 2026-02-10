# Beacon Git Timeline

Reference document for blog series. Organized by epoch with dates, commits, tags, and PRs.

---

## Epoch 0 — Genesis (v1.0.0)

**Duration**: March 30 — April 1, 2025 (3 days)
**Tag**: `1.0.0` (2025-04-01)
**API**: Function-based. `state(0)`, `count()` to read, `count.set(5)` to write.

All core primitives built on a single day (March 30th). Published two days later.

| Date | Hash | Commit |
|------|------|--------|
| 2025-03-30 | `976465e` | epoch(core): initial project structure and state implementation |
| 2025-03-30 | `f920eff` | feat(effect): add effect implementation |
| 2025-03-30 | `797c0c5` | feat(core): add cleanup and cyclic dependency handling |
| 2025-03-30 | `abbe469` | feat(batch): implement batch operations and enhance documentation |
| 2025-03-30 | `8b15fc2` | chore(docs): add contribution docs |
| 2025-03-30 | `2f4e5e9` | feat(perf): add performance documentation generator script |
| 2025-04-01 | `321e76c` | chore(tooling): extend biome.json config to include scripts and tests |
| 2025-04-01 | `d547130` | style: apply biome formatting to src, scripts, and tests |
| 2025-04-01 | `af3f172` | style(test): fix Biome.js lint warnings in test files |
| 2025-04-01 | `c26a416` | chore(deps): update dependencies |
| 2025-04-01 | `2a321a7` | build: configure npm publishing and target Node LTS 20 |

**Tag `1.0.0` applied here.**

---

## Epoch 1 — Function-Based Era (v1000.0.0 — v1000.3.0)

**Duration**: April 1, 2025 — February 9, 2026 (~10 months)
**Tags**: `1000.0.0` through `1000.3.0`
**API**: Function-based, expanded with selector, lens, readonlyState, protectedState, custom equality.

### Phase 1: Feature Expansion (April 2025)

| Date | Hash | Commit | PR | Tag |
|------|------|--------|----|-----|
| 2025-04-01 | `83b3a35` | test: fix cyclic dependency handling tests | | |
| 2025-04-01 | `625acf7` | test: add update function tests | | |
| 2025-04-01 | `66d3f8d` | chore: add GitHub repository url | | |
| 2025-04-01 | `b18f2b0` | chore: replace markdown link with a-tag | | |
| 2025-04-01 | `4173725` | **feat(selector): add selector primitive** | | |
| 2025-04-02 | `3ae4f4f` | style: apply biome formatting | | |
| 2025-04-02 | `cd229ff` | chore: add selector test script | | |
| 2025-04-09 | `f1ec586` | chore(deps): update dependencies | #1 | |
| 2025-04-09 | `ac1287c` | dt-branch-2 | #2 | |
| 2025-04-09 | `9cf10f6` | chore(ci): add caching dependencies workflow | #3 | |
| 2025-04-09 | `a1686ff` | chore(docs): improve README.md | #5 | |
| 2025-04-09 | `8803f1b` | chore(ci): add build project workflow | #4 | |
| 2025-04-10 | `15e3a24` | chore(ci): separate build and test | | |
| 2025-04-10 | `0f09af8` | chore(ci): add Node.js v23 to version matrix | | |
| 2025-04-10 | `e0e37cf` | **epoch(core): complete rewrite of the library** | #6 | `1000.0.0` |
| 2025-04-10 | `a2145d9` | chore: update .gitignore | | |
| 2025-04-11 | `3edd3c4` | feat(release): bump version to 1000.1.0 | #8 | `1000.1.0` |
| 2025-04-11 | `7ca1d98` | chore(ci): ensure publish only on push to trunk | | |
| 2025-04-11 | `fe5fd92` | fix(release): bump version to 1000.1.1 | | `1000.1.1` |
| 2025-04-12 | `f6515a7` | chore(docs): update import statements | | |
| 2025-04-12 | `ef320ae` | chore(docs): use spaces in import section | | |
| 2025-04-12 | `572bb4c` | chore(docs): restructure and rewrite README.md | #11 | |
| 2025-04-12 | `16d05d6` | chore(docs): make badges clickable | #12 | |
| 2025-04-13 | `952939a` | **feat: add custom equality function support** | #13 | `1000.2.0` |
| 2025-04-14 | `21f004d` | perf: add minification and improve package config | #15 | `1000.2.1` |

### The Quiet Period (May — September 2025)

No commits for ~6 months. Library in use (CLI script, SQLite project).

### Phase 2: Return and Maintenance (October 2025)

PR #17 opened and closed without merge — "perf: use container objects to improve memory usage" (2025-10-22). Reorganized createDerive, createSelect, createLens to container pattern. Rejected.

| Date | Hash | Commit | PR | Tag |
|------|------|--------|----|-----|
| 2025-10-23 | `190a4f9` | **perf: refactor state functions to reduce closure variable capture** | | `1000.2.2` |
| 2025-10-23 | `11876e3` | fix: typo in setup-node action version | #19 | |
| 2025-10-23 | `6948661` | Fix re include index.ts in published npm package | #21 | `1000.2.3` |
| 2025-10-23 | `1af926f` | chore: update socket badge version in README.md | #23 | |

**Tag `latest` pointed at `1000.2.3` (2025-10-23).**

### Phase 3: Late-Stage Optimization (January — February 2026)

This phase overlaps with early Epoch 2 work on the `epoch-2` branch.

| Date | Hash | Commit | PR | Tag |
|------|------|--------|----|-----|
| 2026-01-27 | `af1d565` | chore: update tooling and enforce consistent line endings | #24 | |
| 2026-01-27 | `72bac2e` | **perf: optimize notification and batch processing** | #25 | `1000.2.4` |
| 2026-01-27 | `e2a7ab3` | chore(readme): slim down README and update badge | #27 | `1000.2.5` |
| 2026-01-27 | `f2609d9` | Pin GitHub Actions to SHA and add weekly version checker | #29 | |
| 2026-01-27 | `7a0e7e1` | Fix action version checker regex self-matching | #30 | |
| 2026-01-28 | `74441d8` | fix(workflows): handle arithmetic exit code and create missing labels | #31 | |
| 2026-01-28 | `ef855b1` | Update GitHub Actions workflow for version checks | #32 | |
| 2026-02-08 | `cb74ce1` | **Decompose StateImpl class for tree-shaking** | #35 | `1000.3.0` |
| 2026-02-08 | `77d9c67` | fix(ci): migrate npm publish to OIDC trusted publishing | #37 | |
| 2026-02-09 | `244179c` | perf(core): add multi-cycle benchmark with aggregated results | #38 | |

### Epoch 1 Unmerged PRs

| PR | Date | Title | Reason |
|----|------|-------|--------|
| #17 | 2025-10-22 | perf: use container objects to improve memory usage | Closed without merge |
| #34 | 2026-02-08 | perf(core): add benchmark suite | Closed without merge (superseded by #38) |

---

## Epoch 2 — Proxy-Based Era (v2000.0.0)

**Duration**: February 2, 2026 — present
**Branch**: `epoch-2` (not yet merged to trunk, no npm release)
**API**: Proxy-based. `state({ count: 0 })`, `signal.count` to read, `signal.count = 5` to write.
**Removed**: select, lens, readonlyState, protectedState

### Day 1: The Migration (February 2, 2026)

The entire Proxy migration, test rewrite, docs update, and hooks roadmap landed in one day.

| Date | Hash | Commit |
|------|------|--------|
| 2026-02-02 | `fe902d0` | **refactor(core): migrate to Proxy-based reactive API** |
| 2026-02-02 | `5205fd5` | test: remove legacy test files for deprecated APIs |
| 2026-02-02 | `b63f188` | test: add reorganized test suite for Proxy-based API |
| 2026-02-02 | `1acf136` | chore(assets): replace PNG logos with optimized SVG |
| 2026-02-02 | `c2f6efb` | docs: update documentation for v2000.0.0 Proxy-based API |
| 2026-02-02 | `c7558d2` | chore: update CI workflows and consolidate scripts |
| 2026-02-02 | `1e7e9b0` | docs: add hooks documentation and roadmap |

### Documentation Polish (February 4, 2026)

| Date | Hash | Commit |
|------|------|--------|
| 2026-02-04 | `e2ca3a5` | docs(batch,derive,core): clarify batch optimization scope |
| 2026-02-04 | `e2b712d` | docs: add AGENTS.md/CLAUDE.md hierarchy and whitelist .md |

### Hooks Infrastructure (February 5, 2026)

All hooks built and merged in a single day.

| Date | Hash | Commit |
|------|------|--------|
| 2026-02-05 | `11094f5` | chore: bump version in badge |
| 2026-02-05 | `6c3ed14` | chore: bump version in package.json |
| 2026-02-05 | `0dde658` | **feat(core): add hook type interfaces** |
| 2026-02-05 | `e01b205` | **feat(core): add hook composition utility** |
| 2026-02-05 | `e1d1efb` | chore(core): add hooks subpath export and package config |
| 2026-02-05 | `25f7816` | **feat(core): add hooks plumbing — symbol, types, composeHookInline** |
| 2026-02-05 | `b5081fb` | **feat(state): add state hooks — onRead, onWrite, onDelete, onHas, onOwnKeys** |
| 2026-02-05 | `256ed7b` | **feat(effect): add effect hooks — onRun, onDispose, onError, onDependencyAdd, onSchedule** |
| 2026-02-05 | `0966faf` | **feat(batch): add batch hooks — onBatchStart, onBatchEnd, onBatchError** |
| 2026-02-05 | `88f510e` | **feat(derive): add derive hooks — onCompute, onCacheHit, onDispose, onError, onDependencyChange** |
| 2026-02-05 | `a276f3a` | style(core): fix lint and formatting across hooks files |
| 2026-02-05 | `364b127` | chore: update CLAUDE.md symlink and add bun to mise.toml |
| 2026-02-05 | `ecc6382` | chore: bump biome, @types/node, npm-check-updates, and npm |
| 2026-02-05 | `321b331` | Merge branch 'feat/hooks-infrastructure' into epoch-2 |

### Hooks Documentation (February 6, 2026)

| Date | Hash | Commit |
|------|------|--------|
| 2026-02-06 | `35d643d` | docs(core): add AGENTS.md for hooks module and update indexes |
| 2026-02-06 | `5cd7b76` | docs(core): add hooks API reference |
| 2026-02-06 | `1d97c24` | docs(core): update index with hooks link, remove version |
| 2026-02-06 | `5bcd940` | docs(state): fix signatures, typos, add hooks link |
| 2026-02-06 | `7fd5f53` | docs(effect): add API reference with hooks parameter |
| 2026-02-06 | `d4858c9` | docs(derive): fix API, replace dispose() with reactive toggle |
| 2026-02-06 | `5bab5c5` | docs(batch): fix execution flow, add API reference with hooks |
| 2026-02-06 | `7770ac4` | docs(core): fix architecture details, remove batchDirtyTargets, add hooks |
| 2026-02-06 | `32464e5` | docs(core): rewrite debugging guide around hooks system |
| 2026-02-06 | `e9ddbf8` | docs(core): add hooks to AGENTS.md index |
| 2026-02-06 | `e44c1ef` | docs(core): add hooks to root AGENTS.md index |
| 2026-02-06 | `a80e256` | docs(core): update root AGENTS.md |
| 2026-02-06 | `8cbd653` | chore(assets): slim root README, move full content to .github/ |
| 2026-02-06 | `6d1233d` | docs(readme): update TC39 comparison with current proposal status |

### Performance Optimization — Phase 1 (February 6-7, 2026)

Benchmark script added, then individual optimizations tested.

| Date | Hash | Commit |
|------|------|--------|
| 2026-02-06 | `964b203` | perf(core): add structured benchmark script |
| 2026-02-06 | `5ced3d1` | perf(core): batch subscriber short-circuit |
| 2026-02-06 | `e17308b` | perf(core): replace activeEffects Set with boolean flag |
| 2026-02-06 | `fe255fc` | Merge branch 'perf/opt-3-effect-reentry-flag' into perf/combo-1-3 |
| 2026-02-06 | `f2ec8ae` | perf(core): stable dependency skip for effect re-runs |
| 2026-02-06 | `b8fce4d` | perf(core): deferred subscriber registration for stable deps |
| 2026-02-06 | `c287769` | perf(core): batch-specific set trap with deferred scheduling |
| 2026-02-06 | `964776f` | Merge branch 'perf/opt-8-batch-set-trap' into perf/combo-6-8 |

### Code Quality & Refactoring (February 7, 2026)

| Date | Hash | Commit |
|------|------|--------|
| 2026-02-07 | `bf26604` | docs(core): update internals docs for perf optimizations |
| 2026-02-07 | `a46f8b8` | chore(core): exclude .claude directory from Biome checks |
| 2026-02-07 | `05538c8` | chore(core): add cognitive complexity and top-level regex Biome rules |
| 2026-02-07 | `8340df0` | refactor(core): reduce cognitive complexity to threshold 4 |
| 2026-02-07 | `6630a14` | chore(core): exclude tests directory from build tsconfig |
| 2026-02-07 | `fc7d371` | chore(core): sync package-lock version to 2000.0.0 |
| 2026-02-07 | `84f87e4` | refactor(core): import composeHook from hooks module |
| 2026-02-07 | `ff82bd9` | refactor(core): improve internal variable and function naming |
| 2026-02-07 | `80be5d8` | docs(core): rewrite src/AGENTS.md for decomposed architecture |

### Performance Optimization — Phase 2-3 (February 7, 2026)

| Date | Hash | Commit |
|------|------|--------|
| 2026-02-07 | `5a36c34` | chore(core): raise cognitive complexity threshold to 20 for perf work |
| 2026-02-07 | `b5f11e5` | perf(core): remove dead unwrapIfObject/tryUnwrap identity functions |
| 2026-02-07 | `b95825f` | perf(core): replace spread syntax with direct assignment |
| 2026-02-07 | `d21be82` | perf(core): merge registerEffectRead/trackReadSilently into recordEffectRead |
| 2026-02-07 | `6339adb` | perf(core): reuse module-level array in runPendingEffectBatch |
| 2026-02-07 | `c7a6641` | perf(core): skip tracking reallocation when deps are stable |
| 2026-02-07 | `1b08737` | docs(core): record Phase 1 performance optimization results |
| 2026-02-07 | `5c1428a` | perf(core): optimize batch flush function group |
| 2026-02-07 | `86b20f5` | **Revert** "perf(core): optimize batch flush function group" |
| 2026-02-07 | `7a08349` | perf(core): optimize cleanup functions — replace spreads with loops |
| 2026-02-07 | `fbe6fb4` | perf(core): add reference-equality fast paths in dep comparison |
| 2026-02-07 | `97e91ad` | perf(core): cache symbol property access in getSubscribers |
| 2026-02-07 | `2f7faa1` | perf(core): merge Phase 2+3 combined optimizations |
| 2026-02-07 | `4fa6836` | docs(core): record Phase 2-3 performance optimization results |
| 2026-02-07 | `7b606f9` | perf(core): replace hot-path WeakMaps with direct property access |
| 2026-02-07 | `742c21c` | Merge origin/trunk into epoch-2 |
| 2026-02-07 | `dfd4c20` | fix(core): enable LTS test compilation and fix pre-hook naming |
| 2026-02-07 | `72754a9` | refactor(core): remove unused MAX_BATCH_DEPTH constant |
| 2026-02-07 | `4d9e99c` | perf(core): optimize batch path and subscriber-less early exit |
| 2026-02-07 | `700a8c6` | style(core): format lean get handler condition |

### Performance Optimization — Final Push (February 8-9, 2026)

| Date | Hash | Commit |
|------|------|--------|
| 2026-02-08 | `9a5f2ae` | perf(core): restore and enhance epoch-2 benchmark suite |
| 2026-02-09 | `678e18c` | perf(core): add heap memory reporting to benchmark and enable GC |
| 2026-02-09 | `a560c54` | perf(core): add multi-cycle benchmark with aggregated results |
| 2026-02-09 | `a3b3605` | perf(core): optimize flush pipeline with single-effect fast path |
| 2026-02-09 | `dc34773` | perf(core): optimize batch path with Array.isArray removal and hookless fast path |
| 2026-02-09 | `c0b7da0` | perf(effect): add readList fast path for stable dependency re-runs |
| 2026-02-09 | `3a07c74` | perf(core): inline no-subscriber write path in set handler |
| 2026-02-09 | `b6dc865` | perf(core): shared singleton handler for hookless states |

### Quality Hardening — Property-Based Testing (February 10, 2026)

| Date | Hash | Commit |
|------|------|--------|
| 2026-02-10 | `1cb1e8c` | test(state): PBT for reactive array mutations |
| 2026-02-10 | `aa6ca86` | test(state): PBT for same-value optimization |
| 2026-02-10 | `a27e83d` | test(batch): PBT for batch effect deduplication |
| 2026-02-10 | `68ce486` | test(derive): PBT for derive consistency |
| 2026-02-10 | `f15aa0d` | test(state): PBT for proxy identity invariants |
| 2026-02-10 | `4d82e74` | test(effect): PBT for cleanup completeness |
| 2026-02-10 | `3656995` | test(effect): PBT for infinite loop detection boundary |
| 2026-02-10 | `e3d6b99` | test(state): PBT for deep reactivity at arbitrary depths |
| 2026-02-10 | `6605917` | test(batch): PBT for batch error recovery |
| 2026-02-10 | `1835804` | test(effect): PBT for dynamic dependency tracking |
| 2026-02-10 | `eb82130` | test(state): PBT for frozen/sealed object reactivity |
| 2026-02-10 | `d77519f` | test(state): real-use-case PBT for frozen children of reactive state |

### Docs & Build Polish (February 10, 2026)

| Date | Hash | Commit |
|------|------|--------|
| 2026-02-10 | `1f38334` | docs(readme): tighten prose — cut filler, fix passive voice |
| 2026-02-10 | `3a545b5` | docs(core): tighten prose in TECHNICAL_DETAILS, DEVELOPER_GUIDE, CONTRIBUTING |
| 2026-02-10 | `67476cf` | Merge origin/trunk into epoch-2 |
| 2026-02-10 | `ceec15b` | chore(core): add esbuild, tighten cognitive complexity limit |
| 2026-02-10 | `6a52ec8` | fix(core): narrow handler factory return types for exactOptionalPropertyTypes |
| 2026-02-10 | `f764dcf` | fix(test): add noUncheckedIndexedAccess narrowing to PBTs |
| 2026-02-10 | `8a85245` | chore(core): replace uglify-js with esbuild, fix biome scripts |

---

## Tag Timeline

| Tag | Date | Hash | Notes |
|-----|------|------|-------|
| `1.0.0` | 2025-04-01 | `c4a73b3` | Epoch 0. First publish. Function-based. |
| `1000.0.0` | 2025-04-10 | `6aa45e4` | Epoch 1. Complete rewrite. Still function-based. |
| `1000.1.0` | 2025-04-11 | `7ca1d98` | Release packaging fixes |
| `1000.1.1` | 2025-04-11 | `fe5fd92` | Version bump fix |
| `1000.2.0` | 2025-04-13 | `952939a` | Custom equality function support |
| `1000.2.1` | 2025-04-14 | `21f004d` | Minification, package config |
| `1000.2.2` | 2025-10-23 | `190a4f9` | Perf: reduce closure variable capture |
| `1000.2.3` | 2025-10-23 | `6948661` | Fix: re-include index.ts in npm package |
| `1000.2.4` | 2026-01-27 | `72bac2e` | Perf: optimize notification and batch processing |
| `1000.2.5` | 2026-01-27 | `e2a7ab3` | Readme update |
| `1000.3.0` | 2026-02-08 | `cb74ce1` | Decompose StateImpl for tree-shaking |
| `latest` | 2025-10-23 | `6948661` | Points to 1000.2.3 |

---

## PR History (Closed)

All PRs targeted `trunk` unless noted.

| PR | Merged | Branch | Title |
|----|--------|--------|-------|
| #1 | 2025-04-08 | dt-branch-1 | chore(deps): update dependencies |
| #2 | 2025-04-08 | dt-branch-2 | dt-branch-2 |
| #3 | 2025-04-09 | nerdalytics-patch-1 | chore(ci): add caching dependencies workflow |
| #4 | 2025-04-09 | nerdalytics-patch-1 | chore(ci): add build project workflow |
| #5 | 2025-04-09 | nerdalytics-patch-2 | chore(docs): improve README.md |
| #6 | 2025-04-10 | nerdalytics-patch-1 | **epoch(core): complete rewrite of the library** |
| #8 | 2025-04-11 | nerdalytics-patch-1 | feat(release): bump version to 1000.1.0 |
| #9 | 2025-04-11 | nerdalytics-patch-2 | fix(release): include js and d.ts in published package |
| #11 | 2025-04-12 | nerdalytics-patch-3 | chore(docs): restructure and rewrite README.md |
| #12 | 2025-04-12 | nerdalytics-patch-4 | chore(docs): make badges clickable |
| #13 | 2025-04-13 | nerdalytics-patch-8 | **feat: add custom equality function support** |
| #15 | 2025-04-14 | nerdalytics-patch-9 | perf: add minification and improve package config |
| #17 | **not merged** | nerdalytics-patch-4 | perf: use container objects to improve memory usage |
| #18 | 2025-10-23 | nerdalytics-patch-4 | Nerdalytics patch 4 |
| #19 | 2025-10-23 | fix-publish-action-dependency | fix: typo in setup-node action version |
| #21 | 2025-10-23 | fix-re-include-index.ts-in-published-npm-package | Fix: re-include index.ts in npm package |
| #23 | 2025-10-23 | fix-socket.dev-badge-link | chore: update socket badge version |
| #24 | 2026-01-27 | chore/update-tooling | chore: update tooling and enforce consistent line endings |
| #25 | 2026-01-27 | perf/optimize-notification-batch-allocations | **perf: optimize notification and batch processing** |
| #27 | 2026-01-27 | chore/update-readme | chore(readme): slim down README and update badge |
| #29 | 2026-01-27 | security/pin-actions-and-add-version-checker | Pin GitHub Actions to SHA and add weekly version checker |
| #30 | 2026-01-27 | fix/action-version-checker-regex | Fix action version checker regex self-matching |
| #31 | 2026-01-28 | fix/action-checker-bugs | Fix action checker: arithmetic exit code and missing labels |
| #32 | 2026-01-28 | feat/ci-auto-pr-for-outdated-actions | Update GitHub Actions workflow for version checks |
| #34 | **not merged** | feat/benchmark-suite | perf(core): add benchmark suite |
| #35 | 2026-02-08 | feat/tree-shaking | **Decompose StateImpl class for tree-shaking** |
| #37 | 2026-02-08 | fix/npm-trusted-publishing | fix(ci): migrate npm publish to OIDC trusted publishing |
| #38 | 2026-02-09 | perf/multi-cycle-benchmark | perf(core): add multi-cycle benchmark with aggregated results |

---

## Key Observations for Blog Timeline

1. **Epoch 0 lasted 3 days** — March 30 to April 1, 2025. Then immediately superseded.
2. **The April burst** — From April 1-14, 2025: selector, complete rewrite, custom equality, minification. Intense two weeks.
3. **6-month quiet period** — April 14 to October 23, 2025. Library in production use.
4. **October return** — Brief maintenance burst. PR #17 (container objects for memory) rejected.
5. **January 2026 — v1000 late optimization** — Tooling updates, notification/batch perf, tree-shaking decomposition. Opus-assisted.
6. **February 2, 2026 — Epoch 2 begins** — Proxy migration, test rewrite, docs, hooks roadmap all in one day.
7. **February 5 — Hooks in one day** — All four primitives get hooks infrastructure.
8. **February 6-7 — Performance sprint** — Benchmark script, three optimization phases, one revert.
9. **February 8-9 — Final perf push** — Benchmark hardening, last optimizations.
10. **February 10 — Quality hardening** — 12 property-based tests, docs prose, build tooling.
11. **Epoch 2 not yet released** — No v2000.x tags. Branch not merged to trunk.
12. **Trunk and epoch-2 developed in parallel** — Two trunk merges into epoch-2 (Feb 7, Feb 10). v1000 releases continued during epoch-2 work.
