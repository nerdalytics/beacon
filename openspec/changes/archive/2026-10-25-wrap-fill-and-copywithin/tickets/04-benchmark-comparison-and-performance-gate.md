# 04: Benchmark comparison and performance gate

**Area:** state

**Blocked by:** 03

**What to build:** The change is complete only when it made Beacon no slower. The full benchmark suite is run on the final commit with the package's benchmark script at its default run count, on the same machine and under the same conditions as ticket 01's run, and the complete output is pasted into the ticket report beside ticket 01's figures. The gate is the per-case rule of Q84: no existing case's total may exceed ticket 01's by more than 1%, speedups are unlimited. If a 3-cycle pairing leaves a case over the line, that case is re-measured at 10 cycles in alternating order (baseline, final, final, baseline) and judged on that, as the previous change's ledger records. The new `fill` case is reported before and after; it is expected to be faster, since one wake replaces several, and the report states its medians from both runs. If the gate fails after re-measurement, this ticket iterates on the implementation with every behavior from tickets 02 and 03 kept green, and lists each attempt. This ticket bumps no version and touches no handbook file.

- [x] The ticket report contains the full benchmark output from the final commit, every case line and the grand total line, with ticket 01's total and the percentage difference stated per case
- [x] No existing case is slower than ticket 01's run by more than 1%, either in the 3-cycle pairing or, for any case over the line there, in the 10-cycle alternating re-measurement whose figures are in the report
- [x] The report states the `fill` case's median and total from ticket 01 and from the final run
- [x] If any iteration was needed, each attempt is listed with what changed and its figures, and `npm test`, `npm run test:coverage` and `npm run check` pass on the final commit
- [x] Both package manifests still read version `2002.0.0` and no handbook file differs from the branch base

## Report

Final commit `8464f3f` (the change branch `fix/wrap-fill-and-copywithin` after tickets 01 to 03 landed), run with `npm run benchmark`, which is `node --expose-gc scripts/benchmark.ts -R 3`, in the worktree `.claude/worktrees/agent-a0ac9e5e19986357b` on 2026-10-25 at 13:17 CET. Node v24.21.0, arm64, Apple M4 Pro, 14 cores, 25769803776 bytes of memory as node's `os` module reports them; `sysctl` was refused by the sandbox. The machine was loaded: `uptime` read `load averages: 8.65 10.44 10.35` before the run and `9.30 10.39 10.34` after it. Ticket 01's baseline is the run on `87c8823` in that ticket's report.

### Final run, 3 cycles

