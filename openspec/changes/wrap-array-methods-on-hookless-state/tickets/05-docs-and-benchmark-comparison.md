# 05: Agent docs and benchmark comparison

**Area:** state

**Blocked by:** 03

**What to build:** The two agent documents that describe array interception say what the code now does: the root agent docs' key-behaviors line and the source folder agent docs' table row for the method wrapper. Each states that the seven methods are intercepted on state with and without hooks, run through the Proxy inside a batch, wake each subscriber of the array at most once per call, are subject to the loop check inside an effect, and are seen by the read and write hooks. The handbook pages are not touched: the handbook keeps one frozen route tree per release and this change ships no release, so those pages are written for the tree of the release that carries the behavior (inbox note of 2026-10-22). Then the full benchmark suite is run on this ticket's commit with the package's benchmark script at its default run count, on the same machine and under the same conditions as ticket 01's run, and the complete output is pasted into the ticket report next to ticket 01's grand total. The comparison is the grand total line: the maintainer's rule is that Beacon only gets faster, and 1% of the grand total is the accepted noise. This ticket reports; ticket 06 reads the two grand totals and gates the change.

- [ ] The root agent docs and the source folder agent docs describe array mutating methods as intercepted on both kinds of state, with one wake per call, the loop check inside an effect and hook visibility; `grep` for "intercepted" and for the method names in those two files finds no sentence that contradicts the spec, and no sentence in either file says that only the hooked variant wraps the methods or that the hookless one returns functions raw
- [ ] No file under the handbook folder changes in this ticket (`git diff --stat` against the ticket's base lists none)
- [ ] The ticket report contains the full benchmark output from this ticket's commit, with every case line and the grand total line, and states ticket 01's grand total beside it with the percentage difference
- [ ] The report states, per new case and per kind of state, the median from ticket 01 and from this run
- [ ] `npm run check` passes
