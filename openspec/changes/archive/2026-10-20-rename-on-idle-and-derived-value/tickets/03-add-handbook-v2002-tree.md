# 03: Add the `v2002.0.0` handbook tree

**Area:** handbook

**Blocked by:** 02 (sequencing only: no shared files, serial run by request)

**What to build:** The handbook gets a new frozen route tree for v2002.0.0, copied from the v2001.0.1 tree, and the site serves it as the current version. The version list and its `latestSource`, the navigation config, the `/latest` page glob and the landing-page links point at the new tree, while v2001.0.1 keeps its own frozen navigation entry with its v2000 to v2001 migration label. The new tree's migration page covers v2001 to v2002 and names the three renames (`onSettled` to `onIdle`, `SettledCallback` to `IdleCallback`, `ComputedValue` to `DerivedValue`) with the note that timing and shape are unchanged. The LLM docs page's example URLs name the new version. Content inside the copied pages is otherwise unchanged in this ticket; the vocabulary pass is the next ticket.

- [x] A `v2002.0.0` route tree exists with the same pages as `v2001.0.1`, and `/latest` serves it
- [x] The version list marks v2002.0.0 as the source of `/latest` and keeps v2001.0.1 as a frozen entry
- [x] The navigation config has an entry for `/v2002.0.0` with the migration label "v2001.0.1 → v2002.0.0" and keeps the v2001.0.1 entry on its old label
- [x] The new tree's migration page describes the v2001 to v2002 upgrade with the three renames
- [x] The LLM docs page, `handbook/AGENTS.md` and `HOOKS_TODO.md` name `v2002.0.0` where they named `v2001.0.1` as the current tree
- [x] The new tree's landing page carries the package version 2002.0.0 in its npm and Socket links and its route-prefix fallback
- [x] `npm run check` and `npm run build` pass inside `handbook/`
