# 05: Performance gate and patch release

**Area:** state

**Blocked by:** 03, 04

**What to build:** The release only happens when the change made Beacon no slower. The gate is the grand total of the full benchmark: ticket 04's grand total must not exceed ticket 01's by more than 1%. If it does, this ticket iterates on the implementation of the wrapper and the get-handler lookup until a fresh full run meets the gate, with every behavior from tickets 02 and 03 kept green; candidates named in the design are inlining the batch depth bookkeeping instead of calling the batch function, keying the method cache by native method, and ordering the checks in the wrapper lookup so a non-array target returns on the first comparison. Each iteration's full benchmark output goes into the ticket report. When the gate holds, with or without iterations, the version becomes `2002.0.1` in both package manifests, so the trunk publish workflow releases on merge. If ticket 04's numbers already meet the gate, this ticket is the version bump and the final report alone.

- [ ] The ticket report shows a full benchmark run on the final commit whose grand total is at most 1% above ticket 01's grand total, with the percentage stated
- [ ] If any iteration was needed, each attempt is listed in the report with what changed and its grand total, and `npm test`, `npm run test:coverage` and `npm run check` pass on the final commit
- [ ] Both package manifests read version `2002.0.1`, and no other version string in the repository names `2002.0.0` as current except the handbook's version tree
- [ ] The commit that bumps the version uses type `fix` and scope `state`
