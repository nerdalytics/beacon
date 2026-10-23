# 06: Performance gate

**Area:** state

**Blocked by:** 04, 05

**What to build:** The change is complete only when it made Beacon no slower. The gate is the grand total of the full benchmark: ticket 05's grand total must not exceed ticket 01's by more than 1%. If it does, this ticket iterates on the implementation of the set trap, the wrapper and the get-handler lookup until a fresh full run meets the gate, with every behavior from tickets 02, 03 and 04 kept green; candidates named in the design are inlining the batch depth bookkeeping instead of calling the batch function, keying the method cache by native method, and ordering the checks in the wrapper lookup so a non-array target returns on the first comparison. Each iteration's full benchmark output goes into the ticket report. This ticket bumps no version: the behavior ships with the next release, which carries its own version and handbook tree. If ticket 05's numbers already meet the gate, this ticket is the final report alone.

- [ ] The ticket report shows a full benchmark run on the final commit whose grand total is at most 1% above ticket 01's grand total and whose `state read (no effect)` case total is at most 1% above ticket 01's, with both percentages stated
- [ ] If any iteration was needed, each attempt is listed in the report with what changed and its grand total, and `npm test`, `npm run test:coverage` and `npm run check` pass on the final commit
- [ ] Both package manifests still read version `2002.0.0` and no handbook file differs from the branch base

## Report

Final commit `c774259`, `perf(state): return the cached wrapper before the method name check`, implemented in a worktree on 2026-10-23 at BASE `f8ed18d`. Every run below is `npm run benchmark` (`node --expose-gc scripts/benchmark.ts -R 3`, 3 cycles) from inside the worktree, Node v24.21.0, Apple M4 Pro, the machine tickets 01 and 05 used. The gate measure is the sum of the per-case `total=` fields; the grand total line is reported beside it.

### Gate

| Measure | Ticket 01 (`e9bc6cd`) | Gate (+1%) | Final run (`c774259`) | Change |
|---|---|---|---|---|
| Sum of per-case `total=` (20 cases) | 19449.66ms | 19644.16ms | 19550.43ms | +0.52% |
| Grand total line | `Total: 19.4s` | | `Total: 19.6s` | +1.03% |
| `state read (no effect)` total | 355.76ms | 359.32ms | 351.68ms | -1.15% |
| `array push/pop (hookless)` median / total | 51.59ms / 1087.42ms | | 52.17ms / 1098.11ms | +1.12% / +0.98% |
| `array push/pop (hooks)` median / total | 17.34ms / 368.74ms | | 54.10ms / 1140.33ms | +212.00% / +209.25% |

Both gates are met: the per-case sum is 0.52% above ticket 01 and the `state read (no effect)` total is 1.15% below it. The hooks array case stays far above ticket 01 because ticket 01 measured the old raw-target wrapper, which skipped the traps; the design accepts the trap cost on the hooked path and the gate is the sum. Heap per array sample: hookless 23871kb to 47779kb, hooks 28187kb to 48598kb (ticket 05 had 76543kb and 77413kb).

### Attempts

| Attempt | Commit | What changed | Per-case sum | vs 01 | Grand total line | `state read (no effect)` | hookless array med / total | hooks array med / total |
|---|---|---|---|---|---|---|---|---|
| 0 (reference, not a gate run) | `f8ed18d` (BASE, ticket 05 code) | nothing | 20548.19ms | +5.65% | `Total: 20.5s` | 347.36ms (-2.36%) | 58.20ms / 1223.83ms | 62.72ms / 1604.05ms (one 269.86ms sample) |
| 1 | `54823b6` | A dirty array maps to the shared `ARRAY_DIRTY_PROPS` sentinel instead of a per-batch `Set`; `handleBatchFastPath` looks subscribers up only on a target's first write of the batch; the wrapper runs the batch bookkeeping itself through new `abortBatch` and `endBatch` helpers that `batch()` shares, without the `batch(fn)` closure; `runDeferredEffects` returns early when nothing was deferred | 19793.33ms | +1.77% | `Total: 19.8s` | 348.45ms (-2.05%) | 53.79ms / 1137.04ms | 56.06ms / 1184.80ms |
| 2 | `c774259` | `getWrappedArrayMethod` checks `Array.isArray` and `typeof value === 'function'`, then returns the `arrayMethodCache` hit before the method-name check, so a read of an already wrapped method skips the `Set.has` and the `wrapArrayMethod` call | 19550.43ms | +0.52% | `Total: 19.6s` | 351.68ms (-1.15%) | 52.17ms / 1098.11ms | 54.10ms / 1140.33ms |

