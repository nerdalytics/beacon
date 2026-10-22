# 02: One set trap for all state

**Area:** state

**Blocked by:** 01

**What to build:** Writing to reactive state notifies the same subscribers at the same moment whether the state was created with hooks or without. Today state created with an `onWrite` hook takes a set path that skips the batch fast path: inside a batch, from outside any effect, it schedules per property, so a subscriber of an array that read an unchanged index does not wake, while the same write on hookless state records the array as dirty and wakes every subscriber of the array once at the batch end. After this ticket there is one set trap for every state object. Its notification logic is the one hookless state has today, batch fast path included, and `onWrite` is called as an observer after the raw write on every path, including the batch fast path, which today calls no hook at all. A write of an equal value stays silent on every path, so `onWrite` never sees an unchanged write. Nothing a hook does or whether it exists changes which subscribers wake or when; that sentence joins the hook contract in the hooks roadmap as a new fact. Ticket 03 builds on this: the array method wrapper runs the native method inside a batch, so the batch fast path must behave the same on both kinds of state before the wrapper can.

- [ ] An effect reading only index 1 of a reactive array `[0, 1, 2]` re-runs exactly once after a batch assigns index 3 from outside any effect, asserted in one test for state without hooks, with `onRead` only, with `onWrite` only, and with both `onRead` and `onWrite`
- [ ] `onWrite` is called for a write made inside a batch from outside any effect, with the same property, old value, new value and target it receives for an unbatched write, and is not called when the batched write assigns an equal value
- [ ] Outside a batch and inside an effect the behavior is unchanged: every existing test passes untouched, and a write to a property the running synchronous top-level effect read raises the infinite-loop error on both kinds of state
- [ ] The hook contract in the hooks roadmap gains the fact that the presence of a hook never changes which subscribers wake or when, and the roadmap's verified-at commit line names the commit it was checked against
- [ ] `npm test`, `npm run test:coverage` (the coverage gate at its configured values) and `npm run check` pass
