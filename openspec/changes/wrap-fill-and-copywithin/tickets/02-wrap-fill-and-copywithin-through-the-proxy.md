# 02: Wrap fill and copyWithin through the Proxy

**Area:** state

**Blocked by:** 01

**What to build:** A reactive array hands out `fill` and `copyWithin` the way it hands out `shift`, `unshift`, `splice`, `sort` and `reverse`: the cached wrapper that applies the native method to the Proxy receiver inside a batch. The only library change is the two names joining the set of mutating method names the get trap consults, plus any comment that counts the Proxy-receiver wrappers as five. No direct path, no change to the lookup body, the cache or the batch bookkeeping. From outside a batch a call wakes each subscriber of the array at most once and after the method returns; a call that changes no element wakes nobody; inside a user batch the wakes wait for the outermost boundary; the return value and contents equal the native method, including negative and out-of-range bounds; a frozen array raises the native `TypeError` and the system stays usable. Every assertion runs on state created without hooks and on state created with hooks, in the existing array-method test file and its property-based counterpart.

- [ ] An effect reading every index of a reactive `[1, 2, 3]` re-runs exactly once after `fill(9)` and reads `[9, 9, 9]`, and exactly once after `copyWithin(0, 1)` and reads `[2, 3, 3]`, on both kinds of state
- [ ] `fill(9)` on `[9, 9, 9]` and `copyWithin(0, 1)` on `[7, 7, 7]` re-run such an effect zero times, on both kinds of state
- [ ] Inside a user batch that calls `fill(9, 0, 1)` then `copyWithin(2, 0)` on `[1, 2, 3]`, the effect does not re-run before the batch ends and re-runs exactly once after it, reading `[9, 2, 9]`
- [ ] `fill(9, -2)` then `fill(0, 1, 100)` on `[1, 2, 3]` each return the same array and leave `[1, 9, 9]` then `[1, 0, 0]` with `length` 3; `copyWithin(-2, 0)` on `[1, 2, 3, 4]` returns the same array and leaves `[1, 2, 1, 2]`
- [ ] The property-based array test generates `fill` and `copyWithin` calls with arbitrary bounds beside the existing methods and finds the reactive result equal to the plain-array result
- [ ] `fill(9)` on reactive state over a frozen array with at least one element raises a `TypeError` and a later write on other state still notifies
- [ ] `npm test`, `npm run test:coverage` and `npm run check` pass, and `git diff --stat` against the ticket's base shows the library source changed only in the set of method names and a comment