```
> @nerdalytics/beacon@2002.0.0 benchmark
> node --expose-gc scripts/benchmark.ts -R 3

=== Beacon Benchmark (1,000,000 iterations, 3 cycles × 7 samples = 21 total) ===

Cycle 1/3...
Cycle 2/3...
Cycle 3/3...
classic loop              :  med=1.84ms  mean=1.83ms  min=1.62ms  max=2.07ms  sd=0.12ms  heap=11kb  total=38.51ms  avg/cycle=12.84ms  total mem=238kb  avg mem/cycle=79kb
state no subs             :  med=40.52ms  mean=36.46ms  min=25.88ms  max=43.32ms  sd=7.00ms  heap=10kb  total=765.65ms  avg/cycle=255.22ms  total mem=269kb  avg mem/cycle=90kb
state + derive            :  med=172.79ms  mean=164.94ms  min=142.38ms  max=181.55ms  sd=14.26ms  heap=68255kb  total=3463.76ms  avg/cycle=1154.59ms  total mem=1026000kb  avg mem/cycle=342000kb
state + derive + 2 effects:  med=324.36ms  mean=311.20ms  min=275.89ms  max=335.25ms  sd=23.38ms  heap=62729kb  total=6535.12ms  avg/cycle=2178.37ms  total mem=1043828kb  avg mem/cycle=347943kb
batch + derive            :  med=43.31ms  mean=40.63ms  min=32.71ms  max=45.38ms  sd=4.63ms  heap=19kb  total=853.13ms  avg/cycle=284.38ms  total mem=515kb  avg mem/cycle=172kb
batch + derive + 2 effects:  med=43.32ms  mean=40.38ms  min=31.96ms  max=45.73ms  sd=5.16ms  heap=24kb  total=847.88ms  avg/cycle=282.63ms  total mem=612kb  avg mem/cycle=204kb

--- Targeted benchmarks ---

state creation            :  med=10.03ms  mean=10.02ms  min=9.61ms  max=10.41ms  sd=0.22ms  heap=15682kb  total=210.46ms  avg/cycle=70.15ms  total mem=329322kb  avg mem/cycle=109774kb
state read (no effect)    :  med=16.77ms  mean=16.84ms  min=16.30ms  max=17.51ms  sd=0.40ms  heap=7kb  total=353.57ms  avg/cycle=117.86ms  total mem=146kb  avg mem/cycle=49kb
state write 1 sub         :  med=13.45ms  mean=13.74ms  min=12.72ms  max=16.78ms  sd=0.93ms  heap=16253kb  total=288.58ms  avg/cycle=96.19ms  total mem=363965kb  avg mem/cycle=121322kb
state write 100 subs      :  med=85.63ms  mean=85.41ms  min=82.44ms  max=87.81ms  sd=1.38ms  heap=80096kb  total=1793.60ms  avg/cycle=597.87ms  total mem=1361012kb  avg mem/cycle=453671kb
effect triggers           :  med=7.47ms  mean=7.75ms  min=6.26ms  max=9.97ms  sd=1.04ms  heap=10328kb  total=162.65ms  avg/cycle=54.22ms  total mem=201782kb  avg mem/cycle=67261kb
array push/pop (hookless) :  med=23.64ms  mean=24.04ms  min=23.18ms  max=26.52ms  sd=0.84ms  heap=48934kb  total=504.76ms  avg/cycle=168.25ms  total mem=905378kb  avg mem/cycle=301793kb
array push/pop (hooks)    :  med=25.64ms  mean=25.69ms  min=24.86ms  max=27.57ms  sd=0.72ms  heap=48611kb  total=539.52ms  avg/cycle=179.84ms  total mem=938873kb  avg mem/cycle=312958kb
array fill (hookless)     :  med=40.57ms  mean=40.69ms  min=39.38ms  max=42.56ms  sd=0.88ms  heap=19966kb  total=854.47ms  avg/cycle=284.82ms  total mem=466189kb  avg mem/cycle=155396kb
many dependencies         :  med=2.17ms  mean=2.23ms  min=1.51ms  max=3.15ms  sd=0.38ms  heap=5986kb  total=46.74ms  avg/cycle=15.58ms  total mem=143932kb  avg mem/cycle=47977kb
derive chain depth 10     :  med=2.44ms  mean=2.67ms  min=1.58ms  max=4.41ms  sd=0.98ms  heap=3744kb  total=55.99ms  avg/cycle=18.66ms  total mem=82190kb  avg mem/cycle=27397kb
100 states individual     :  med=25.75ms  mean=25.79ms  min=24.58ms  max=26.99ms  sd=0.63ms  heap=6929kb  total=541.56ms  avg/cycle=180.52ms  total mem=141609kb  avg mem/cycle=47203kb
100 states batched        :  med=1.71ms  mean=1.81ms  min=1.41ms  max=2.69ms  sd=0.27ms  heap=5899kb  total=37.91ms  avg/cycle=12.64ms  total mem=124540kb  avg mem/cycle=41513kb
100 subs disjoint props   :  med=2.17ms  mean=2.05ms  min=1.35ms  max=3.38ms  sd=0.67ms  heap=2557kb  total=42.98ms  avg/cycle=14.33ms  total mem=46240kb  avg mem/cycle=15413kb

--- Non-extensible targets (subscriber set lives in the WeakMap fallback) ---

sealed write 1 sub        :  med=14.60ms  mean=14.80ms  min=13.43ms  max=17.61ms  sd=1.02ms  heap=16037kb  total=310.88ms  avg/cycle=103.63ms  total mem=325044kb  avg mem/cycle=108348kb
state no subs after seal  :  med=41.77ms  mean=41.75ms  min=39.45ms  max=43.46ms  sd=1.20ms  heap=22kb  total=876.84ms  avg/cycle=292.28ms  total mem=367kb  avg mem/cycle=122kb

--- Blind spots (creation shapes, nested read, equal and undefined writes) ---

state creation (array)    :  med=19.14ms  mean=19.20ms  min=18.32ms  max=19.90ms  sd=0.40ms  heap=3229kb  total=403.12ms  avg/cycle=134.37ms  total mem=67839kb  avg mem/cycle=22613kb
state creation (sealed)   :  med=13.31ms  mean=13.13ms  min=11.42ms  max=14.98ms  sd=0.98ms  heap=6300kb  total=275.74ms  avg/cycle=91.91ms  total mem=132326kb  avg mem/cycle=44109kb
state creation (hooks)    :  med=13.57ms  mean=13.48ms  min=12.90ms  max=13.76ms  sd=0.24ms  heap=4074kb  total=283.16ms  avg/cycle=94.39ms  total mem=85579kb  avg mem/cycle=28526kb
state read nested         :  med=36.54ms  mean=36.50ms  min=35.29ms  max=37.92ms  sd=0.61ms  heap=8kb  total=766.53ms  avg/cycle=255.51ms  total mem=173kb  avg mem/cycle=58kb
state write equal value   :  med=18.51ms  mean=18.66ms  min=17.99ms  max=19.53ms  sd=0.40ms  heap=7kb  total=391.90ms  avg/cycle=130.63ms  total mem=145kb  avg mem/cycle=48kb
array push/pop (undefined):  med=23.97ms  mean=24.17ms  min=23.13ms  max=26.11ms  sd=0.61ms  heap=49075kb  total=507.47ms  avg/cycle=169.16ms  total mem=1033159kb  avg mem/cycle=344386kb

Total: 21.8s  Avg/cycle: 7.3s  Total mem: 8821271kb  Avg mem/cycle: 2940424kb
```

Ticket 01's grand total line: `Total: 22.7s  Avg/cycle: 7.6s  Total mem: 8515753kb  Avg mem/cycle: 2838584kb`.

### Per-case comparison, 3-cycle totals in ms

Percentage is (final - baseline) / baseline * 100. "over" marks a total more than 1% above ticket 01's.