Candidates measured in a scratch micro-benchmark and dropped because they gave no gain beyond noise (about 1.5ms on a 52ms median): a `for...of` instead of `values().next()` for the single pending effect in `runPendingEffectBatch`; `Map.prototype.forEach` instead of destructuring `for...of` in `flushDirtyTargets`. Routing a batched `deleteProperty` through `dirtyTargets` was rejected without measuring: a plain `delete arr[i]` inside a batch wakes only the readers of `i` today and would wake every subscriber of the array, which the design lists as a non-goal. The scratch profile of the hookless case puts about 47% of self time in V8's generic `push`/`pop` on a Proxy receiver, which the design requires and the ticket 01 hookless path paid as well.

Tests of tickets 02, 03 and 04 are untouched. Checks on `c774259`: `npm test` exit 0, 293 pass, 0 fail; `npm run test:coverage` exit 0, `index.ts | 100.00 | 100.00 | 100.00`; `npm run check` exit 0, `Checked 63 files in 101ms. No fixes applied.` and `Found 2 infos.` (unpinned Biome via npx, the worktree has no `node_modules`); the main checkout's pinned binary, `/Users/denny.trebbin/Documents/code/hub/nerdalytics/beacon/node_modules/.bin/biome check --enforce-assist=true` from the worktree root, exit 0, `Checked 63 files in 153ms. No fixes applied.`. `package.json` and `jsr.json` both read `2002.0.0`; `git diff --stat f8ed18d HEAD -- handbook package.json jsr.json` prints nothing.

### Full output, attempt 0 (`f8ed18d`, reference)

