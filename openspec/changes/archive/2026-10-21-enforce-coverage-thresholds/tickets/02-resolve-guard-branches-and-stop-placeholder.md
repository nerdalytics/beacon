# 02: Resolve the guard branches and the `stop` placeholder

**Area:** coverage-gate

**Blocked by:** 01

**What to build:** Every remaining unhit branch and the one unhit function in the core module is either reached by a test or removed as dead code, so the lcov report shows branches hit equal to branches found and functions hit equal to functions found for the core module. The candidates, as read at commit 655dea8, are defensive guards: missing dependency or read maps on an effect at tracking time; a missing reads map when checking whether an effect depends on a property; identity short-circuits in the dependency-set comparison helpers; the stable-dependency restore path after a re-run; the missing-maps return in subscription update; the internal-symbol read and the wrapped-array-method return in one of the two get handlers; storing hooks for a frozen target when hooks are given; the derive pending setter without a reactive internal; the derive effect body's reactive-or-computing early return; the double-fail and post-done guards in the helper that `until()` delegates to; and the no-op function first assigned to that helper's `stop` unsubscribe. For each one the implementer decides: a test if a public-API or hook path reaches it, deletion if the condition is shown impossible, with the argument for each deletion written in the ticket report. The maintainer rejected coverage-ignore comments and threshold changes. No public API or observable behavior changes.

- [x] The lcov report for the core module shows `BRH` equal to `BRF` and `FNH` equal to `FNF`
- [x] Each deleted guard has a written argument in the ticket report stating why its condition cannot occur, or why the guarded code changes no behaviour when it does, and no `node:coverage` comment exists in the source
- [x] The thresholds, include list and exclude list in `node.config.json` are unchanged
- [x] The package's exported names and their signatures are unchanged, verified by a passing `npm run build`
- [x] `npm test` and `npm run check` pass

## Ticket report

Written by the steering session from the second implementer's report at commit `a4d45bc`, after the round 3 reviewer verified each argument against the code.

Resolved by a test, five items: the missing dependency or read maps at tracking time and the missing reads map in the dependency check (reached through an `onError` hook that reads and writes state while the failed effect is still current); the internal-symbol read in the hooked get handler (reached by wrapping an already hooked proxy); storing hooks for a frozen target (reached by `state()` on a frozen object with hooks); the derive effect body's early return (reached by an `onDispose` hook that writes a dependency); the double-fail and post-done guards in the helper `until()` delegates to and the no-op `stop` placeholder (reached by writes and aborts around resolution); the derive pending setter without a reactive internal (reached by a compute function that disposes its own derive before returning a thenable); and the missing-maps return in subscription update (reached by an effect whose re-run creates a child that throws on its first run, catches it, and then disposes itself; without the guard that path throws a `TypeError`, so it is kept).

Deleted, eight guards, with the argument for each:

1. The identity short-circuit in the set containment helper. Its only caller is the property-match helper, reached only from the re-run result handler with temporary collections that are built fresh on every re-run, so the two sets are never the same object. Even if they were, the loop returns true.
2. The missing previous-properties return in the property-match helper. Every builder of a reads map adds the target's set in the same step as the dependency entry, and the all-dependencies check only asks for targets already confirmed in the previous dependency set, so the lookup is always defined.
3. The missing new-properties return in the same helper. Same argument, for the temporary reads map against a target from the temporary dependency set.
4. The identity short-circuit in the property-match helper. Fresh sets, as in 1, and the size comparison plus containment gives the same answer when they are identical.
5. The identity short-circuit in the dependency-match helper. Its only caller is the re-run result handler with fresh temporary collections, so identity never holds, and the all-dependencies check on identical sets returns true anyway.
6. The wrapped-array-method return in the hookless get handler. The line above it returns every non-object value raw, functions included, so the wrapper never saw a function there. Hookless proxies route array mutations through the set trap; the hooked handler keeps its own call.
7. The missing-collections guard of the stable-dependency restore helper. On a first run the previous dependencies are undefined, which is now the skip in subscription update. On a re-run the new collections are undefined only through self-dispose, which the kept missing-maps return handles first. Same results on every path.
8. The restore path of the stable-dependency restore helper. Its condition is reachable: a child effect that throws on its first run inside the parent's re-run clears the re-run state, and when the parent catches the throw the result handler returns false with the dependency objects unchanged, so the restore path used to return true. Without it, removing stale subscribers and registering new ones on identical sets do nothing, re-indexing reads re-adds existing entries to sets, and the previous-run fields are reassigned the same objects. The guarded code changed no behaviour, which the round 3 reviewer confirmed by running the scenario at the base commit and at the landed commit.