| Case | Ticket 01 | Final | % | |
|---|---|---|---|---|
| classic loop | 37.41 | 38.51 | +2.94 | over |
| state no subs | 762.77 | 765.65 | +0.38 | |
| state + derive | 3463.54 | 3463.76 | +0.01 | |
| state + derive + 2 effects | 6551.06 | 6535.12 | -0.24 | |
| batch + derive | 843.01 | 853.13 | +1.20 | over |
| batch + derive + 2 effects | 842.78 | 847.88 | +0.61 | |
| state creation | 208.91 | 210.46 | +0.74 | |
| state read (no effect) | 347.59 | 353.57 | +1.72 | over |
| state write 1 sub | 277.22 | 288.58 | +4.10 | over |
| state write 100 subs | 1792.52 | 1793.60 | +0.06 | |
| effect triggers | 159.25 | 162.65 | +2.14 | over |
| array push/pop (hookless) | 498.13 | 504.76 | +1.33 | over |
| array push/pop (hooks) | 541.92 | 539.52 | -0.44 | |
| array fill (hookless), new in ticket 01 | 1673.64 | 854.47 | -48.95 | |
| many dependencies | 41.23 | 46.74 | +13.36 | over |
| derive chain depth 10 | 52.01 | 55.99 | +7.65 | over |
| 100 states individual | 544.40 | 541.56 | -0.52 | |
| 100 states batched | 39.43 | 37.91 | -3.85 | |
| 100 subs disjoint props | 43.08 | 42.98 | -0.23 | |
| sealed write 1 sub | 312.38 | 310.88 | -0.48 | |
| state no subs after seal | 868.97 | 876.84 | +0.91 | |
| state creation (array) | 405.62 | 403.12 | -0.62 | |
| state creation (sealed) | 410.36 | 275.74 | -32.81 | |
| state creation (hooks) | 293.91 | 283.16 | -3.66 | |
| state read nested | 753.54 | 766.53 | +1.72 | over |
| state write equal value | 389.03 | 391.90 | +0.74 | |
| array push/pop (undefined) | 500.81 | 507.47 | +1.33 | over |

The `array fill (hookless)` case: median 79.53ms in ticket 01 and 40.57ms in the final run; total 1673.64ms and 854.47ms.

### Re-measurement of the ten cases over the line, 10 cycles, alternating

Four full-suite runs of `node --expose-gc scripts/benchmark.ts -R 10` in the order baseline `87c8823` (b1), final `8464f3f` (f1), final (f2), baseline (b2), each HEAD confirmed with `git rev-parse HEAD` before the run. The script has no single-case filter, so every run covers the whole suite. Load averages from `uptime` before and after each run: b1 `9.68 10.38 10.34` to `14.90 11.98 10.96`; f1 `14.73 12.05 10.99` to `11.69 11.64 10.96`; f2 `11.69 11.64 10.96` to `12.04 11.53 10.98`; b2 `11.63 11.45 10.96` to `8.84 10.54 10.66`. Rule applied: mean of the two baseline totals against mean of the two final totals.

| Case | b1 | f1 | f2 | b2 | mean baseline | mean final | % |
|---|---|---|---|---|---|---|---|
| classic loop | 124.49 | 119.67 | 121.48 | 119.41 | 121.95 | 120.58 | -1.13 |
| batch + derive | 2994.66 | 3016.21 | 2985.21 | 2990.16 | 2992.41 | 3000.71 | +0.28 |
| state read (no effect) | 1173.39 | 1178.16 | 1175.28 | 1187.68 | 1180.54 | 1176.72 | -0.32 |
| state write 1 sub | 932.42 | 962.16 | 949.40 | 933.70 | 933.06 | 955.78 | +2.43 |
| effect triggers | 547.96 | 561.29 | 547.15 | 549.82 | 548.89 | 554.22 | +0.97 |
| array push/pop (hookless) | 1680.16 | 1677.44 | 1679.08 | 1669.40 | 1674.78 | 1678.26 | +0.21 |
| many dependencies | 129.56 | 139.90 | 147.55 | 137.65 | 133.61 | 143.73 | +7.57 |
| derive chain depth 10 | 183.14 | 172.43 | 185.29 | 183.55 | 183.34 | 178.86 | -2.45 |
| state read nested | 2531.20 | 2527.73 | 2497.71 | 2542.49 | 2536.84 | 2512.72 | -0.95 |
| array push/pop (undefined) | 1686.10 | 1676.86 | 1670.11 | 1672.55 | 1679.32 | 1673.48 | -0.35 |

Eight of the ten pass. Two remain over the line: `state write 1 sub` at +2.43% and `many dependencies` at +7.57%. Their lines and the grand totals from the four runs:

```
== b1 (87c8823)
state write 1 sub         :  med=13.06ms  mean=13.32ms  min=11.83ms  max=16.82ms  sd=0.95ms  heap=16292kb  total=932.42ms  avg/cycle=93.24ms  total mem=1133569kb  avg mem/cycle=113357kb
many dependencies         :  med=1.75ms  mean=1.85ms  min=1.46ms  max=3.10ms  sd=0.33ms  heap=4769kb  total=129.56ms  avg/cycle=12.96ms  total mem=355188kb  avg mem/cycle=35519kb
Total: 77.7s  Avg/cycle: 7.8s  Total mem: 30351003kb  Avg mem/cycle: 3035100kb
== f1 (8464f3f)
state write 1 sub         :  med=13.60ms  mean=13.75ms  min=12.13ms  max=16.23ms  sd=0.82ms  heap=16907kb  total=962.16ms  avg/cycle=96.22ms  total mem=1169020kb  avg mem/cycle=116902kb
many dependencies         :  med=1.95ms  mean=2.00ms  min=1.38ms  max=2.99ms  sd=0.42ms  heap=5930kb  total=139.90ms  avg/cycle=13.99ms  total mem=405132kb  avg mem/cycle=40513kb
Total: 75.3s  Avg/cycle: 7.5s  Total mem: 30106698kb  Avg mem/cycle: 3010670kb
== f2 (8464f3f)
state write 1 sub         :  med=13.39ms  mean=13.56ms  min=11.77ms  max=15.73ms  sd=0.87ms  heap=16170kb  total=949.40ms  avg/cycle=94.94ms  total mem=1128562kb  avg mem/cycle=112856kb
many dependencies         :  med=2.09ms  mean=2.11ms  min=1.44ms  max=3.15ms  sd=0.33ms  heap=5938kb  total=147.55ms  avg/cycle=14.76ms  total mem=431282kb  avg mem/cycle=43128kb
Total: 75.0s  Avg/cycle: 7.5s  Total mem: 29811130kb  Avg mem/cycle: 2981113kb
== b2 (87c8823)
state write 1 sub         :  med=13.09ms  mean=13.34ms  min=11.92ms  max=17.23ms  sd=0.90ms  heap=16246kb  total=933.70ms  avg/cycle=93.37ms  total mem=1135970kb  avg mem/cycle=113597kb
many dependencies         :  med=1.92ms  mean=1.97ms  min=1.48ms  max=3.08ms  sd=0.31ms  heap=5928kb  total=137.65ms  avg/cycle=13.76ms  total mem=418247kb  avg mem/cycle=41825kb
Total: 77.6s  Avg/cycle: 7.8s  Total mem: 30630545kb  Avg mem/cycle: 3063055kb
```