```

> @nerdalytics/beacon@2002.0.0 benchmark
> node --expose-gc scripts/benchmark.ts -R 3

=== Beacon Benchmark (1,000,000 iterations, 3 cycles × 7 samples = 21 total) ===

Cycle 1/3...
Cycle 2/3...
Cycle 3/3...
classic loop              :  med=1.76ms  mean=1.80ms  min=1.59ms  max=2.15ms  sd=0.12ms  heap=11kb  total=37.83ms  avg/cycle=12.61ms  total mem=238kb  avg mem/cycle=79kb
state no subs             :  med=40.35ms  mean=36.34ms  min=25.76ms  max=43.21ms  sd=6.99ms  heap=10kb  total=763.04ms  avg/cycle=254.35ms  total mem=263kb  avg mem/cycle=88kb
state + derive            :  med=173.73ms  mean=164.41ms  min=137.34ms  max=177.81ms  sd=15.27ms  heap=20968kb  total=3452.70ms  avg/cycle=1150.90ms  total mem=360469kb  avg mem/cycle=120156kb
state + derive + 2 effects:  med=325.37ms  mean=313.85ms  min=271.81ms  max=351.96ms  sd=26.53ms  heap=39320kb  total=6590.84ms  avg/cycle=2196.95ms  total mem=717982kb  avg mem/cycle=239327kb
batch + derive            :  med=44.16ms  mean=40.83ms  min=32.10ms  max=46.47ms  sd=5.70ms  heap=18kb  total=857.43ms  avg/cycle=285.81ms  total mem=250kb  avg mem/cycle=83kb
batch + derive + 2 effects:  med=44.17ms  mean=40.68ms  min=31.34ms  max=45.69ms  sd=5.79ms  heap=24kb  total=854.30ms  avg/cycle=284.77ms  total mem=599kb  avg mem/cycle=200kb

--- Targeted benchmarks ---

state creation            :  med=28.09ms  mean=25.59ms  min=17.02ms  max=32.90ms  sd=5.49ms  heap=15668kb  total=537.30ms  avg/cycle=179.10ms  total mem=329039kb  avg mem/cycle=109680kb
state read (no effect)    :  med=16.57ms  mean=16.54ms  min=15.48ms  max=17.56ms  sd=0.54ms  heap=7kb  total=347.36ms  avg/cycle=115.79ms  total mem=147kb  avg mem/cycle=49kb
state write 1 sub         :  med=13.73ms  mean=13.76ms  min=11.82ms  max=16.07ms  sd=1.11ms  heap=16873kb  total=288.91ms  avg/cycle=96.30ms  total mem=351108kb  avg mem/cycle=117036kb
state write 100 subs      :  med=89.15ms  mean=89.58ms  min=85.26ms  max=97.72ms  sd=2.73ms  heap=80157kb  total=1881.22ms  avg/cycle=627.07ms  total mem=1681056kb  avg mem/cycle=560352kb
effect triggers           :  med=7.89ms  mean=8.35ms  min=6.07ms  max=11.00ms  sd=1.13ms  heap=11096kb  total=175.43ms  avg/cycle=58.48ms  total mem=220210kb  avg mem/cycle=73403kb
array push/pop (hookless) :  med=58.20ms  mean=58.28ms  min=55.78ms  max=62.17ms  sd=1.58ms  heap=72489kb  total=1223.83ms  avg/cycle=407.94ms  total mem=1520564kb  avg mem/cycle=506855kb
array push/pop (hooks)    :  med=62.72ms  mean=76.38ms  min=57.63ms  max=269.86ms  sd=44.90ms  heap=73872kb  total=1604.05ms  avg/cycle=534.68ms  total mem=1558199kb  avg mem/cycle=519400kb
many dependencies         :  med=1.92ms  mean=2.12ms  min=1.34ms  max=3.34ms  sd=0.55ms  heap=4632kb  total=44.53ms  avg/cycle=14.84ms  total mem=95004kb  avg mem/cycle=31668kb
derive chain depth 10     :  med=2.63ms  mean=3.35ms  min=1.60ms  max=15.65ms  sd=2.91ms  heap=4236kb  total=70.38ms  avg/cycle=23.46ms  total mem=85413kb  avg mem/cycle=28471kb
100 states individual     :  med=26.01ms  mean=26.24ms  min=24.45ms  max=30.79ms  sd=1.46ms  heap=6713kb  total=550.94ms  avg/cycle=183.65ms  total mem=138359kb  avg mem/cycle=46120kb
100 states batched        :  med=1.64ms  mean=1.67ms  min=1.21ms  max=2.29ms  sd=0.26ms  heap=4582kb  total=35.12ms  avg/cycle=11.71ms  total mem=92871kb  avg mem/cycle=30957kb
100 subs disjoint props   :  med=2.32ms  mean=2.17ms  min=1.36ms  max=3.61ms  sd=0.70ms  heap=2587kb  total=45.54ms  avg/cycle=15.18ms  total mem=47855kb  avg mem/cycle=15952kb

--- Non-extensible targets (subscriber set lives in the WeakMap fallback) ---

sealed write 1 sub        :  med=15.10ms  mean=15.14ms  min=13.96ms  max=17.62ms  sd=0.80ms  heap=16608kb  total=317.98ms  avg/cycle=105.99ms  total mem=351209kb  avg mem/cycle=117070kb
state no subs after seal  :  med=41.69ms  mean=41.40ms  min=38.91ms  max=43.07ms  sd=1.14ms  heap=23kb  total=869.46ms  avg/cycle=289.82ms  total mem=366kb  avg mem/cycle=122kb

Total: 20.5s  Avg/cycle: 6.8s  Total mem: 7551201kb  Avg mem/cycle: 2517067kb
```

