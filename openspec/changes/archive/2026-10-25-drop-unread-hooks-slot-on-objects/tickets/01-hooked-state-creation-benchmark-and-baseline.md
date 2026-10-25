# 01: Hooked state creation benchmark case and the trunk baseline

**Area:** state

**Blocked by:** None (can start immediately)

**What to build:** The benchmark suite gains one case that times what this change speeds up: creating state objects with hooks. It is shaped like the existing hookless `state creation` case, with one hooks object holding a single no-op hook, built once outside the loop and passed to every call. It sits in the blind-spots group, whose header comment already names a creation that takes a second symbol as a gap. Nothing else changes in this ticket, so the numbers it records are the baseline of the unchanged library. The full suite is then run with the package's benchmark script at its default run count, and the complete output, including every case line and the grand total line, goes into the ticket report. Ticket 02 compares its final run against this output case by case, and step 3 of the inbox chain reads the same number later, so the report holds the exact figures, not a summary.

- [x] The benchmark suite lists one new case that creates the same number of state objects as the hookless creation case, each with the same hooks object, and reports through the same result printer as the other cases
- [x] The library source, tests, docs and manifests are unchanged in this ticket (`git diff --stat` against the branch base lists only the benchmark script)
- [x] The ticket report contains the full output of the package's benchmark script from a run on this ticket's commit, with the Node version and machine named

## Report

Commit `3be0a77`, `test(state): add hooked state creation benchmark case`, made by the ticket's implementer in worktree `.claude/worktrees/agent-ae24f764692c76f84` on branch `worktree-agent-ae24f764692c76f84`, started at BASE `3376d26`. `git diff --stat 3376d26 3be0a77` lists only `scripts/benchmark.ts | 22 ++++++++++++++++++++++`. The implementer reported `npm run check` exit 0 and `npm test` exit 0 with 307 passing tests. Run with `npm run benchmark` on that commit, Node v24.21.0, Apple M4 Pro (arm64), Darwin 25.6.0. Full output as the implementer reported it:

```
> @nerdalytics/beacon@2002.0.0 benchmark
> node --expose-gc scripts/benchmark.ts -R 3

=== Beacon Benchmark (1,000,000 iterations, 3 cycles × 7 samples = 21 total) ===

classic loop              :  med=1.78ms  mean=1.76ms  min=1.54ms  max=1.96ms  sd=0.13ms  heap=11kb  total=36.90ms  avg/cycle=12.30ms  total mem=238kb  avg mem/cycle=79kb
state no subs             :  med=39.65ms  mean=35.83ms  min=25.80ms  max=42.48ms  sd=6.82ms  heap=10kb  total=752.42ms  avg/cycle=250.81ms  total mem=267kb  avg mem/cycle=89kb
state + derive            :  med=170.56ms  mean=161.76ms  min=131.89ms  max=178.50ms  sd=14.78ms  heap=68853kb  total=3397.01ms  avg/cycle=1132.34ms  total mem=1048499kb  avg mem/cycle=349500kb
state + derive + 2 effects:  med=315.15ms  mean=302.06ms  min=267.43ms  max=324.91ms  sd=21.50ms  heap=63802kb  total=6343.26ms  avg/cycle=2114.42ms  total mem=1014664kb  avg mem/cycle=338221kb
batch + derive            :  med=42.98ms  mean=39.87ms  min=32.00ms  max=44.34ms  sd=4.93ms  heap=19kb  total=837.19ms  avg/cycle=279.06ms  total mem=297kb  avg mem/cycle=99kb
batch + derive + 2 effects:  med=42.50ms  mean=39.69ms  min=31.77ms  max=44.59ms  sd=5.25ms  heap=24kb  total=833.52ms  avg/cycle=277.84ms  total mem=612kb  avg mem/cycle=204kb

--- Targeted benchmarks ---

state creation            :  med=9.80ms  mean=9.84ms  min=9.52ms  max=10.31ms  sd=0.17ms  heap=15680kb  total=206.74ms  avg/cycle=68.91ms  total mem=329320kb  avg mem/cycle=109773kb
state read (no effect)    :  med=16.64ms  mean=16.63ms  min=15.99ms  max=17.53ms  sd=0.38ms  heap=7kb  total=349.26ms  avg/cycle=116.42ms  total mem=146kb  avg mem/cycle=49kb
state write 1 sub         :  med=12.70ms  mean=12.96ms  min=11.75ms  max=15.07ms  sd=0.86ms  heap=16131kb  total=272.22ms  avg/cycle=90.74ms  total mem=327129kb  avg mem/cycle=109043kb
state write 100 subs      :  med=84.60ms  mean=84.37ms  min=81.18ms  max=86.33ms  sd=1.36ms  heap=80098kb  total=1771.78ms  avg/cycle=590.59ms  total mem=1363125kb  avg mem/cycle=454375kb
effect triggers           :  med=7.30ms  mean=7.48ms  min=6.70ms  max=9.69ms  sd=0.74ms  heap=10331kb  total=157.02ms  avg/cycle=52.34ms  total mem=206588kb  avg mem/cycle=68863kb
array push/pop (hookless) :  med=23.45ms  mean=23.69ms  min=22.57ms  max=26.53ms  sd=0.94ms  heap=48191kb  total=497.53ms  avg/cycle=165.84ms  total mem=930687kb  avg mem/cycle=310229kb
array push/pop (hooks)    :  med=25.37ms  mean=25.57ms  min=24.44ms  max=27.71ms  sd=0.79ms  heap=47870kb  total=536.95ms  avg/cycle=178.98ms  total mem=928129kb  avg mem/cycle=309376kb
many dependencies         :  med=1.90ms  mean=2.02ms  min=1.39ms  max=3.18ms  sd=0.40ms  heap=5950kb  total=42.32ms  avg/cycle=14.11ms  total mem=135498kb  avg mem/cycle=45166kb
derive chain depth 10     :  med=2.28ms  mean=2.65ms  min=1.56ms  max=4.56ms  sd=1.12ms  heap=3745kb  total=55.58ms  avg/cycle=18.53ms  total mem=80316kb  avg mem/cycle=26772kb
100 states individual     :  med=25.25ms  mean=25.42ms  min=24.59ms  max=26.83ms  sd=0.55ms  heap=5906kb  total=533.89ms  avg/cycle=177.96ms  total mem=130963kb  avg mem/cycle=43654kb
100 states batched        :  med=1.80ms  mean=1.87ms  min=1.29ms  max=2.82ms  sd=0.36ms  heap=5920kb  total=39.34ms  avg/cycle=13.11ms  total mem=136456kb  avg mem/cycle=45485kb
100 subs disjoint props   :  med=2.13ms  mean=2.07ms  min=1.40ms  max=3.38ms  sd=0.66ms  heap=2561kb  total=43.46ms  avg/cycle=14.49ms  total mem=46082kb  avg mem/cycle=15361kb

--- Non-extensible targets (subscriber set lives in the WeakMap fallback) ---

sealed write 1 sub        :  med=14.25ms  mean=14.39ms  min=13.27ms  max=16.10ms  sd=0.85ms  heap=15833kb  total=302.29ms  avg/cycle=100.76ms  total mem=316251kb  avg mem/cycle=105417kb
state no subs after seal  :  med=40.71ms  mean=40.74ms  min=39.21ms  max=42.47ms  sd=0.82ms  heap=22kb  total=855.60ms  avg/cycle=285.20ms  total mem=383kb  avg mem/cycle=128kb

--- Blind spots (creation shapes, nested read, equal and undefined writes) ---

state creation (array)    :  med=19.18ms  mean=19.06ms  min=18.44ms  max=19.62ms  sd=0.35ms  heap=3239kb  total=400.32ms  avg/cycle=133.44ms  total mem=297308kb  avg mem/cycle=99103kb
state creation (sealed)   :  med=12.36ms  mean=12.65ms  min=10.50ms  max=16.70ms  sd=1.62ms  heap=6301kb  total=265.58ms  avg/cycle=88.53ms  total mem=132332kb  avg mem/cycle=44111kb
state creation (hooks)    :  med=21.49ms  mean=21.56ms  min=21.03ms  max=22.30ms  sd=0.31ms  heap=9572kb  total=452.68ms  avg/cycle=150.89ms  total mem=201035kb  avg mem/cycle=67012kb
state read nested         :  med=35.95ms  mean=35.97ms  min=34.78ms  max=37.71ms  sd=0.73ms  heap=8kb  total=755.36ms  avg/cycle=251.79ms  total mem=173kb  avg mem/cycle=58kb
state write equal value   :  med=18.20ms  mean=17.70ms  min=15.98ms  max=18.68ms  sd=0.98ms  heap=7kb  total=371.65ms  avg/cycle=123.88ms  total mem=145kb  avg mem/cycle=48kb
array push/pop (undefined):  med=23.68ms  mean=23.97ms  min=23.13ms  max=26.43ms  sd=0.91ms  heap=48368kb  total=503.47ms  avg/cycle=167.82ms  total mem=1063307kb  avg mem/cycle=354436kb

Total: 20.6s  Avg/cycle: 6.9s  Total mem: 8689948kb  Avg mem/cycle: 2896649kb
```

The ticket's checkboxes are ticked only after review and landing on the change branch, per the apply contract.