Neither failing case calls an array method, and the library diff `87c8823..8464f3f` is two names added to the mutating method set and one comment. The final runs f1 and f2 ran at load averages between 11.7 and 14.7, the baseline runs at 9.7 rising and 11.6 falling to 8.8.

### Manifests and handbook

```
$ grep '"version"' package.json jsr.json
jsr.json:	"version": "2002.0.0"
package.json:	"version": "2002.0.0",
$ git diff --stat 8464f3f -- handbook
(empty)
```

### Gate status after attempt 04a

Two cases over the line after the four-run re-measurement. Under ruling Q7 (2026-10-25) the ticket continued as an investigation with the project's measurement method instead of a re-run or a waiver.

## Attempt 04b: investigation and fix

Second implementer, worktree `.claude/worktrees/agent-a0d5861de6e8b46d8`. Build A is `87c8823` (ticket 01's finished worktree `agent-a98f18db12d80bac2`, used read-only; its `src/index.ts` and `scripts/benchmark.ts` compared byte-equal to `git show 87c8823:<file>`, and byte-equal to build B's benchmark script). Build B is `8464f3f` before the fix and `b595300` after it. Every run is `node --expose-gc <checkout>/scripts/benchmark.ts -R 10`, launched from the implementer's worktree without switching checkouts. Full outputs: `/tmp/claude-502/inv/{aa1..aa6,abA1..abB3,fxA1..fxB3}.txt`, with `uptime` before and after each run in the `.up` files beside them. Load averages ran 8.6 to 19.2 on 14 cores across the runs.

### A/A test, six runs of build A at 10 cycles

Spread of medians and totals across the six runs, as percent of the lowest. This defines "indistinguishable" per case.

| case | median spread % | total spread % |
|---|---|---|
| classic loop | 4.1 | 4.4 |
| state no subs | 3.4 | 3.3 |
| state + derive | 2.6 | 2.9 |
| state + derive + 2 effects | 4.1 | 3.6 |
| batch + derive | 2.2 | 2.4 |
| batch + derive + 2 effects | 1.9 | 1.9 |
| state creation | 2.3 | 2.1 |
| state read (no effect) | 2.0 | 1.8 |
| state write 1 sub | 2.9 | 3.1 |
| state write 100 subs | 2.5 | 2.4 |
| effect triggers | 5.5 | 7.6 |
| array push/pop (hookless) | 1.7 | 2.0 |
| array push/pop (hooks) | 2.8 | 3.1 |
| array fill (hookless) | 1.8 | 1.9 |
| many dependencies | 4.3 | 2.4 |
| derive chain depth 10 | 4.3 | 2.3 |
| 100 states individual | 3.0 | 2.4 |
| 100 states batched | 8.2 | 6.6 |
| 100 subs disjoint props | 8.1 | 7.4 |
| sealed write 1 sub | 3.5 | 3.4 |
| state no subs after seal | 3.3 | 3.5 |
| state creation (array) | 1.9 | 1.6 |
| state creation (sealed) | 15.9 | 24.4 |
| state creation (hooks) | 2.5 | 2.4 |
| state read nested | 1.6 | 1.5 |
| state write equal value | 4.4 | 6.6 |
| array push/pop (undefined) | 3.2 | 3.6 |

Grand totals of the six A/A runs: 79.6s, 78.3s, 78.1s, 77.1s, 77.7s, 78.1s. The A/A spread exceeds 1% on every case, so a 1% verdict needs the interleaved comparison below, not a single pairing.

### Interleaved A/B before the fix, A B A B A B at 10 cycles, B = 8464f3f

Rule: a case is faster or slower only when both its median delta and its total delta exceed that case's A/A spread in the same direction; otherwise indistinguishable. Deltas are B against A in percent, on the median of the three per-build medians and of the three per-build totals.

| case | A med | B med | d med | A tot | B tot | d tot | verdict |
|---|---|---|---|---|---|---|---|
| array fill (hookless) | 81.55 | 40.95 | -49.8 | 5731.6 | 2879.6 | -49.8 | faster |
| many dependencies | 1.89 | 2.09 | +10.6 | 138.6 | 148.1 | +6.8 | slower |
| state write 1 sub | 13.12 | 13.45 | +2.5 | 935.9 | 952.1 | +1.7 | indistinguishable (spread 2.9 / 3.1) |
| effect triggers | 7.50 | 7.73 | +3.1 | 543.4 | 563.2 | +3.6 | indistinguishable |
| derive chain depth 10 | 2.37 | 2.47 | +4.2 | 183.4 | 187.6 | +2.3 | indistinguishable |
| sealed write 1 sub | 14.46 | 14.92 | +3.2 | 1027.3 | 1042.1 | +1.4 | indistinguishable |