### Full output, attempt 1 (`54823b6`)

```

> @nerdalytics/beacon@2002.0.0 benchmark
> node --expose-gc scripts/benchmark.ts -R 3

=== Beacon Benchmark (1,000,000 iterations, 3 cycles × 7 samples = 21 total) ===

Cycle 1/3...
Cycle 2/3...
Cycle 3/3...
classic loop              :  med=1.78ms  mean=1.80ms  min=1.55ms  max=2.01ms  sd=0.13ms  heap=11kb  total=37.86ms  avg/cycle=12.62ms  total mem=238kb  avg mem/cycle=79kb
state no subs             :  med=39.17ms  mean=35.74ms  min=26.00ms  max=42.80ms  sd=6.63ms  heap=10kb  total=750.59ms  avg/cycle=250.20ms  total mem=264kb  avg mem/cycle=88kb
state + derive            :  med=173.13ms  mean=164.23ms  min=134.54ms  max=188.87ms  sd=17.53ms  heap=21333kb  total=3448.82ms  avg/cycle=1149.61ms  total mem=714841kb  avg mem/cycle=238280kb
state + derive + 2 effects:  med=320.24ms  mean=310.09ms  min=271.93ms  max=340.94ms  sd=23.56ms  heap=40419kb  total=6511.85ms  avg/cycle=2170.62ms  total mem=872781kb  avg mem/cycle=290927kb
batch + derive            :  med=43.18ms  mean=40.18ms  min=31.56ms  max=44.73ms  sd=5.14ms  heap=19kb  total=843.87ms  avg/cycle=281.29ms  total mem=554kb  avg mem/cycle=185kb
batch + derive + 2 effects:  med=43.09ms  mean=39.88ms  min=31.52ms  max=44.70ms  sd=5.18ms  heap=24kb  total=837.46ms  avg/cycle=279.15ms  total mem=622kb  avg mem/cycle=207kb

--- Targeted benchmarks ---

state creation            :  med=21.86ms  mean=22.83ms  min=18.55ms  max=34.11ms  sd=3.74ms  heap=15670kb  total=479.44ms  avg/cycle=159.81ms  total mem=329050kb  avg mem/cycle=109683kb
state read (no effect)    :  med=16.46ms  mean=16.59ms  min=15.39ms  max=19.46ms  sd=0.74ms  heap=7kb  total=348.45ms  avg/cycle=116.15ms  total mem=147kb  avg mem/cycle=49kb
state write 1 sub         :  med=13.27ms  mean=13.50ms  min=12.01ms  max=15.85ms  sd=0.95ms  heap=16124kb  total=283.43ms  avg/cycle=94.48ms  total mem=329373kb  avg mem/cycle=109791kb
state write 100 subs      :  med=89.32ms  mean=89.24ms  min=83.25ms  max=93.47ms  sd=2.16ms  heap=80103kb  total=1874.10ms  avg/cycle=624.70ms  total mem=1680756kb  avg mem/cycle=560252kb
effect triggers           :  med=7.70ms  mean=7.95ms  min=5.36ms  max=9.73ms  sd=1.02ms  heap=10356kb  total=166.91ms  avg/cycle=55.64ms  total mem=206186kb  avg mem/cycle=68729kb
array push/pop (hookless) :  med=53.79ms  mean=54.14ms  min=51.42ms  max=58.35ms  sd=1.71ms  heap=47681kb  total=1137.04ms  avg/cycle=379.01ms  total mem=992786kb  avg mem/cycle=330929kb
array push/pop (hooks)    :  med=56.06ms  mean=56.42ms  min=54.73ms  max=59.21ms  sd=1.25ms  heap=48385kb  total=1184.80ms  avg/cycle=394.93ms  total mem=1023704kb  avg mem/cycle=341235kb
many dependencies         :  med=1.92ms  mean=2.05ms  min=1.37ms  max=3.65ms  sd=0.51ms  heap=5957kb  total=43.05ms  avg/cycle=14.35ms  total mem=134493kb  avg mem/cycle=44831kb
derive chain depth 10     :  med=2.49ms  mean=2.68ms  min=1.52ms  max=4.44ms  sd=0.97ms  heap=3757kb  total=56.25ms  avg/cycle=18.75ms  total mem=88014kb  avg mem/cycle=29338kb
100 states individual     :  med=25.18ms  mean=25.12ms  min=24.17ms  max=26.32ms  sd=0.60ms  heap=6936kb  total=527.42ms  avg/cycle=175.81ms  total mem=143249kb  avg mem/cycle=47750kb
100 states batched        :  med=1.83ms  mean=2.09ms  min=1.27ms  max=6.43ms  sd=1.07ms  heap=8686kb  total=43.92ms  avg/cycle=14.64ms  total mem=162650kb  avg mem/cycle=54217kb
100 subs disjoint props   :  med=2.30ms  mean=2.19ms  min=1.33ms  max=3.50ms  sd=0.68ms  heap=2588kb  total=45.91ms  avg/cycle=15.30ms  total mem=49483kb  avg mem/cycle=16494kb

--- Non-extensible targets (subscriber set lives in the WeakMap fallback) ---

sealed write 1 sub        :  med=14.49ms  mean=14.75ms  min=13.53ms  max=17.57ms  sd=0.92ms  heap=16033kb  total=309.81ms  avg/cycle=103.27ms  total mem=339407kb  avg mem/cycle=113136kb
state no subs after seal  :  med=41.02ms  mean=41.06ms  min=38.75ms  max=42.81ms  sd=1.04ms  heap=23kb  total=862.35ms  avg/cycle=287.45ms  total mem=362kb  avg mem/cycle=121kb

Total: 19.8s  Avg/cycle: 6.6s  Total mem: 7068959kb  Avg mem/cycle: 2356320kb
```

