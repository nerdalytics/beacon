# A direct equal-value write inside a synchronous effect raises the loop error

**Category:** behavior
**Status:** needs-triage

`performWrite` in `src/index.ts` calls `checkInfiniteLoop` before its `Object.is` equal-value skip, so a synchronous top-level effect that reads a property and then assigns it the value it already holds raises `Infinite loop detected`, although no state changes and no re-run would follow. The ticket 04 implementer of change `wrap-array-methods-on-hookless-state` observed it on 2026-10-22 with a probe, while pinning that `sort` and `reverse` on arrays with fewer than two elements raise nothing (they perform no write at all). Outside an effect and on the batch fast path the equal-value skip comes first and no notification happens. Decide whether the loop check should run only for a changing write, so that the two paths agree, or whether raising on any self-write inside an effect is the intended rule; the spec wording of the archived change was adjusted to not compare the two cases.