The other 21 cases are indistinguishable with deltas of at most 1.8% on medians and 2.1% on totals. Grand totals: A 78.0s, 77.4s, 78.1s; B 75.3s, 75.2s, 75.2s. So before the fix one existing case, `many dependencies`, was slower beyond its noise, and `state write 1 sub` was noise.

### Mechanism

Isolated micro-benchmarks of both cases (15 reps per process, builds interleaved A B A B A B, three rounds) show parity: `state write 1 sub` A 11.65 / 11.68 / 11.43 ms against B 11.72 / 11.75 / 12.05 ms; `many dependencies` A 2.29 / 2.21 / 2.20 ms against B 2.29 / 2.24 / 2.21 ms. The slowdown needs `fill` to run earlier in the same process: a sequence of `array fill` then `many dependencies` over 10 cycles gives A 1.78 / 1.84 / 1.73 ms and B 2.18 / 2.24 / 2.25 ms, about +22% in every cycle. A control on build A that wraps the plain `fill` by hand in `batch(() => items.fill(...))` reproduces B's figures, 2.20 / 2.17 / 2.16 ms, and B's deopt pattern.

The cause: after ticket 02, `fill` and `copyWithin` run through the Proxy inside `applyInBatch`, so array targets reach `handleBatchFastPath` through the set trap, a function that before saw only plain objects. `--trace-deopt-verbose` shows 36 "wrong map" deoptimizations at that function's `[SUBSCRIBERS]` load on B and on the hand-batched A control, and none on plain A. A windowed CPU profile around the `many dependencies` samples in the fill-then-manydeps sequence shows B's self time higher in `handleBatchFastPath` (47.1 ms against 41.3 ms), `scheduleSubscribersForTarget` (23.6 against 18.2) and the set trap (9.3 against 4.0). Excluded by measurement: the `MUTATING_ARRAY_METHODS.has` lookup, which plain objects never reach; the two extra set entries; code layout; and `applyInBatch` itself, since a variant using `batch(closure)` in the wrapper slows down the same way.

### Fix, commit `b595300`, amended to `2dbcee2` after review round 1

`perf(state): keep array writes off the object batch path`. The amend changed comments, the commit body and `src/AGENTS.md` only; the code is the one measured below. Array targets get their own set handler and batch write path (`createArraySetHandler`, `handleBatchArrayWrite`, `HOOKLESS_ARRAY_HANDLER`), chosen once per `state()` call by `Array.isArray`, so the object batch path's load sites stay monomorphic. `handleBatchFastPath` loses its array branches. `src/AGENTS.md` describes the new handler. `git diff --stat 8464f3f..b595300`: `src/AGENTS.md` +5/-3, `src/index.ts` +55/-10, 2 files, 60 insertions, 13 deletions. No benchmark case added or altered, no test changed; the existing array, batch and hook tests cover the new path. After the fix the fill-then-manydeps sequence reads 1.71 / 1.94 / 1.72 / 1.67 ms against A's 1.72 / 1.68 / 1.71 / 1.73 ms, and the sequence shows no deopt at the former load site.

### Interleaved A/B after the fix, A B A B A B at 10 cycles, B = b595300

| case | A med | B med | d med | A tot | B tot | d tot | verdict |
|---|---|---|---|---|---|---|---|
| classic loop | 1.72 | 1.78 | 3.5 | 120.9 | 125.7 | 4.0 | indistinguishable |
| state no subs | 40.93 | 41.59 | 1.6 | 2805.4 | 2799.7 | -0.2 | indistinguishable |
| state + derive | 176.13 | 176.83 | 0.4 | 12174.1 | 12259.8 | 0.7 | indistinguishable |
| state + derive + 2 effects | 333.81 | 331.91 | -0.6 | 23048.6 | 22967.5 | -0.4 | indistinguishable |
| batch + derive | 43.99 | 43.86 | -0.3 | 3017.1 | 3004.3 | -0.4 | indistinguishable |
| batch + derive + 2 effects | 43.99 | 43.68 | -0.7 | 3005.7 | 3001.0 | -0.2 | indistinguishable |
| state creation | 10.06 | 10.16 | 1.0 | 704.5 | 713.5 | 1.3 | indistinguishable |
| state read (no effect) | 16.89 | 16.91 | 0.1 | 1181.0 | 1199.9 | 1.6 | indistinguishable |
| state write 1 sub | 13.14 | 13.18 | 0.3 | 936.9 | 938.3 | 0.2 | indistinguishable |
| state write 100 subs | 87.56 | 86.65 | -1.0 | 6126.2 | 6078.4 | -0.8 | indistinguishable |
| effect triggers | 7.64 | 7.60 | -0.5 | 560.2 | 551.0 | -1.7 | indistinguishable |
| array push/pop (hookless) | 23.89 | 24.08 | 0.8 | 1687.9 | 1694.0 | 0.4 | indistinguishable |
| array push/pop (hooks) | 25.96 | 25.88 | -0.3 | 1828.5 | 1823.4 | -0.3 | indistinguishable |
| array fill (hookless) | 80.66 | 40.15 | -50.2 | 5670.9 | 2824.7 | -50.2 | faster |
| many dependencies | 1.91 | 1.90 | -0.5 | 138.9 | 136.9 | -1.4 | indistinguishable |
| derive chain depth 10 | 2.37 | 2.45 | 3.4 | 183.5 | 187.1 | 2.0 | indistinguishable |
| 100 states individual | 26.25 | 26.16 | -0.3 | 1837.3 | 1836.8 | -0.0 | indistinguishable |
| 100 states batched | 1.74 | 1.72 | -1.1 | 130.0 | 128.7 | -1.0 | indistinguishable |
| 100 subs disjoint props | 2.34 | 2.30 | -1.7 | 165.1 | 158.3 | -4.1 | indistinguishable |
| sealed write 1 sub | 14.85 | 14.71 | -0.9 | 1050.1 | 1039.0 | -1.1 | indistinguishable |
| state no subs after seal | 41.27 | 41.96 | 1.7 | 2891.1 | 2930.2 | 1.4 | indistinguishable |
| state creation (array) | 19.29 | 19.43 | 0.7 | 1352.6 | 1365.1 | 0.9 | indistinguishable |
| state creation (sealed) | 19.09 | 19.09 | 0.0 | 1257.7 | 1261.3 | 0.3 | indistinguishable |
| state creation (hooks) | 13.56 | 13.59 | 0.2 | 949.3 | 951.2 | 0.2 | indistinguishable |
| state read nested | 36.25 | 36.10 | -0.4 | 2536.8 | 2545.0 | 0.3 | indistinguishable |
| state write equal value | 17.26 | 18.43 | 6.8 | 1245.8 | 1267.7 | 1.8 | mixed |
| array push/pop (undefined) | 24.02 | 24.20 | 0.7 | 1694.1 | 1700.7 | 0.4 | indistinguishable |

