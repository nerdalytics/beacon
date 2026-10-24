# 01: Benchmark case for array mutation and the trunk baseline

**Area:** state

**Blocked by:** None (can start immediately)

**What to build:** The benchmark suite gains one case that measures the pattern this change alters: one effect subscribed to a reactive array, then a loop that calls `push` and `pop` on it, timed like the existing "effect triggers" case, run once on state created without hooks and once on state created with hooks (two named entries). Nothing else changes: this ticket touches the benchmark script only, so the numbers it records are the baseline of the unchanged library. The full suite is then run with the package's benchmark script at its default run count, and the complete output, including the grand total line, is pasted into the ticket report. Ticket 05 compares against this output and ticket 06 gates the release on it, so the report must hold the exact figures, not a summary.

- [x] The benchmark suite lists two new entries, one per kind of state, that each subscribe one effect to an array and time a loop of `push` followed by `pop`; both report through the same result printer as the existing cases
- [x] The library source, tests, docs and manifests are unchanged in this ticket (`git diff --stat` against the branch base lists only the benchmark script)
- [x] The ticket report contains the full output of the package's benchmark script, including every case line and the grand total line, from a run on this ticket's commit

## Report

Commit `e9bc6cd`, `test(state): add array push/pop benchmark on both kinds of state`, landed on the change branch by fast-forward. Run with `npm run benchmark` on that commit, Node v24.21.0, Apple M4 Pro (arm64). `git diff --stat bc9bad4 e9bc6cd` lists only `scripts/benchmark.ts | 34 ++++`. Full output:

```
> @nerdalytics/beacon@2002.0.0 benchmark
> node --expose-gc scripts/benchmark.ts -R 3

=== Beacon Benchmark (1,000,000 iterations, 3 cycles × 7 samples = 21 total) ===

classic loop              :  med=0.75ms  mean=1.24ms  min=0.63ms  max=3.53ms  sd=0.86ms  heap=0kb  total=25.95ms  avg/cycle=8.65ms  total mem=58kb  avg mem/cycle=19kb
state no subs             :  med=39.83ms  mean=36.07ms  min=25.59ms  max=46.92ms  sd=6.72ms  heap=10kb  total=757.46ms  avg/cycle=252.49ms  total mem=265kb  avg mem/cycle=88kb
state + derive            :  med=174.13ms  mean=169.08ms  min=151.67ms  max=184.36ms  sd=10.29ms  heap=21829kb  total=3550.75ms  avg/cycle=1183.58ms  total mem=682103kb  avg mem/cycle=227368kb
state + derive + 2 effects:  med=331.80ms  mean=322.19ms  min=285.62ms  max=363.18ms  sd=21.05ms  heap=40366kb  total=6765.89ms  avg/cycle=2255.30ms  total mem=867547kb  avg mem/cycle=289182kb
batch + derive            :  med=43.80ms  mean=41.08ms  min=32.85ms  max=47.32ms  sd=5.07ms  heap=18kb  total=862.58ms  avg/cycle=287.53ms  total mem=510kb  avg mem/cycle=170kb
batch + derive + 2 effects:  med=43.43ms  mean=40.64ms  min=31.89ms  max=46.80ms  sd=5.28ms  heap=24kb  total=853.49ms  avg/cycle=284.50ms  total mem=615kb  avg mem/cycle=205kb

--- Targeted benchmarks ---

state creation            :  med=27.01ms  mean=24.67ms  min=15.71ms  max=31.02ms  sd=4.54ms  heap=15669kb  total=518.09ms  avg/cycle=172.70ms  total mem=329107kb  avg mem/cycle=109702kb
state read (no effect)    :  med=16.56ms  mean=16.94ms  min=15.99ms  max=19.91ms  sd=1.01ms  heap=7kb  total=355.76ms  avg/cycle=118.59ms  total mem=147kb  avg mem/cycle=49kb
state write 1 sub         :  med=12.88ms  mean=13.08ms  min=12.14ms  max=14.50ms  sd=0.67ms  heap=13376kb  total=274.64ms  avg/cycle=91.55ms  total mem=287524kb  avg mem/cycle=95841kb
state write 100 subs      :  med=90.00ms  mean=90.88ms  min=86.97ms  max=105.25ms  sd=3.63ms  heap=80316kb  total=1908.55ms  avg/cycle=636.18ms  total mem=1685993kb  avg mem/cycle=561998kb
effect triggers           :  med=7.27ms  mean=7.68ms  min=6.06ms  max=10.03ms  sd=1.12ms  heap=7308kb  total=161.33ms  avg/cycle=53.78ms  total mem=149042kb  avg mem/cycle=49681kb
array push/pop (hookless) :  med=51.59ms  mean=51.78ms  min=49.16ms  max=55.22ms  sd=1.57ms  heap=23871kb  total=1087.42ms  avg/cycle=362.47ms  total mem=491239kb  avg mem/cycle=163746kb
array push/pop (hooks)    :  med=17.34ms  mean=17.56ms  min=16.05ms  max=20.80ms  sd=1.27ms  heap=28187kb  total=368.74ms  avg/cycle=122.91ms  total mem=620924kb  avg mem/cycle=206975kb
many dependencies         :  med=2.00ms  mean=2.13ms  min=1.55ms  max=3.47ms  sd=0.47ms  heap=4632kb  total=44.79ms  avg/cycle=14.93ms  total mem=110021kb  avg mem/cycle=36674kb
derive chain depth 10     :  med=2.64ms  mean=2.81ms  min=1.62ms  max=4.44ms  sd=1.07ms  heap=3758kb  total=59.08ms  avg/cycle=19.69ms  total mem=80285kb  avg mem/cycle=26762kb
100 states individual     :  med=25.71ms  mean=26.02ms  min=24.41ms  max=29.71ms  sd=1.39ms  heap=6560kb  total=546.48ms  avg/cycle=182.16ms  total mem=138052kb  avg mem/cycle=46017kb
100 states batched        :  med=1.69ms  mean=1.85ms  min=1.31ms  max=2.68ms  sd=0.38ms  heap=4586kb  total=38.79ms  avg/cycle=12.93ms  total mem=95177kb  avg mem/cycle=31726kb
100 subs disjoint props   :  med=2.41ms  mean=2.27ms  min=1.36ms  max=4.43ms  sd=0.83ms  heap=1739kb  total=47.76ms  avg/cycle=15.92ms  total mem=44796kb  avg mem/cycle=14932kb

--- Non-extensible targets (subscriber set lives in the WeakMap fallback) ---

sealed write 1 sub        :  med=14.98ms  mean=15.95ms  min=13.84ms  max=20.84ms  sd=2.15ms  heap=14925kb  total=334.94ms  avg/cycle=111.65ms  total mem=317187kb  avg mem/cycle=105729kb
state no subs after seal  :  med=41.64ms  mean=42.25ms  min=37.67ms  max=53.90ms  sd=3.74ms  heap=23kb  total=887.17ms  avg/cycle=295.72ms  total mem=381kb  avg mem/cycle=127kb

Total: 19.4s  Avg/cycle: 6.5s  Total mem: 5900973kb  Avg mem/cycle: 1966991kb
```
