# 01: Cover the reachable gaps

**Area:** coverage-gate

**Blocked by:** None (can start immediately)

**What to build:** The five uncovered branches of the core module that a user of the public API can reach each get a test in the existing behavior test file for their subject, following the file organization and style in the tests agent docs. The behaviors are: reading a property other than `value`, `pending` or `reactive` on a derived value yields `undefined`; assigning a property other than `reactive` on a derived value is rejected by the proxy (the assignment does not take effect and, in strict mode, throws); a named effect that writes a property it reads throws the infinite-loop error with its name and the property in the message; an effect that reads two arrays which are both mutated through an array method inside one batch is queued once and runs once; a `batch()` called with hooks whose body makes a dirty target at the outermost depth flushes that target when the batch ends. After this ticket the coverage report lists no unhit line in the derive proxy's get and set traps, in the infinite-loop message, in the scheduler's already-queued return, or in the batch dirty-target flush.

- [x] A test in the derive core file reads an unknown property on a derived value and asserts `undefined`
- [x] A test in the derive core file assigns `value` on a derived value and asserts the assignment is rejected and the value unchanged
- [x] A test in the infinite-loop file triggers the guard from an effect created with a name and asserts the message `Infinite loop detected: effect "<name>" cannot update property "<prop>" it depends on` with the actual name and property filled in
- [x] A test in the batch core file calls an array mutating method, such as `push`, on each of two arrays one effect reads, inside a batch, and asserts the effect ran exactly once after the batch
- [x] A test in the batch hooks file calls `batch()` with hooks, dirties a subscribed target at the outermost batch depth in its body, and asserts the resulting notification
- [x] `npm test` and `npm run check` pass, and the lcov report for the core module shows at least five fewer unhit branches than before this ticket (23 at commit 655dea8)
