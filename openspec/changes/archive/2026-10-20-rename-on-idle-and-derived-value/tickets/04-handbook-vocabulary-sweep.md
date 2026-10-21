# 04: Handbook vocabulary sweep in the `v2002.0.0` tree

**Area:** handbook

**Blocked by:** 03

**What to build:** Every page in the v2002.0.0 tree documents the renamed API and uses the glossary's words. `onIdle` and `IdleCallback` replace the old notification names in the settle, introduction, derive and effects pages; `DerivedValue` replaces `ComputedValue` in the derive, hooks-api and hooks-overview pages. Prose says "derived value" not "computed value", "pending" not "in flight", "idle" not "quiet", "quiescence" or "convergence" for the graph, and introduces `until` and `onIdle` without the phrase "settle points". The architecture page's infinite-loop example no longer names its state object `signal`. The introduction's sentence relating Beacon to frontend signals and observables stays, since the glossary allows the word when relating Beacon to other libraries. Frozen trees are untouched.

- [x] No page in the v2002.0.0 tree other than the migration page contains `onSettled`, `SettledCallback` or `ComputedValue`
- [x] The settle page has an `onIdle` section whose behavior notes (callback writes, runaway callbacks) keep their current content under the new name, and its description no longer says "convergence"
- [x] No page in the v2002.0.0 tree says "computed value", "in flight", "quiescence", "goes quiet" or "settle points"
- [x] The architecture page's infinite-loop snippet uses a state variable name other than `signal`
- [x] The handbook's LLM index files outside the version trees no longer say dependencies are tracked "at the signal level"
- [x] Every code example in the tree that imports the renamed names type-checks against the renamed core
- [x] `npm run check` and `npm run build` pass inside `handbook/`, and the generated `v2002.0.0/llms-full.txt` contains `onIdle` and names `onSettled` only in the migration page's section
