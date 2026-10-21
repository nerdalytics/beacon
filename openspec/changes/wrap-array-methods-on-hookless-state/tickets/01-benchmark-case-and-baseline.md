# 01: Benchmark case for array mutation and the trunk baseline

**Area:** state

**Blocked by:** None (can start immediately)

**What to build:** The benchmark suite gains one case that measures the pattern this change alters: one effect subscribed to a reactive array, then a loop that calls `push` and `pop` on it, timed like the existing "effect triggers" case, run once on state created without hooks and once on state created with hooks (two named entries). Nothing else changes: this ticket touches the benchmark script only, so the numbers it records are the baseline of the unchanged library. The full suite is then run with the package's benchmark script at its default run count, and the complete output, including the grand total line, is pasted into the ticket report. Ticket 04 compares against this output and ticket 05 gates the release on it, so the report must hold the exact figures, not a summary.

- [ ] The benchmark suite lists two new entries, one per kind of state, that each subscribe one effect to an array and time a loop of `push` followed by `pop`; both report through the same result printer as the existing cases
- [ ] The library source, tests, docs and manifests are unchanged in this ticket (`git diff --stat` against the branch base lists only the benchmark script)
- [ ] The ticket report contains the full output of the package's benchmark script, including every case line and the grand total line, from a run on this ticket's commit
