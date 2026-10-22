# 04: Loop detection and hook observation of mutating methods

**Area:** state

**Blocked by:** 03

**What to build:** With the methods running through the Proxy, the existing read-then-write loop check and the state hooks see what a mutating method does. This ticket pins that with tests; it adds no code unless a test exposes a gap. A synchronous top-level effect that calls any of the seven methods on a reactive array raises the infinite-loop error on both kinds of state, naming the effect when it has a name, because the method reads `length` and the indices it moves before writing them. A child effect does not raise. A microtask effect keeps its exemption; the test for it must converge on its own (push while `length` is below 3), because an unconditional self-feeding microtask effect runs into the microtask cap that belongs to a separate change. On state with hooks, `onRead` sees the method name and every property the method reads, and `onWrite` sees each property the method writes with the same arguments a direct access produces; an equal-value write of `length` is not reported, as it is not for a direct assignment.

- [ ] For each of the seven methods, a synchronous top-level effect that only calls that method on a reactive array raises the infinite-loop error on its first run, on state without hooks and state with hooks, the array holding at least two elements for `sort` and `reverse` so that the call writes; with a named effect the message names the effect
- [ ] A child effect that calls `push` on a reactive array does not raise
- [ ] A microtask effect that pushes while `length` is below 3 raises nothing and leaves the array at length 3
- [ ] With an `onWrite` hook, `push(1)` on an empty array reports index `0` with old value `undefined` and new value `1`, and reports `length` only when the write changes it; with an `onRead` hook, `push(1)` reports `push` and `length`
- [ ] `npm test`, `npm run test:coverage` and `npm run check` pass
