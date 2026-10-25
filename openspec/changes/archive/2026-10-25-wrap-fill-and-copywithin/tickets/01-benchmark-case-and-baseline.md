# 01: Benchmark case for fill and the trunk baseline

**Area:** state

**Blocked by:** None (can start immediately)

**What to build:** The benchmark suite gains one case that measures the pattern this change alters: one effect subscribed to a reactive array created without hooks, then a timed loop that calls `fill` on it with a value that changes every element each time (for example alternating two values), shaped like the existing array push/pop case and reporting through the same result printer. Nothing else changes: this ticket touches the benchmark script only, so the numbers it records are the baseline of the unchanged library. The full suite is then run with the package's benchmark script at its default run count (`npm run benchmark`, 3 cycles, as the previous ledgers ruled), and the complete output, including every case line and the grand total line, is pasted into the ticket report. Ticket 04 compares against this output, so the report must hold the exact figures, not a summary.

- [x] The benchmark suite lists one new entry that subscribes one effect to a hookless reactive array and times a loop of `fill` calls that change every element on each call; it reports through the same result printer as the existing cases
- [x] The library source, tests, docs, specs and manifests are unchanged in this ticket (`git diff --stat` against the branch base lists only the benchmark script)
- [x] The ticket report contains the full output of the package's benchmark script, including every case line and the grand total line, from a run on this ticket's commit, with the Node version and machine named

## Report

Run on commit `87c8823` (branch `worktree-agent-a98f18db12d80bac2`, base `a7e06bc`) with `npm run benchmark`, which is `node --expose-gc scripts/benchmark.ts -R 3`. Node v24.21.0, arm64, Apple M4 Pro, 14 cores, 25769803776 bytes of memory as node's `os.totalmem()` reports it. `sysctl -n hw.memsize` was refused by the sandbox, so the memory figure is not verified against it. The new case is `array fill (hookless)`: a hookless reactive array of 3 zeros, one effect reading every index, 50,000 `fill` calls alternating the values 1 and 2.

