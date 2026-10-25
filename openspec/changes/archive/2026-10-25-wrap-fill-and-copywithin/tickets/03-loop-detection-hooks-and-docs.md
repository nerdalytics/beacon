# 03: Loop detection and hook assertions, spec purpose and agent docs

**Area:** state

**Blocked by:** 02

**What to build:** Loop detection keeps its rule, a write to a property the effect read raises the infinite-loop error, and the tests pin what that rule means for the two methods whose writes are not all to properties they read: `fill` alone in a synchronous top-level effect raises nothing, and raises when the effect also read an index the call writes; `copyWithin` raises only when its source and target ranges overlap; child effects and microtask effects raise nothing for either. On hooked state the read hook sees the method name and every property the method reads, and the write hook sees every property it writes and no other, in the existing state-hooks test file. The main `array-mutation` spec's purpose line, which archive does not rewrite from the delta, names nine methods, as does the key-behaviors sentence of the root agent docs; the source folder agent docs stop counting "the other five" wrappers and say seven. The handbook is not touched.

- [x] A synchronous top-level effect that calls `fill(9)` on a reactive `[1, 2, 3]` it did not otherwise read raises nothing and the array reads `[9, 9, 9]`; one that reads index 0 first and then calls `fill(9)` raises the infinite-loop error on its first run, on both kinds of state
- [x] A synchronous top-level effect that calls `copyWithin(2, 0, 1)` on a reactive `[1, 2, 3]` raises nothing and the array reads `[1, 2, 1]`; one that calls `copyWithin(0, 1)` raises the infinite-loop error on its first run, on both kinds of state
- [x] A child effect and a microtask effect that each read index 0 and call `fill(9)`, and a pair that each call `copyWithin(0, 1)`, raise nothing, and the arrays end with the native contents
- [x] On state with `onRead` and `onWrite` hooks holding `[1, 2, 3]`, `fill(9, 1)` calls `onRead` with `fill` and with `length`, and calls `onWrite` for index `1` (old `2`, new `9`) and index `2` (old `3`, new `9`) and for no other property
- [x] On such state, `copyWithin(0, 2)` calls `onRead` with `copyWithin`, with `length` and with index `2`, and calls `onWrite` for index `0` (old `1`, new `3`) and for no other property
- [x] The main spec's purpose line and the root agent docs' key-behaviors sentence name nine methods including `fill` and `copyWithin`, and no sentence in the source folder agent docs counts the Proxy-receiver wrappers as five
- [x] No file under the handbook folder changes in this ticket (`git diff --stat` against the ticket's base lists none)
- [x] `npm test`, `npm run test:coverage` and `npm run check` pass
