# 02: Resolve the guard branches and the `stop` placeholder

**Area:** coverage-gate

**Blocked by:** 01

**What to build:** Every remaining unhit branch and the one unhit function in the core module is either reached by a test or removed as dead code, so the lcov report shows branches hit equal to branches found and functions hit equal to functions found for the core module. The candidates, as read at commit 655dea8, are defensive guards: missing dependency or read maps on an effect at tracking time; a missing reads map when checking whether an effect depends on a property; identity short-circuits in the dependency-set comparison helpers; the stable-dependency restore path after a re-run; the missing-maps return in subscription update; the internal-symbol read and the wrapped-array-method return in one of the two get handlers; storing hooks for a frozen target when hooks are given; the derive pending setter without a reactive internal; the derive effect body's reactive-or-computing early return; the double-fail and post-done guards in the helper that `until()` delegates to; and the no-op function first assigned to that helper's `stop` unsubscribe. For each one the implementer decides: a test if a public-API or hook path reaches it, deletion if the condition is shown impossible, with the argument for each deletion written in the ticket report. The maintainer rejected coverage-ignore comments and threshold changes. No public API or observable behavior changes.

- [ ] The lcov report for the core module shows `BRH` equal to `BRF` and `FNH` equal to `FNF`
- [ ] Each deleted guard has a written argument in the ticket report stating why its condition cannot occur, and no `node:coverage` comment exists in the source
- [ ] The thresholds, include list and exclude list in `node.config.json` are unchanged
- [ ] The package's exported names and their signatures are unchanged, verified by a passing `npm run build`
- [ ] `npm test` and `npm run check` pass