```
> @nerdalytics/beacon@2002.0.0 benchmark
> node --expose-gc scripts/benchmark.ts -R 3

=== Beacon Benchmark (1,000,000 iterations, 3 cycles × 7 samples = 21 total) ===

classic loop              :  med=1.77ms  mean=1.78ms  min=1.50ms  max=2.32ms  sd=0.18ms  heap=11kb  total=37.41ms  avg/cycle=12.47ms  total mem=240kb  avg mem/cycle=80kb
state no subs             :  med=40.97ms  mean=36.32ms  min=25.59ms  max=42.37ms  sd=7.20ms  heap=10kb  total=762.77ms  avg/cycle=254.26ms  total mem=269kb  avg mem/cycle=90kb
state + derive            :  med=173.06ms  mean=164.93ms  min=141.58ms  max=181.45ms  sd=14.42ms  heap=21191kb  total=3463.54ms  avg/cycle=1154.51ms  total mem=714722kb  avg mem/cycle=238241kb
state + derive + 2 effects:  med=323.77ms  mean=311.96ms  min=273.84ms  max=336.89ms  sd=24.45ms  heap=39803kb  total=6551.06ms  avg/cycle=2183.69ms  total mem=850173kb  avg mem/cycle=283391kb
batch + derive            :  med=42.89ms  mean=40.14ms  min=32.52ms  max=44.47ms  sd=4.67ms  heap=19kb  total=843.01ms  avg/cycle=281.00ms  total mem=531kb  avg mem/cycle=177kb
batch + derive + 2 effects:  med=43.18ms  mean=40.13ms  min=31.37ms  max=45.75ms  sd=5.50ms  heap=24kb  total=842.78ms  avg/cycle=280.93ms  total mem=612kb  avg mem/cycle=204kb

--- Targeted benchmarks ---

state creation            :  med=9.99ms  mean=9.95ms  min=9.39ms  max=10.44ms  sd=0.29ms  heap=15682kb  total=208.91ms  avg/cycle=69.64ms  total mem=329336kb  avg mem/cycle=109779kb
state read (no effect)    :  med=16.52ms  mean=16.55ms  min=15.86ms  max=17.84ms  sd=0.54ms  heap=7kb  total=347.59ms  avg/cycle=115.86ms  total mem=146kb  avg mem/cycle=49kb
state write 1 sub         :  med=13.21ms  mean=13.20ms  min=11.63ms  max=15.65ms  sd=0.89ms  heap=16892kb  total=277.22ms  avg/cycle=92.41ms  total mem=327910kb  avg mem/cycle=109303kb
state write 100 subs      :  med=85.27ms  mean=85.36ms  min=81.10ms  max=90.52ms  sd=2.21ms  heap=80109kb  total=1792.52ms  avg/cycle=597.51ms  total mem=1363243kb  avg mem/cycle=454414kb
effect triggers           :  med=7.47ms  mean=7.58ms  min=6.42ms  max=9.64ms  sd=0.87ms  heap=11033kb  total=159.25ms  avg/cycle=53.08ms  total mem=212319kb  avg mem/cycle=70773kb
array push/pop (hookless) :  med=23.56ms  mean=23.72ms  min=22.66ms  max=26.39ms  sd=0.78ms  heap=49353kb  total=498.13ms  avg/cycle=166.04ms  total mem=914921kb  avg mem/cycle=304974kb
array push/pop (hooks)    :  med=25.58ms  mean=25.81ms  min=24.74ms  max=27.96ms  sd=0.76ms  heap=48784kb  total=541.92ms  avg/cycle=180.64ms  total mem=945871kb  avg mem/cycle=315290kb
array fill (hookless)     :  med=79.53ms  mean=79.70ms  min=78.26ms  max=81.35ms  sd=0.73ms  heap=20291kb  total=1673.64ms  avg/cycle=557.88ms  total mem=428928kb  avg mem/cycle=142976kb
many dependencies         :  med=1.92ms  mean=1.96ms  min=1.45ms  max=3.10ms  sd=0.37ms  heap=5947kb  total=41.23ms  avg/cycle=13.74ms  total mem=132271kb  avg mem/cycle=44090kb
derive chain depth 10     :  med=1.94ms  mean=2.48ms  min=1.64ms  max=4.22ms  sd=0.86ms  heap=4257kb  total=52.01ms  avg/cycle=17.34ms  total mem=84846kb  avg mem/cycle=28282kb
100 states individual     :  med=25.59ms  mean=25.92ms  min=25.08ms  max=27.36ms  sd=0.64ms  heap=6846kb  total=544.40ms  avg/cycle=181.47ms  total mem=139204kb  avg mem/cycle=46401kb
100 states batched        :  med=1.79ms  mean=1.88ms  min=1.32ms  max=2.84ms  sd=0.37ms  heap=5906kb  total=39.43ms  avg/cycle=13.14ms  total mem=136078kb  avg mem/cycle=45359kb
100 subs disjoint props   :  med=2.07ms  mean=2.05ms  min=1.38ms  max=3.58ms  sd=0.69ms  heap=2557kb  total=43.08ms  avg/cycle=14.36ms  total mem=46107kb  avg mem/cycle=15369kb

--- Non-extensible targets (subscriber set lives in the WeakMap fallback) ---

sealed write 1 sub        :  med=14.90ms  mean=14.88ms  min=13.54ms  max=17.53ms  sd=0.99ms  heap=16509kb  total=312.38ms  avg/cycle=104.13ms  total mem=329429kb  avg mem/cycle=109810kb
state no subs after seal  :  med=41.61ms  mean=41.38ms  min=39.05ms  max=43.05ms  sd=1.08ms  heap=22kb  total=868.97ms  avg/cycle=289.66ms  total mem=367kb  avg mem/cycle=122kb

--- Blind spots (creation shapes, nested read, equal and undefined writes) ---

state creation (array)    :  med=19.26ms  mean=19.32ms  min=18.67ms  max=19.95ms  sd=0.35ms  heap=3239kb  total=405.62ms  avg/cycle=135.21ms  total mem=297261kb  avg mem/cycle=99087kb
state creation (sealed)   :  med=19.29ms  mean=19.54ms  min=17.04ms  max=22.52ms  sd=1.47ms  heap=6302kb  total=410.36ms  avg/cycle=136.79ms  total mem=132370kb  avg mem/cycle=44123kb
state creation (hooks)    :  med=13.51ms  mean=14.00ms  min=13.06ms  max=24.63ms  sd=2.39ms  heap=4074kb  total=293.91ms  avg/cycle=97.97ms  total mem=85560kb  avg mem/cycle=28520kb
state read nested         :  med=36.05ms  mean=35.88ms  min=34.56ms  max=36.85ms  sd=0.64ms  heap=8kb  total=753.54ms  avg/cycle=251.18ms  total mem=173kb  avg mem/cycle=58kb
state write equal value   :  med=18.62ms  mean=18.53ms  min=17.53ms  max=19.84ms  sd=0.49ms  heap=7kb  total=389.03ms  avg/cycle=129.68ms  total mem=145kb  avg mem/cycle=48kb
array push/pop (undefined):  med=23.60ms  mean=23.85ms  min=22.82ms  max=26.23ms  sd=0.84ms  heap=49428kb  total=500.81ms  avg/cycle=166.94ms  total mem=1042720kb  avg mem/cycle=347573kb

Total: 22.7s  Avg/cycle: 7.6s  Total mem: 8515753kb  Avg mem/cycle: 2838584kb
```
