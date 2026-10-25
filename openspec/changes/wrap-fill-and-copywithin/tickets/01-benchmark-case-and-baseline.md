# 01: Benchmark case for fill and the trunk baseline

**Area:** state

**Blocked by:** None (can start immediately)

**What to build:** The benchmark suite gains one case that measures the pattern this change alters: one effect subscribed to a reactive array created without hooks, then a timed loop that calls `fill` on it with a value that changes every element each time (for example alternating two values), shaped like the existing array push/pop case and reporting through the same result printer. Nothing else changes: this ticket touches the benchmark script only, so the numbers it records are the baseline of the unchanged library. The full suite is then run with the package's benchmark script at its default run count (`npm run benchmark`, 3 cycles, as the previous ledgers ruled), and the complete output, including every case line and the grand total line, is pasted into the ticket report. Ticket 04 compares against this output, so the report must hold the exact figures, not a summary.

- [ ] The benchmark suite lists one new entry that subscribes one effect to a hookless reactive array and times a loop of `fill` calls that change every element on each call; it reports through the same result printer as the existing cases
- [ ] The library source, tests, docs, specs and manifests are unchanged in this ticket (`git diff --stat` against the branch base lists only the benchmark script)
- [ ] The ticket report contains the full output of the package's benchmark script, including every case line and the grand total line, from a run on this ticket's commit, with the Node version and machine named