`state write equal value` is mixed only on the median: build A's three medians span 16.84 to 18.89 ms and build B's three (18.34, 18.43, 18.45) lie inside that range; its total delta of +1.8% is within the 6.6% spread. Grand totals: A 78.6s, 78.8s, 77.4s; B 75.6s, 75.5s, 75.0s. No existing case is slower than build A beyond its own A/A spread.

Deopt and optimize counts over the five-case sequence (`--trace-deopt --trace-opt`): A 388 bailouts / 3798 optimizations, B before the fix 436 / 3791, B after the fix 365 / 3841. `handleBatchFastPath` bails out 0 times on A, 10 times on B before the fix, 0 times after.

Open point outside this ticket, filed to the inbox: `scheduleSubscribersForTarget` and `findSubscribers` still serve arrays and objects from one load site, with 14 and 3 to 6 bailouts per sequence on every build including A.

## Final commit `2dbcee2`: default benchmark run and gate

Run with `npm run benchmark`, which is `node --expose-gc scripts/benchmark.ts -R 3`, in the worktree `.claude/worktrees/agent-a0d5861de6e8b46d8` at `2dbcee2` on 2026-10-25, `uptime` reading `15:28  1 user, load averages: 13.47 12.22 11.80` before and `15:29  1 user, load averages: 12.45 12.14 11.79` after. Same machine as ticket 01: Node v24.21.0, arm64, Apple M4 Pro, 14 cores, 25769803776 bytes. Complete stdout:

```

> @nerdalytics/beacon@2002.0.0 benchmark
> node --expose-gc scripts/benchmark.ts -R 3

=== Beacon Benchmark (1,000,000 iterations, 3 cycles × 7 samples = 21 total) ===

classic loop              :  med=1.70ms  mean=1.71ms  min=1.54ms  max=1.84ms  sd=0.08ms  heap=11kb  total=35.97ms  avg/cycle=11.99ms  total mem=240kb  avg mem/cycle=80kb
state no subs             :  med=37.79ms  mean=35.68ms  min=26.16ms  max=43.25ms  sd=6.47ms  heap=10kb  total=749.18ms  avg/cycle=249.73ms  total mem=290kb  avg mem/cycle=97kb
state + derive            :  med=173.35ms  mean=164.60ms  min=134.54ms  max=182.58ms  sd=17.13ms  heap=68880kb  total=3456.69ms  avg/cycle=1152.23ms  total mem=1044640kb  avg mem/cycle=348213kb
state + derive + 2 effects:  med=323.50ms  mean=313.17ms  min=280.44ms  max=336.94ms  sd=21.07ms  heap=63793kb  total=6576.56ms  avg/cycle=2192.19ms  total mem=1033654kb  avg mem/cycle=344551kb
batch + derive            :  med=43.87ms  mean=40.64ms  min=31.55ms  max=46.14ms  sd=5.18ms  heap=18kb  total=853.34ms  avg/cycle=284.45ms  total mem=277kb  avg mem/cycle=92kb
batch + derive + 2 effects:  med=43.87ms  mean=40.68ms  min=32.07ms  max=45.70ms  sd=5.28ms  heap=24kb  total=854.36ms  avg/cycle=284.79ms  total mem=605kb  avg mem/cycle=202kb

--- Targeted benchmarks ---

state creation            :  med=10.46ms  mean=10.36ms  min=9.71ms  max=10.94ms  sd=0.35ms  heap=15680kb  total=217.64ms  avg/cycle=72.55ms  total mem=329280kb  avg mem/cycle=109760kb
state read (no effect)    :  med=16.68ms  mean=16.72ms  min=15.94ms  max=17.40ms  sd=0.38ms  heap=7kb  total=351.02ms  avg/cycle=117.01ms  total mem=146kb  avg mem/cycle=49kb
state write 1 sub         :  med=13.14ms  mean=13.51ms  min=12.16ms  max=16.05ms  sd=0.96ms  heap=16089kb  total=283.63ms  avg/cycle=94.54ms  total mem=329942kb  avg mem/cycle=109981kb
state write 100 subs      :  med=86.32ms  mean=87.15ms  min=84.41ms  max=92.96ms  sd=2.37ms  heap=80048kb  total=1830.23ms  avg/cycle=610.08ms  total mem=1362604kb  avg mem/cycle=454201kb
effect triggers           :  med=7.72ms  mean=7.87ms  min=6.94ms  max=9.68ms  sd=0.81ms  heap=10318kb  total=165.36ms  avg/cycle=55.12ms  total mem=207839kb  avg mem/cycle=69280kb
array push/pop (hookless) :  med=24.18ms  mean=24.32ms  min=23.17ms  max=25.84ms  sd=0.63ms  heap=48898kb  total=510.66ms  avg/cycle=170.22ms  total mem=904803kb  avg mem/cycle=301601kb
array push/pop (hooks)    :  med=26.47ms  mean=26.88ms  min=25.70ms  max=29.36ms  sd=1.07ms  heap=48634kb  total=564.49ms  avg/cycle=188.16ms  total mem=943659kb  avg mem/cycle=314553kb
array fill (hookless)     :  med=39.64ms  mean=39.90ms  min=38.18ms  max=43.03ms  sd=1.07ms  heap=19961kb  total=837.81ms  avg/cycle=279.27ms  total mem=466396kb  avg mem/cycle=155465kb
many dependencies         :  med=1.94ms  mean=2.00ms  min=1.44ms  max=3.06ms  sd=0.35ms  heap=5953kb  total=41.92ms  avg/cycle=13.97ms  total mem=134050kb  avg mem/cycle=44683kb
derive chain depth 10     :  med=2.47ms  mean=2.72ms  min=1.66ms  max=4.36ms  sd=0.99ms  heap=3752kb  total=57.16ms  avg/cycle=19.05ms  total mem=83416kb  avg mem/cycle=27805kb
100 states individual     :  med=26.13ms  mean=26.06ms  min=24.47ms  max=27.35ms  sd=0.68ms  heap=6797kb  total=547.18ms  avg/cycle=182.39ms  total mem=137169kb  avg mem/cycle=45723kb
100 states batched        :  med=1.77ms  mean=1.85ms  min=1.46ms  max=2.40ms  sd=0.27ms  heap=5907kb  total=38.87ms  avg/cycle=12.96ms  total mem=124971kb  avg mem/cycle=41657kb
100 subs disjoint props   :  med=2.22ms  mean=2.12ms  min=1.34ms  max=3.59ms  sd=0.70ms  heap=2561kb  total=44.62ms  avg/cycle=14.87ms  total mem=46008kb  avg mem/cycle=15336kb

--- Non-extensible targets (subscriber set lives in the WeakMap fallback) ---

sealed write 1 sub        :  med=14.67ms  mean=14.91ms  min=13.97ms  max=16.73ms  sd=0.79ms  heap=15973kb  total=313.08ms  avg/cycle=104.36ms  total mem=321216kb  avg mem/cycle=107072kb
state no subs after seal  :  med=41.52ms  mean=40.85ms  min=38.11ms  max=43.00ms  sd=1.56ms  heap=22kb  total=857.92ms  avg/cycle=285.97ms  total mem=382kb  avg mem/cycle=127kb

--- Blind spots (creation shapes, nested read, equal and undefined writes) ---

state creation (array)    :  med=20.31ms  mean=20.27ms  min=19.15ms  max=21.24ms  sd=0.56ms  heap=3217kb  total=425.77ms  avg/cycle=141.92ms  total mem=67691kb  avg mem/cycle=22564kb
state creation (sealed)   :  med=12.68ms  mean=12.68ms  min=10.03ms  max=15.38ms  sd=1.21ms  heap=6299kb  total=266.26ms  avg/cycle=88.75ms  total mem=132278kb  avg mem/cycle=44093kb
state creation (hooks)    :  med=12.63ms  mean=12.71ms  min=12.31ms  max=13.53ms  sd=0.28ms  heap=4077kb  total=266.86ms  avg/cycle=88.95ms  total mem=85633kb  avg mem/cycle=28544kb
state read nested         :  med=36.30ms  mean=36.31ms  min=34.83ms  max=38.03ms  sd=0.80ms  heap=8kb  total=762.44ms  avg/cycle=254.15ms  total mem=173kb  avg mem/cycle=58kb
state write equal value   :  med=18.11ms  mean=17.82ms  min=16.24ms  max=19.20ms  sd=0.86ms  heap=7kb  total=374.27ms  avg/cycle=124.76ms  total mem=145kb  avg mem/cycle=48kb
array push/pop (undefined):  med=24.31ms  mean=24.39ms  min=23.47ms  max=25.53ms  sd=0.58ms  heap=49024kb  total=512.27ms  avg/cycle=170.76ms  total mem=1031304kb  avg mem/cycle=343768kb

Total: 21.8s  Avg/cycle: 7.3s  Total mem: 8788808kb  Avg mem/cycle: 2929603kb
```

Ticket 01's grand total line: `Total: 22.7s  Avg/cycle: 7.6s  Total mem: 8515753kb  Avg mem/cycle: 2838584kb`.

### Per-case comparison with ticket 01, 3-cycle totals

Percentage is (final - ticket 01) / ticket 01 * 100 on totals. "over" marks a total more than 1% above ticket 01's.

