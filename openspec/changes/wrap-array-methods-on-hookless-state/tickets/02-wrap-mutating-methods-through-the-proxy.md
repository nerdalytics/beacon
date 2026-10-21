# 02: Wrap mutating methods through the Proxy in a batch on both kinds of state

**Area:** state

**Blocked by:** 01

**What to build:** Reading `push`, `pop`, `shift`, `unshift`, `splice`, `sort` or `reverse` from a reactive array returns the same wrapper whether the state was created with hooks or without. The wrapper applies the native method to its call receiver, which is the Proxy the caller went through, inside a batch, and returns the native result. Every read and write the method performs therefore passes the Proxy traps, and the batch boundary wakes each subscriber of the array at most once per call, after the method returns, whatever properties the subscriber read. A call that leaves every element and `length` as they were wakes nobody, the same as a direct write of an equal value. Inside a user batch the wakes wait for the outermost boundary. On a sealed or frozen array the native method's `TypeError` propagates. The design document records the decisions: receiver not lookup, the hookless batch mechanism or its inlined depth bookkeeping, the wrapper lookup placed before the non-object early return in both get handlers. Existing tests that counted one run per property write on hookless arrays move to the single-wake count; no test may accept either count.

- [ ] An effect reading index 0 and `length` of an empty reactive array re-runs exactly once after `push(1)` from outside any effect, asserted for state without hooks and state with hooks in the same test
- [ ] An effect reading only index 1 of `[0, 1, 2]` re-runs exactly once after `push(3)` from outside, on both kinds of state
- [ ] An effect reading every index of a sorted array does not re-run after `sort()`, and one reading every index of `[1, 2, 1]` does not re-run after `reverse()`, on both kinds of state
- [ ] An effect reading `length` does not re-run while a batch calls `push(1)` then `pop()`, and re-runs at most once after the batch ends, on both kinds of state
- [ ] For each of the seven methods, the return value and the resulting contents equal the native method's on a plain array with the same contents and arguments, including `splice(1, 2, 9)` on `[0, 1, 2, 3]` returning `[1, 2]` and `sort` with a comparator; `push` on a sealed array raises `TypeError` and the state stays usable afterwards
- [ ] Every existing test that asserted a per-write run count on a hookless array now asserts the single-wake count, and no test accepts two counts with a try-catch or an "either" assertion
- [ ] `npm test`, `npm run test:coverage` (the coverage gate at its configured values) and `npm run check` pass
