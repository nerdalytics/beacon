# 04: Docs and benchmark comparison

**Area:** state

**Blocked by:** 02

**What to build:** The four documents that describe array interception say what the code now does: the root agent docs' key-behaviors line, the source folder agent docs' table row for the method wrapper, and the handbook's current-version architecture and effects pages. Each states that the seven methods are intercepted on state with and without hooks, run through the Proxy inside a batch, wake each subscriber of the array at most once per call, are subject to the loop check inside an effect, and are seen by the read and write hooks. Then the full benchmark suite is run on this ticket's commit with the package's benchmark script at its default run count, on the same machine and under the same conditions as ticket 01's run, and the complete output is pasted into the ticket report next to ticket 01's grand total. The comparison is the grand total line: the maintainer's rule is that Beacon only gets faster, and 1% of the grand total is the accepted noise. This ticket reports; it does not bump the version. Ticket 05 reads the two grand totals and gates the release.

- [ ] The root agent docs, the source folder agent docs and the handbook's current-version architecture and effects pages describe array mutating methods as intercepted on both kinds of state, with one wake per call, the loop check inside an effect and hook visibility; `grep` for "intercepted" and for the method names in those four files finds no sentence that contradicts the spec
- [ ] The handbook's effects page no longer says that mutating methods "notify all subscribers because they can change multiple properties" without also saying that a call that changes nothing wakes nobody
- [ ] The ticket report contains the full benchmark output from this ticket's commit, with every case line and the grand total line, and states ticket 01's grand total beside it with the percentage difference
- [ ] The report states, per new case and per kind of state, the median from ticket 01 and from this run
- [ ] `npm run check` passes and the handbook builds (`npm run build` inside the handbook folder)