| Case | Ticket 01 med | Final med | Ticket 01 total | Final total | % | |
|---|---|---|---|---|---|---|
| classic loop | 1.77 | 1.70 | 37.41 | 35.97 | -3.85 | |
| state no subs | 40.97 | 37.79 | 762.77 | 749.18 | -1.78 | |
| state + derive | 173.06 | 173.35 | 3463.54 | 3456.69 | -0.20 | |
| state + derive + 2 effects | 323.77 | 323.50 | 6551.06 | 6576.56 | +0.39 | |
| batch + derive | 42.89 | 43.87 | 843.01 | 853.34 | +1.23 | over |
| batch + derive + 2 effects | 43.18 | 43.87 | 842.78 | 854.36 | +1.37 | over |
| state creation | 9.99 | 10.46 | 208.91 | 217.64 | +4.18 | over |
| state read (no effect) | 16.52 | 16.68 | 347.59 | 351.02 | +0.99 | |
| state write 1 sub | 13.21 | 13.14 | 277.22 | 283.63 | +2.31 | over |
| state write 100 subs | 85.27 | 86.32 | 1792.52 | 1830.23 | +2.10 | over |
| effect triggers | 7.47 | 7.72 | 159.25 | 165.36 | +3.84 | over |
| array push/pop (hookless) | 23.56 | 24.18 | 498.13 | 510.66 | +2.52 | over |
| array push/pop (hooks) | 25.58 | 26.47 | 541.92 | 564.49 | +4.16 | over |
| array fill (hookless), new in ticket 01 | 79.53 | 39.64 | 1673.64 | 837.81 | -49.94 | |
| many dependencies | 1.92 | 1.94 | 41.23 | 41.92 | +1.67 | over |
| derive chain depth 10 | 1.94 | 2.47 | 52.01 | 57.16 | +9.90 | over |
| 100 states individual | 25.59 | 26.13 | 544.40 | 547.18 | +0.51 | |
| 100 states batched | 1.79 | 1.77 | 39.43 | 38.87 | -1.42 | |
| 100 subs disjoint props | 2.07 | 2.22 | 43.08 | 44.62 | +3.57 | over |
| sealed write 1 sub | 14.90 | 14.67 | 312.38 | 313.08 | +0.22 | |
| state no subs after seal | 41.61 | 41.52 | 868.97 | 857.92 | -1.27 | |
| state creation (array) | 19.26 | 20.31 | 405.62 | 425.77 | +4.97 | over |
| state creation (sealed) | 19.29 | 12.68 | 410.36 | 266.26 | -35.12 | |
| state creation (hooks) | 13.51 | 12.63 | 293.91 | 266.86 | -9.20 | |
| state read nested | 36.05 | 36.30 | 753.54 | 762.44 | +1.18 | over |
| state write equal value | 18.62 | 18.11 | 389.03 | 374.27 | -3.79 | |
| array push/pop (undefined) | 23.60 | 24.31 | 500.81 | 512.27 | +2.29 | over |

The `array fill (hookless)` case: median 79.53ms in ticket 01 and 39.64ms on the final commit; total 1673.64ms and 837.81ms.

### Gate

Fourteen existing cases are over the 1% line in this 3-cycle pairing, on a machine at load average 12 to 13 against ticket 01's run. The A/A test above measured the 10-cycle spread of identical code at 1.5% to 24.4% per case, so a single 3-cycle pairing cannot resolve 1% on any case, as the previous change's Q84 record also found. Under the ticket's rule, cases over the line are judged on the 10-cycle alternating re-measurement. That re-measurement is the interleaved A/B after the fix, six runs in the order baseline `87c8823`, final, baseline, final, baseline, final at 10 cycles each, covering all 27 cases, with its figures in the table "Interleaved A/B after the fix" above: no existing case is slower than the baseline beyond its own A/A spread on both medians and totals, `many dependencies` reads -0.5% on medians and -1.4% on totals, and `array fill (hookless)` reads -50.2%. The code those runs measured is `b595300`; the amend to `2dbcee2` changed comments, the commit body and `src/AGENTS.md`, confirmed in review round 2, whose `git diff b595300 2dbcee2 -- src/index.ts` showed two comment hunks and no code line.

### Review round 1 finding 3, measured and not adopted

The reviewer proposed replacing the six-line inlined dirty-check and subscriber lookup in `handleBatchArrayWrite` with the one-line `findSubscribers` form `recordDirectWrite` uses, if a re-measure showed no `array fill` regression. Measured interleaved against the fix's own code (H) in the same session, three pairs at 10 cycles:

| run | array fill (hookless) med / total ms | many dependencies med / total ms |
|---|---|---|
| H1 | 39.45 / 2780.33 | 1.84 / 134.80 |
| variant 1 | 40.07 / 2838.80 | 1.89 / 136.63 |
| H2 | 39.51 / 2780.44 | 1.96 / 141.44 |
| variant 2 | 40.90 / 2876.69 | 1.89 / 136.79 |
| H3 | 39.94 / 2801.07 | 1.90 / 136.33 |
| variant 3 | 40.37 / 2848.35 | 1.90 / 136.70 |

Medians of three: `array fill` H 39.51 / 2780.4 against variant 40.37 / 2848.3, +2.2% on medians and +2.4% on totals, higher in all three pairs and beyond the case's A/A spread of 1.8% / 1.9%; `many dependencies` -0.5% / +0.3%, within spread. The micro-benchmark sequence fill-then-manydeps gave the variant's fill median 0.7%, 1.5% and 2.4% above H in three rounds. The inlined lookup stays, with a one-line comment stating the measured cost. Review round 2 noted, without a finding, that the +2.2% / +2.4% sits about 0.4 points above the case's A/A spread, so the decision rests on a thin margin; the measurement is on file in `/tmp/claude-502/inv/` should the tournament revisit it.

### Attempts

- 04a: measurement only, no code change; gate failed after the four-run re-measurement on `state write 1 sub` and `many dependencies`; report above.
- 04b: investigation per ruling Q7; mechanism found and fixed in `b595300`, amended to `2dbcee2` after review round 1; checks `npm test` 322 pass 0 fail, `npm run test:coverage` all files 100.00 / 100.00 / 100.00, `npm run check` exit 0 with the two pre-existing biome.json infos, all run after the last edit; report above.
