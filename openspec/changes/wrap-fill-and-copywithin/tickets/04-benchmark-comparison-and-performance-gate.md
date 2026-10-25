# 04: Benchmark comparison and performance gate

**Area:** state

**Blocked by:** 03

**What to build:** The change is complete only when it made Beacon no slower. The full benchmark suite is run on the final commit with the package's benchmark script at its default run count, on the same machine and under the same conditions as ticket 01's run, and the complete output is pasted into the ticket report beside ticket 01's figures. The gate is the per-case rule of Q84: no existing case's total may exceed ticket 01's by more than 1%, speedups are unlimited. If a 3-cycle pairing leaves a case over the line, that case is re-measured at 10 cycles in alternating order (baseline, final, final, baseline) and judged on that, as the previous change's ledger records. The new `fill` case is reported before and after; it is expected to be faster, since one wake replaces several, and the report states its medians from both runs. If the gate fails after re-measurement, this ticket iterates on the implementation with every behavior from tickets 02 and 03 kept green, and lists each attempt. This ticket bumps no version and touches no handbook file.

- [ ] The ticket report contains the full benchmark output from the final commit, every case line and the grand total line, with ticket 01's total and the percentage difference stated per case
- [ ] No existing case is slower than ticket 01's run by more than 1%, either in the 3-cycle pairing or, for any case over the line there, in the 10-cycle alternating re-measurement whose figures are in the report
- [ ] The report states the `fill` case's median and total from ticket 01 and from the final run
- [ ] If any iteration was needed, each attempt is listed with what changed and its figures, and `npm test`, `npm run test:coverage` and `npm run check` pass on the final commit
- [ ] Both package manifests still read version `2002.0.0` and no handbook file differs from the branch base