### Full output, attempt 2 (`c774259`, final)

```

> @nerdalytics/beacon@2002.0.0 benchmark
> node --expose-gc scripts/benchmark.ts -R 3

=== Beacon Benchmark (1,000,000 iterations, 3 cycles × 7 samples = 21 total) ===

Cycle 1/3...
Cycle 2/3...
Cycle 3/3...
classic loop              :  med=1.76ms  mean=1.75ms  min=1.46ms  max=1.95ms  sd=0.12ms  heap=11kb  total=36.71ms  avg/cycle=12.24ms  total mem=238kb  avg mem/cycle=79kb
state no subs             :  med=40.04ms  mean=35.86ms  min=25.84ms  max=41.89ms  sd=6.72ms  heap=10kb  total=753.14ms  avg/cycle=251.05ms  total mem=262kb  avg mem/cycle=87kb
state + derive            :  med=169.77ms  mean=162.13ms  min=139.95ms  max=180.19ms  sd=14.34ms  heap=21214kb  total=3404.66ms  avg/cycle=1134.89ms  total mem=711901kb  avg mem/cycle=237300kb
state + derive + 2 effects:  med=315.69ms  mean=305.62ms  min=270.14ms  max=334.73ms  sd=22.68ms  heap=40412kb  total=6418.09ms  avg/cycle=2139.36ms  total mem=877786kb  avg mem/cycle=292595kb
batch + derive            :  med=43.29ms  mean=40.20ms  min=31.50ms  max=45.02ms  sd=5.00ms  heap=19kb  total=844.28ms  avg/cycle=281.43ms  total mem=516kb  avg mem/cycle=172kb
batch + derive + 2 effects:  med=43.58ms  mean=40.36ms  min=31.51ms  max=49.69ms  sd=5.85ms  heap=24kb  total=847.62ms  avg/cycle=282.54ms  total mem=622kb  avg mem/cycle=207kb

--- Targeted benchmarks ---

state creation            :  med=20.39ms  mean=22.07ms  min=17.33ms  max=28.61ms  sd=3.56ms  heap=15669kb  total=463.37ms  avg/cycle=154.46ms  total mem=329043kb  avg mem/cycle=109681kb
state read (no effect)    :  med=16.74ms  mean=16.75ms  min=15.91ms  max=17.72ms  sd=0.45ms  heap=7kb  total=351.68ms  avg/cycle=117.23ms  total mem=147kb  avg mem/cycle=49kb
state write 1 sub         :  med=13.18ms  mean=13.16ms  min=11.81ms  max=15.34ms  sd=0.92ms  heap=16117kb  total=276.32ms  avg/cycle=92.11ms  total mem=329494kb  avg mem/cycle=109831kb
state write 100 subs      :  med=87.55ms  mean=87.84ms  min=84.76ms  max=93.09ms  sd=2.07ms  heap=80102kb  total=1844.66ms  avg/cycle=614.89ms  total mem=1679711kb  avg mem/cycle=559904kb
effect triggers           :  med=7.61ms  mean=8.07ms  min=7.04ms  max=9.81ms  sd=0.98ms  heap=10260kb  total=169.43ms  avg/cycle=56.48ms  total mem=209937kb  avg mem/cycle=69979kb
array push/pop (hookless) :  med=52.17ms  mean=52.29ms  min=50.83ms  max=55.10ms  sd=1.10ms  heap=47779kb  total=1098.11ms  avg/cycle=366.04ms  total mem=994105kb  avg mem/cycle=331368kb
array push/pop (hooks)    :  med=54.10ms  mean=54.30ms  min=52.10ms  max=56.46ms  sd=1.27ms  heap=48598kb  total=1140.33ms  avg/cycle=380.11ms  total mem=1027036kb  avg mem/cycle=342345kb
many dependencies         :  med=2.01ms  mean=2.14ms  min=1.46ms  max=3.68ms  sd=0.52ms  heap=5965kb  total=44.99ms  avg/cycle=15.00ms  total mem=134512kb  avg mem/cycle=44837kb
derive chain depth 10     :  med=2.50ms  mean=2.74ms  min=1.58ms  max=4.40ms  sd=0.98ms  heap=3758kb  total=57.44ms  avg/cycle=19.15ms  total mem=86689kb  avg mem/cycle=28896kb
100 states individual     :  med=25.89ms  mean=25.77ms  min=24.68ms  max=26.41ms  sd=0.48ms  heap=6889kb  total=541.26ms  avg/cycle=180.42ms  total mem=142958kb  avg mem/cycle=47653kb
100 states batched        :  med=1.95ms  mean=1.95ms  min=1.23ms  max=2.89ms  sd=0.52ms  heap=8686kb  total=41.05ms  avg/cycle=13.68ms  total mem=164156kb  avg mem/cycle=54719kb
100 subs disjoint props   :  med=2.26ms  mean=2.15ms  min=1.39ms  max=3.38ms  sd=0.66ms  heap=2587kb  total=45.06ms  avg/cycle=15.02ms  total mem=49439kb  avg mem/cycle=16480kb

--- Non-extensible targets (subscriber set lives in the WeakMap fallback) ---

sealed write 1 sub        :  med=14.64ms  mean=14.65ms  min=13.60ms  max=16.45ms  sd=0.73ms  heap=15964kb  total=307.65ms  avg/cycle=102.55ms  total mem=336799kb  avg mem/cycle=112266kb
state no subs after seal  :  med=41.24ms  mean=41.17ms  min=38.47ms  max=43.47ms  sd=1.21ms  heap=23kb  total=864.58ms  avg/cycle=288.19ms  total mem=360kb  avg mem/cycle=120kb

Total: 19.6s  Avg/cycle: 6.5s  Total mem: 7075710kb  Avg mem/cycle: 2358570kb
```

