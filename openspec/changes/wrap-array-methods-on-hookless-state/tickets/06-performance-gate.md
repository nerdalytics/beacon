# 06: Performance gate

**Area:** state

**Blocked by:** 04, 05

**What to build:** The change is complete only when it made Beacon no slower. The gate is the grand total of the full benchmark: ticket 05's grand total must not exceed ticket 01's by more than 1%. If it does, this ticket iterates on the implementation of the set trap, the wrapper and the get-handler lookup until a fresh full run meets the gate, with every behavior from tickets 02, 03 and 04 kept green; candidates named in the design are inlining the batch depth bookkeeping instead of calling the batch function, keying the method cache by native method, and ordering the checks in the wrapper lookup so a non-array target returns on the first comparison. Each iteration's full benchmark output goes into the ticket report. This ticket bumps no version: the behavior ships with the next release, which carries its own version and handbook tree. If ticket 05's numbers already meet the gate, this ticket is the final report alone.

- [ ] The ticket report shows a full benchmark run on the final commit whose grand total is at most 1% above ticket 01's grand total and whose `state read (no effect)` case total is at most 1% above ticket 01's, with both percentages stated
- [ ] If any iteration was needed, each attempt is listed in the report with what changed and its grand total, and `npm test`, `npm run test:coverage` and `npm run check` pass on the final commit
- [ ] Both package manifests still read version `2002.0.0` and no handbook file differs from the branch base
