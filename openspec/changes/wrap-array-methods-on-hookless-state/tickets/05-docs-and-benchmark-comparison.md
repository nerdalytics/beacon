# 05: Agent docs and benchmark comparison

**Area:** state

**Blocked by:** 03

**What to build:** The two agent documents that describe array interception say what the code now does: the root agent docs' key-behaviors line and the source folder agent docs' table row for the method wrapper. Each states that the seven methods are intercepted on state with and without hooks, run through the Proxy inside a batch, wake each subscriber of the array at most once per call, are subject to the loop check inside an effect, and are seen by the read and write hooks. The handbook pages are not touched: the handbook keeps one frozen route tree per release and this change ships no release, so those pages are written for the tree of the release that carries the behavior (inbox note of 2026-10-22). Then the full benchmark suite is run on this ticket's commit with the package's benchmark script at its default run count, on the same machine and under the same conditions as ticket 01's run, and the complete output is pasted into the ticket report next to ticket 01's grand total. The comparison is the grand total line: the maintainer's rule is that Beacon only gets faster, and 1% of the grand total is the accepted noise. This ticket reports; ticket 06 reads the two grand totals and gates the change.

- [x] The root agent docs and the source folder agent docs describe array mutating methods as intercepted on both kinds of state, with one wake per call, the loop check inside an effect and hook visibility; `grep` for "intercepted" and for the method names in those two files finds no sentence that contradicts the spec, and no sentence in either file says that only the hooked variant wraps the methods or that the hookless one returns functions raw
- [x] No file under the handbook folder changes in this ticket (`git diff --stat` against the ticket's base lists none)
- [x] The ticket report contains the full benchmark output from this ticket's commit, with every case line and the grand total line, and states ticket 01's grand total beside it with the percentage difference
- [x] The report states, per new case and per kind of state, the median from ticket 01 and from this run
- [x] `npm run check` passes

## Report

Commit `36be18e`, `docs(core): describe array method interception on both kinds of state`, implemented in a worktree on 2026-10-22 at BASE `e6c0f53`. Benchmark run by the implementer from inside its worktree on that commit with `npm run benchmark` (`node --expose-gc scripts/benchmark.ts -R 3`, 3 cycles), Node v24.21.0, Apple M4 Pro, the machine ticket 01 used.

### Comparison with ticket 01

| Measure | Ticket 01 (`e9bc6cd`) | This run (`36be18e`) | Change |
|---|---|---|---|
| Grand total line | `Total: 19.4s  Avg/cycle: 6.5s` | `Total: 20.1s  Avg/cycle: 6.7s` | +3.61% |
| Sum of per-case `total=` (20 cases) | 19449.66ms | 20127.94ms | +3.49% |
| `array push/pop (hookless)` median | 51.59ms | 58.55ms | +13.49% |
| `array push/pop (hooks)` median | 17.34ms | 60.45ms | +248.62% |
| Sum of the other 18 cases | 17993.50ms | 17619.81ms | -2.08% |

The increase sits in the two array cases: +142.67ms hookless, +909.30ms hooks, on the `total=` fields. Heap per array case: hookless 23871kb to 76543kb, hooks 28187kb to 77413kb. Ticket 01's hooked baseline measured the old wrapper, which applied the native method to the raw target outside the traps; this run measures the wrapper that runs the method through the Proxy inside `batch()`. Both grand-total percentages exceed the 1% allowance; ticket 06 gates on it.

### Full output

```
> @nerdalytics/beacon@2002.0.0 benchmark
> node --expose-gc scripts/benchmark.ts -R 3

=== Beacon Benchmark (1,000,000 iterations, 3 cycles × 7 samples = 21 total) ===

Cycle 1/3...
Cycle 2/3...
Cycle 3/3...
classic loop              :  med=1.78ms  mean=1.77ms  min=1.60ms  max=2.00ms  sd=0.11ms  heap=11kb  total=37.23ms  avg/cycle=12.41ms  total mem=238kb  avg mem/cycle=79kb
state no subs             :  med=39.55ms  mean=36.03ms  min=26.20ms  max=42.21ms  sd=6.61ms  heap=10kb  total=756.70ms  avg/cycle=252.23ms  total mem=263kb  avg mem/cycle=88kb
state + derive            :  med=173.23ms  mean=165.95ms  min=137.97ms  max=185.33ms  sd=14.88ms  heap=21219kb  total=3484.93ms  avg/cycle=1161.64ms  total mem=386438kb  avg mem/cycle=128813kb
state + derive + 2 effects:  med=324.83ms  mean=311.69ms  min=268.69ms  max=354.37ms  sd=28.12ms  heap=40410kb  total=6545.50ms  avg/cycle=2181.83ms  total mem=680165kb  avg mem/cycle=226722kb
batch + derive            :  med=44.50ms  mean=41.16ms  min=31.20ms  max=51.73ms  sd=6.13ms  heap=19kb  total=864.44ms  avg/cycle=288.15ms  total mem=537kb  avg mem/cycle=179kb
batch + derive + 2 effects:  med=43.78ms  mean=41.02ms  min=31.82ms  max=47.72ms  sd=5.51ms  heap=24kb  total=861.33ms  avg/cycle=287.11ms  total mem=607kb  avg mem/cycle=202kb

--- Targeted benchmarks ---

state creation            :  med=25.05ms  mean=23.83ms  min=16.28ms  max=32.83ms  sd=4.99ms  heap=15669kb  total=500.33ms  avg/cycle=166.78ms  total mem=329056kb  avg mem/cycle=109685kb
state read (no effect)    :  med=16.81ms  mean=17.11ms  min=16.26ms  max=19.87ms  sd=0.95ms  heap=7kb  total=359.40ms  avg/cycle=119.80ms  total mem=147kb  avg mem/cycle=49kb
state write 1 sub         :  med=13.31ms  mean=13.35ms  min=11.92ms  max=15.80ms  sd=1.00ms  heap=16064kb  total=280.42ms  avg/cycle=93.47ms  total mem=328568kb  avg mem/cycle=109523kb
state write 100 subs      :  med=87.43ms  mean=87.61ms  min=85.72ms  max=91.76ms  sd=1.60ms  heap=80127kb  total=1839.84ms  avg/cycle=613.28ms  total mem=1680738kb  avg mem/cycle=560246kb
effect triggers           :  med=7.79ms  mean=8.16ms  min=7.11ms  max=10.05ms  sd=1.00ms  heap=10344kb  total=171.43ms  avg/cycle=57.14ms  total mem=208936kb  avg mem/cycle=69645kb
array push/pop (hookless) :  med=58.55ms  mean=58.58ms  min=56.53ms  max=61.64ms  sd=1.35ms  heap=76543kb  total=1230.09ms  avg/cycle=410.03ms  total mem=1599823kb  avg mem/cycle=533274kb
array push/pop (hooks)    :  med=60.45ms  mean=60.86ms  min=58.72ms  max=64.95ms  sd=1.55ms  heap=77413kb  total=1278.04ms  avg/cycle=426.01ms  total mem=1634844kb  avg mem/cycle=544948kb
many dependencies         :  med=1.84ms  mean=2.02ms  min=1.36ms  max=3.76ms  sd=0.61ms  heap=5201kb  total=42.34ms  avg/cycle=14.11ms  total mem=122291kb  avg mem/cycle=40764kb
derive chain depth 10     :  med=2.49ms  mean=2.69ms  min=1.52ms  max=4.39ms  sd=0.98ms  heap=3750kb  total=56.43ms  avg/cycle=18.81ms  total mem=86707kb  avg mem/cycle=28902kb
100 states individual     :  med=25.94ms  mean=25.88ms  min=24.74ms  max=26.83ms  sd=0.57ms  heap=6939kb  total=543.51ms  avg/cycle=181.17ms  total mem=142183kb  avg mem/cycle=47394kb
100 states batched        :  med=1.70ms  mean=1.84ms  min=1.25ms  max=2.74ms  sd=0.47ms  heap=6635kb  total=38.70ms  avg/cycle=12.90ms  total mem=133983kb  avg mem/cycle=44661kb
100 subs disjoint props   :  med=2.39ms  mean=2.20ms  min=1.44ms  max=3.57ms  sd=0.65ms  heap=2582kb  total=46.22ms  avg/cycle=15.41ms  total mem=46121kb  avg mem/cycle=15374kb

--- Non-extensible targets (subscriber set lives in the WeakMap fallback) ---

sealed write 1 sub        :  med=14.69ms  mean=15.03ms  min=14.32ms  max=17.61ms  sd=0.97ms  heap=16026kb  total=315.68ms  avg/cycle=105.23ms  total mem=338549kb  avg mem/cycle=112850kb
state no subs after seal  :  med=41.83ms  mean=41.68ms  min=39.66ms  max=43.73ms  sd=1.03ms  heap=23kb  total=875.38ms  avg/cycle=291.79ms  total mem=364kb  avg mem/cycle=121kb

Total: 20.1s  Avg/cycle: 6.7s  Total mem: 7720557kb  Avg mem/cycle: 2573519kb
```
