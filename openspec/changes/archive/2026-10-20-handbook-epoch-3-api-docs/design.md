# Design

## Context

The handbook is a SvelteKit static site with per-version route trees (`handbook/src/routes/<version>/<page>/+page.md`). Navigation is composed by `buildNav(prefix, config)` in `handbook/src/lib/navigation.ts` (guides list at lines 41-72), where optional pages are gated by per-version `NavConfig` flags (`hasLens`, `hasSelect`, …) supplied by the version entries in `handbook/src/lib/versions.ts`. The llms endpoints (`llms.txt`, `llms-full.txt`, per-version variants) are generated from the same nav-driven page list via `getAllPages`, so navigation membership and machine-readable docs move together. Pages are mdsvex markdown with frontmatter, shiki-highlighted fences, and `VersionLink` for intra-version cross-references. Since the 2026-10-13 fixes, the handbook build is strict: any non-OK prerender response fails `BASE_PATH=/beacon npm run build`, and a missing page shows up as a build error rather than a silent gap. The epoch-3 library surface is specified in the main specs `openspec/specs/{async-derive,settle-observation,effect-scheduling}/spec.md` and implemented on branch `epoch-3-async-settle`.

## Goals / Non-Goals

**Goals:**
- Document the epoch-3 surface in the `latest` version tree: async derive semantics, the `schedule` effect option, `until`/`onSettled`, and v2000→v3000 migration notes.
- Place the new primitives on a dedicated `settle` page reachable from `latest` navigation only.
- Keep llms endpoints consistent automatically through the nav-driven page list.

**Non-Goals:**
- Editing `v2000.0.0` or older version trees (frozen epoch-2 semantics).
- Regrouping navigation, restyling pages, or adding non-documentation handbook features.
- Any change to library code, dependencies, or the root repo.

## Decisions

**D1 — New `settle` page behind a `hasSettle` nav flag.** `until`/`onSettled` are standalone primitives; they get `latest/settle/+page.md` plus a `hasSettle?: boolean` flag in `NavConfig` (default `false`) and a guides push in `buildNav`, mirroring the existing `hasLens` block (navigation.ts:67-72). `versions.ts` sets `hasSettle: true` on the `latest` entry only. Alternative considered: folding both primitives into the effects page — rejected because the effects page documents the reactive `effect` primitive, and imperative settle points have distinct semantics (timeout/abort/self-disposal) that deserve their own addressable page and llms entry.

**D2 — Async derive and schedule are sections on their primitives' pages.** `latest/derive/+page.md` gains an async-compute section; `latest/effects/+page.md` gains a scheduling section. These are extensions of existing primitives, not new ones; separate pages would fragment the derive/effects narrative.

**D3 — v3000 notes on `latest/migration`.** The per-version migration page is the established home for consumer-visible upgrade notes; the section states the additive `pending` field, async first-settle timing, and the schedule option, and repeats that sync behavior is unchanged.

**D4 — Example style.** Backend-flavored TypeScript fences (node-style usage, no framework code), shiki-highlighted as today; cross-page references use `VersionLink` so links stay version-correct; every example mirrors a scenario from the corresponding main spec to keep docs and behavior aligned.

**D5 — llms inclusion is free.** No separate llms work: `getAllPages` picks up `settle` once it is in the nav. The build gate asserts the built `latest/llms.txt` lists it.

**D6 — v3000 tree cut, latest demoted to alias (Denny's ruling, 2026-10-14).** `latest` is product-intent an alias for the newest version, not a parallel dev tree; the historical divergence (lens page surviving in `latest` after epoch-2 dropped it) was AI-generated drift, not design. The cut copies `latest` to `v3000.0.0` minus the dead `lens`/`select` pages, moves `current` in `versions.ts`, and replaces the `latest` tree with 308 redirect page routes plus proxy endpoints for `llms.txt`/`llms-full.txt`/`[page].md` — proxies because GitHub Pages cannot serve HTTP redirects for non-HTML paths, and redirect stubs for HTML match the existing root-redirect pattern. The `[version]` endpoints skip `latest` in `entries()` because the `/latest/[...rest]` catch-all outranks them for `/latest/*` URLs (kit route ranking: static segment beats param), which otherwise fails the build with `prerender_entry_generator_mismatch`.

**D7 — llms body builders extracted to `llm-docs.ts`.** `renderLlmsIndex`/`renderLlmsFull` are shared by the `[version]` endpoints and the `latest` proxies so alias content cannot drift from the versioned content.

## Risks / Trade-offs

- [Docs drift from implementation] → section wording tracks the main-spec requirement names; tasks assert built-HTML content (section keywords) rather than trusting prose review.
- [Nav flag leaks into old versions] → default `false` plus a build assertion that `v2000.0.0` pages contain no Settle nav item.
- [New page breaks prerender if mis-routed] → the strict build fails loudly on a missing route (post-#172 behavior), so a misnamed directory cannot ship silently.

## Migration Plan

Documentation-only change on a fresh branch off trunk; rollback is reverting the branch commits. No consumer-facing behavior changes; the library epoch PR remains unopened until these docs merge, per Denny's sequencing.
