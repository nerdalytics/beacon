# 07: Direct fast path for push and pop

**Area:** state, plus additions to the benchmark script (Q66 d)

**Blocked by:** 06

**What to build:** `push` and `pop` on a reactive array run the native method on the raw target and then do, by hand, exactly the bookkeeping the get, set and delete traps would have done, with the same arguments a direct property access produces. The reference is what a plain Proxy reports for the same call: `push` reads `push` and `length`, then writes each new index and `length`; `pop` reads `pop`, `length` and the last index, then deletes the last index and writes `length`. So the direct path calls `onRead` for the method name and each property read, `onWrite` with the infinite-loop check for each property the set trap would have written, `onDelete` for the index `pop` removes, which gets no loop check and no equal check because the delete trap has none (Q57 a), and it keeps an equal value silent, where equal means equal to the value of a property that exists: a write of `undefined` to an absent index is a change, so the set trap and the direct path store it, `onWrite` reports the new index with old value `undefined`, and the array afterwards has that own element as a plain array would (Q65 a, principle 1). Outside an effect it wakes each subscriber of the array once per call, deferred to the outermost batch when called inside one; inside a child or microtask effect it schedules per property exactly as the set trap's effect path does today, so the direct path changes no observable behavior (Q58 a). The other five mutating methods keep the Proxy receiver of ticket 03. The maintainer's performance rule is per benchmark case: Beacon must be faster over time, never slower, 1% is treated as noise and nothing above it is (Q64 d). No existing benchmark case may be altered; new benchmark cases and micro benchmarks may be added to find blind spots, and profiling is expected before a change is made (Q66 d). Measurement is interleaved to beat machine drift: three full `npm run benchmark` runs of the base commit (the change branch's tip before this ticket) alternating with three full runs of the final commit, in one session on one machine, with the median of each case's `med=` and `total=` fields compared across the three runs of each side. All six outputs go into the ticket report. The gate for the hookless array case is trunk's own number from ticket 01, because trunk ran the same trap work there. The gate for the hooked array case is the same trunk hookless number (Q54 a), because trunk's 17.34ms for the hooked case measured a wrapper that called no hook and tracked nothing. No version bump, no handbook change.

- [x] The report shows the interleaved measurement; the `array push/pop (hookless)` median and total of the final commit are at most 1% above ticket 01's 51.59ms and 1087.42ms, and the `array push/pop (hooks)` median and total are at most 1% above the same 51.59ms and 1087.42ms, trunk's cost for the same trap work without hooks (Q54 a)
- [x] In the same measurement no other benchmark case's median is more than 1% above the base commit's median; the report lists every case with its base and final medians, and a case above 1% fails this criterion (Q64 d)
- [x] The direct path reproduces the trap bookkeeping: the spec scenarios for one wake per call, batch composition, loop detection, hook observation, equal results to the native method and the sealed-array `TypeError` pass for `push` and `pop` on both kinds of state, and no test file of tickets 02 to 04 is edited; a test pins that `push(undefined)` on both kinds of state leaves an own element at the new index, as a plain array does, with `onWrite` for that index (Q65 a)
- [x] A new test file pins, for `push` and `pop` on both kinds of state, the exact hook call sequence (`onRead`, `onWrite`, `onDelete` with their arguments) and the set of subscribers woken, with the expected sequence taken from a plain Proxy over the same array as the reference (Q59 a)
- [x] `npm test`, `npm run test:coverage` and `npm run check` pass on the final commit; both package manifests still read version `2002.0.0` and no handbook file differs from the branch base
- [x] No existing benchmark case is altered; every benchmark case the ticket adds is measured with the same interleaved protocol on both sides and, with the same script, on trunk, so it has a trunk number before it is judged (maintainer, 2026-10-24), and the report says which blind spot each new case covers and what the profile showed for each case the ticket changed (Q66 d)

## Report

Final commit `bb2659c`, `fix(state): run push and pop native on the raw receiver`, landed on the change branch by merge commit `56e4bad` on 2026-10-24. Base commit `77fd93e` (the change branch's tip before this ticket). Four attempts, two implementers, five review rounds, rulings Q61 to Q73 in the ledger:

| Attempt | Commits | Outcome |
|---|---|---|
| 1 (implementer 1) | up to `bb355d0` | criterion 2 failed under Q64 d: `derive chain depth 10` +5.7%, `100 subs disjoint props` +3.6%, `state no subs after seal` +2.7%, `100 states batched` +1.8% vs base; the `push(undefined)` pin of Q62 b rejected, Q65 a amended the ticket |
| 2 (implementer 1, retry) | `1c1191f` fix, `3a8e13a` perf, `91a93af` perf, `857f114` benchmark cases, `92f1922` perf | criterion 1 met (22.74ms / 24.47ms); criterion 2 failed: `state read (no effect)` +4.2%, `state no subs` +2.1%, `state no subs after seal` +1.8% (Q67 a) |
| 3 (implementer 2, from `92f1922`) | `350b48f` perf, `9a6086f` fix, `ac49ea8` refactor, `df2fdee` test, `d594c4a` style | root cause of the read regression found with `--trace-deopt` and removed; `state no subs` and `derive chain depth 10` recorded as noise (Q70 a); round 4 three low findings |
| fix-ups | `8872aab` test (round 4), `bb2659c` fix (Q71 b) | push and pop with the raw array as receiver run natively and silently, like the other five wrappers and like a write on a raw object; round 5 one low finding filed (Q73 a) |

Every run below is `npm run benchmark` (`node --expose-gc scripts/benchmark.ts -R 3`, 3 cycles × 7 samples), Node v24.21.0, Apple M4 Pro, the machine tickets 01 to 06 used. The final measurement ran three interleaved triplets in one session, in the order base `77fd93e`, `8872aab`, final `bb2659c`, each side in a detached checkout with `bb2659c`'s `scripts/benchmark.ts` (base lacks the 84 added lines; `git diff 8872aab bb2659c -- scripts/benchmark.ts` is empty). Each figure is the median of the three runs' `med=` or `total=` fields. The raw outputs of base and final are at the end of this report.

### Criterion 1: the gate for the two array cases

| Case | Ticket 01 trunk hookless (`e9bc6cd`) | Gate (+1%) | Base `77fd93e` | Final `bb2659c` | Final vs gate |
|---|---|---|---|---|---|
| `array push/pop (hookless)` median / total | 51.59ms / 1087.42ms | 52.11ms / 1098.29ms | 51.88ms / 1092.80ms | 23.54ms / 496.57ms | -54.4% / -54.3% |
| `array push/pop (hooks)` median / total | 51.59ms / 1087.42ms (Q54 a) | 52.11ms / 1098.29ms | 53.31ms / 1131.56ms | 25.40ms / 538.08ms | -50.8% / -50.5% |

The hookless case is 54% below the gate on the median and the total; the hooked case is 51% below it on the median and 50% on the total. Base, which carries tickets 02 to 06, sits on the gate for the hookless case and 3% above it for the hooked case; the direct path removes V8's generic push and pop on a Proxy receiver, which ticket 06 profiled at about 47% of self time.

### Criterion 2: every case against base

| Case | Base `77fd93e` | `8872aab` | Final `bb2659c` | Final vs base | Note |
|---|---|---|---|---|---|
| `classic loop` | 1.75 | 1.76 | 1.78 | +1.71% | above 1%, ruled noise Q72 a: runs no Beacon code |
| `state no subs` | 38.28 | 40.32 | 37.85 | -1.12% |  |
| `state + derive` | 169.51 | 170.43 | 169.64 | +0.08% |  |
| `state + derive + 2 effects` | 318.43 | 319.05 | 320.69 | +0.71% |  |
| `batch + derive` | 42.88 | 42.84 | 42.74 | -0.33% |  |
| `batch + derive + 2 effects` | 43.38 | 42.96 | 43.03 | -0.81% |  |
| `state creation` | 27.55 | 9.84 | 9.98 | -63.77% |  |
| `state read (no effect)` | 16.53 | 16.44 | 16.62 | +0.54% |  |
| `state write 1 sub` | 13.09 | 12.83 | 12.82 | -2.06% |  |
| `state write 100 subs` | 87.07 | 85.75 | 86.64 | -0.49% |  |
| `effect triggers` | 7.51 | 7.51 | 7.41 | -1.33% |  |
| `array push/pop (hookless)` | 51.88 | 23.42 | 23.54 | -54.63% |  |
| `array push/pop (hooks)` | 53.31 | 25.03 | 25.40 | -52.35% |  |
| `many dependencies` | 2.01 | 1.90 | 1.97 | -1.99% |  |
| `derive chain depth 10` | 2.52 | 2.45 | 2.23 | -11.51% |  |
| `100 states individual` | 25.22 | 25.74 | 25.61 | +1.55% | above 1%, ruled noise Q72 a: calls no push or pop, +2.1% on 8872aab |
| `100 states batched` | 1.92 | 1.71 | 1.74 | -9.37% |  |
| `100 subs disjoint props` | 2.32 | 2.12 | 2.23 | -3.88% |  |
| `sealed write 1 sub` | 14.42 | 14.27 | 14.37 | -0.35% |  |
| `state no subs after seal` | 40.38 | 41.12 | 40.28 | -0.25% |  |
| `state creation (array)` | 27.85 | 19.11 | 18.96 | -31.92% |  |
| `state creation (sealed)` | 21.06 | 12.55 | 19.12 | -9.21% |  |
| `state read nested` | 38.59 | 35.58 | 35.34 | -8.42% |  |
| `state write equal value` | 18.14 | 18.17 | 17.95 | -1.05% |  |
| `array push/pop (undefined)` | 49.17 | 23.63 | 23.69 | -51.82% |  |

Two cases read more than 1% above base and were ruled noise by the maintainer (Q72 a): `classic loop` is a plain counting loop with no Beacon code (`scripts/benchmark.ts` lines 97 to 109) whose base samples were 1.75, 0.66 and 1.75; `100 states individual` calls neither push nor pop, and `8872aab`, which differs from `bb2659c` by one identity comparison inside those two wrappers, reads +2.1% on the same data. Earlier in the ticket, Q70 a recorded `state no subs` (bimodal by cycle on every side, about 26ms in cycle 1 and 38 to 42ms in cycles 2 and 3, the same spread on a variant with base's write code) and `derive chain depth 10` (+2.1% at 0.05ms with sd 1.0) as noise on `d594c4a`; both read below base in the final measurement. The bimodal case and the set-trap feedback churn behind it are filed in `.do/inbox/2026-10-24-state-no-subs-bimodal-and-set-trap-feedback-churn.md`.

### Criterion 6: the five added cases, with their trunk numbers

Trunk medians are from the retry's session (three interleaved runs of trunk `cbd7448` with `857f114`'s script, raw files `trunk-1..3.txt` of that session); base and final are from the final session above, so the trunk column carries a cross-session caveat.

| Case | Trunk `cbd7448` | Base `77fd93e` | Final `bb2659c` | Final vs trunk | Final vs base | Blind spot it covers |
|---|---|---|---|---|---|---|
| `state creation (array)` | 28.40 | 27.85 | 18.96 | -33.24% | -31.92% | array state creation, 2.7x slower with the Proxy-keyed WeakMap (3a8e13a) |
| `state creation (sealed)` | 20.62 | 21.06 | 19.12 | -7.27% | -9.21% | the frozen-target fallback path of `defineProxyProperties` (91a93af) |
| `state read nested` | 36.92 | 38.59 | 35.34 | -4.28% | -8.42% | the nested wrap reading `[PROXY]` before `state()` (91a93af) |
| `state write equal value` | 16.96 | 18.14 | 17.95 | +5.84% | -1.05% | the set trap's equal branch and its existence check (1c1191f, 92f1922) |
| `array push/pop (undefined)` | 46.46 | 49.17 | 23.69 | -49.01% | -51.82% | the one argument the existence check exists for (Q65 a) |

`state write equal value` reads above trunk and below base: base is 7% above trunk on that case before this ticket touched it, part of the branch-vs-trunk drift filed in `.do/inbox/2026-10-24-change-branch-vs-trunk-drift.md`; the ticket's own change on that path, `prop in rawTarget` on the equal-undefined branch only, measured 4% on that write alone (`92f1922`).

### Profiles behind each change

- `3a8e13a`: array state creation at 2.7x base (27ms to 74ms per 100k), 76% in the garbage collector, from the ephemeron entry per array in a Proxy-keyed WeakMap; the context moved into the array target's `[HOOKS]` slot, creation 40ms.
- `91a93af`: base's creation profile at 65% garbage collector from the `proxyCache` insert that an extensible target never needs; object creation 25.4ms to 9.8ms, array creation 25.1ms to 18.8ms, nested read 36.6ms to 33.1ms per million.
- `92f1922`: `Object.hasOwn` on the equal branch cost 35% on an equal write (12.7ms to 17.2ms per million); `in` on the equal-undefined branch only costs 4% on that write.
- `350b48f`: `--trace-deopt` showed the get trap deoptimized twice per benchmark cycle because the internal-symbol load site saw only array maps through the direct push and pop and lost its feedback when the benchmark's arrays were collected; loading the raw value once before the symbol check put `state read (no effect)` at 16.63ms against 16.84 base and 17.16 on `92f1922`, at the cost of a stub-cache probe per push and pop (the three array cases +2.4% to +2.9% against `92f1922`).

### Tests and checks

The new file `tests/array-push-pop.test.ts` (459 lines) pins, for push and pop on both kinds of state: the hook call sequence against a plain Proxy over the same array, the wake sets, push inside a child effect, `push(undefined)` leaving an own element at the new index with `onWrite` for it (Q65 a), the sealed-after-`state()` TypeError with the batch depth back at 0, the native TypeError for a nullish receiver, a hooked object as receiver, and the raw array as receiver running natively and silently (Q71 b). `tests/AGENTS.md` gained its index row. No test file of tickets 02 to 04 is edited (`git diff 346cc58 56e4bad --stat -- tests` lists only `tests/AGENTS.md` and the new file). `package.json` and `jsr.json` both read `2002.0.0`; no handbook file differs from base.

Checks on `bb2659c` in the worktree and again on `56e4bad` in the change branch checkout, every one exit 0: `npm test` `tests 307`, `pass 307`, `fail 0`; `npm run test:coverage` `all files | 100.00 | 100.00 | 100.00`; `npm run check` `Checked 64 files`, `No fixes applied.`; `npm run build` `dist/src/index.min.js 12.8kb`.

### Full outputs, final measurement

#### base `77fd93e`, run 1 (triplet 1)

```

> @nerdalytics/beacon@2002.0.0 benchmark
> node --expose-gc scripts/benchmark.ts -R 3

=== Beacon Benchmark (1,000,000 iterations, 3 cycles × 7 samples = 21 total) ===

Cycle 1/3...
Cycle 2/3...
Cycle 3/3...
classic loop              :  med=1.75ms  mean=1.78ms  min=1.59ms  max=1.99ms  sd=0.11ms  heap=11kb  total=37.31ms  avg/cycle=12.44ms  total mem=238kb  avg mem/cycle=79kb
state no subs             :  med=37.78ms  mean=34.52ms  min=25.26ms  max=41.29ms  sd=6.01ms  heap=10kb  total=724.99ms  avg/cycle=241.66ms  total mem=303kb  avg mem/cycle=101kb
state + derive            :  med=170.88ms  mean=162.19ms  min=139.61ms  max=176.51ms  sd=14.26ms  heap=179945kb  total=3406.00ms  avg/cycle=1135.33ms  total mem=2615381kb  avg mem/cycle=871794kb
state + derive + 2 effects:  med=325.70ms  mean=313.64ms  min=279.04ms  max=335.60ms  sd=21.69ms  heap=130966kb  total=6586.50ms  avg/cycle=2195.50ms  total mem=1949257kb  avg mem/cycle=649752kb
batch + derive            :  med=42.85ms  mean=39.71ms  min=31.30ms  max=44.93ms  sd=5.04ms  heap=24kb  total=833.85ms  avg/cycle=277.95ms  total mem=556kb  avg mem/cycle=185kb
batch + derive + 2 effects:  med=43.40ms  mean=39.89ms  min=31.21ms  max=44.80ms  sd=5.68ms  heap=34kb  total=837.71ms  avg/cycle=279.24ms  total mem=683kb  avg mem/cycle=228kb

--- Targeted benchmarks ---

state creation            :  med=28.47ms  mean=26.25ms  min=17.99ms  max=33.94ms  sd=5.47ms  heap=15667kb  total=551.20ms  avg/cycle=183.73ms  total mem=329016kb  avg mem/cycle=109672kb
state read (no effect)    :  med=16.50ms  mean=16.59ms  min=15.93ms  max=17.51ms  sd=0.44ms  heap=7kb  total=348.42ms  avg/cycle=116.14ms  total mem=145kb  avg mem/cycle=48kb
state write 1 sub         :  med=13.11ms  mean=13.12ms  min=11.61ms  max=15.48ms  sd=0.98ms  heap=16108kb  total=275.55ms  avg/cycle=91.85ms  total mem=328332kb  avg mem/cycle=109444kb
state write 100 subs      :  med=87.94ms  mean=88.44ms  min=85.47ms  max=94.33ms  sd=1.87ms  heap=80081kb  total=1857.25ms  avg/cycle=619.08ms  total mem=1679821kb  avg mem/cycle=559940kb
effect triggers           :  med=7.58ms  mean=8.16ms  min=7.14ms  max=9.81ms  sd=0.97ms  heap=10241kb  total=171.29ms  avg/cycle=57.10ms  total mem=209163kb  avg mem/cycle=69721kb
array push/pop (hookless) :  med=51.94ms  mean=52.04ms  min=50.62ms  max=53.83ms  sd=0.87ms  heap=47679kb  total=1092.80ms  avg/cycle=364.27ms  total mem=993556kb  avg mem/cycle=331185kb
array push/pop (hooks)    :  med=53.31ms  mean=53.88ms  min=52.64ms  max=57.45ms  sd=1.25ms  heap=48501kb  total=1131.56ms  avg/cycle=377.19ms  total mem=1024897kb  avg mem/cycle=341632kb
many dependencies         :  med=2.01ms  mean=2.12ms  min=1.36ms  max=3.71ms  sd=0.53ms  heap=5956kb  total=44.46ms  avg/cycle=14.82ms  total mem=133858kb  avg mem/cycle=44619kb
derive chain depth 10     :  med=2.57ms  mean=2.69ms  min=1.54ms  max=4.40ms  sd=0.94ms  heap=3751kb  total=56.53ms  avg/cycle=18.84ms  total mem=86748kb  avg mem/cycle=28916kb
100 states individual     :  med=25.22ms  mean=25.33ms  min=24.25ms  max=26.31ms  sd=0.51ms  heap=6878kb  total=531.94ms  avg/cycle=177.31ms  total mem=140524kb  avg mem/cycle=46841kb
100 states batched        :  med=1.96ms  mean=2.01ms  min=1.50ms  max=2.94ms  sd=0.47ms  heap=8692kb  total=42.15ms  avg/cycle=14.05ms  total mem=167137kb  avg mem/cycle=55712kb
100 subs disjoint props   :  med=2.41ms  mean=2.33ms  min=1.44ms  max=3.46ms  sd=0.65ms  heap=2757kb  total=48.96ms  avg/cycle=16.32ms  total mem=50882kb  avg mem/cycle=16961kb

--- Non-extensible targets (subscriber set lives in the WeakMap fallback) ---

sealed write 1 sub        :  med=14.42ms  mean=14.71ms  min=13.63ms  max=16.53ms  sd=0.80ms  heap=15996kb  total=308.95ms  avg/cycle=102.98ms  total mem=337649kb  avg mem/cycle=112550kb
state no subs after seal  :  med=40.00ms  mean=40.22ms  min=38.44ms  max=41.71ms  sd=0.85ms  heap=21kb  total=844.67ms  avg/cycle=281.56ms  total mem=374kb  avg mem/cycle=125kb

--- Blind spots (creation shapes, nested read, equal and undefined writes) ---

state creation (array)    :  med=28.34ms  mean=26.08ms  min=17.82ms  max=31.63ms  sd=4.73ms  heap=18012kb  total=547.61ms  avg/cycle=182.54ms  total mem=378273kb  avg mem/cycle=126091kb
state creation (sealed)   :  med=21.06ms  mean=21.48ms  min=18.68ms  max=26.29ms  sd=1.84ms  heap=6298kb  total=451.17ms  avg/cycle=150.39ms  total mem=132264kb  avg mem/cycle=44088kb
state read nested         :  med=38.59ms  mean=38.42ms  min=37.27ms  max=39.27ms  sd=0.56ms  heap=8kb  total=806.74ms  avg/cycle=268.91ms  total mem=162kb  avg mem/cycle=54kb
state write equal value   :  med=18.04ms  mean=17.67ms  min=16.34ms  max=18.69ms  sd=0.81ms  heap=7kb  total=371.13ms  avg/cycle=123.71ms  total mem=146kb  avg mem/cycle=49kb
array push/pop (undefined):  med=49.05ms  mean=49.21ms  min=48.37ms  max=50.45ms  sd=0.60ms  heap=35078kb  total=1033.33ms  avg/cycle=344.44ms  total mem=736467kb  avg mem/cycle=245489kb

Total: 22.9s  Avg/cycle: 7.6s  Total mem: 11295831kb  Avg mem/cycle: 3765277kb
```

#### base `77fd93e`, run 2 (triplet 2)

```

> @nerdalytics/beacon@2002.0.0 benchmark
> node --expose-gc scripts/benchmark.ts -R 3

=== Beacon Benchmark (1,000,000 iterations, 3 cycles × 7 samples = 21 total) ===

Cycle 1/3...
Cycle 2/3...
Cycle 3/3...
classic loop              :  med=0.66ms  mean=1.09ms  min=0.60ms  max=2.28ms  sd=0.62ms  heap=0kb  total=22.98ms  avg/cycle=7.66ms  total mem=96kb  avg mem/cycle=32kb
state no subs             :  med=38.28ms  mean=34.95ms  min=25.64ms  max=41.04ms  sd=6.04ms  heap=10kb  total=733.85ms  avg/cycle=244.62ms  total mem=302kb  avg mem/cycle=101kb
state + derive            :  med=169.51ms  mean=163.21ms  min=137.05ms  max=199.82ms  sd=16.35ms  heap=178707kb  total=3427.49ms  avg/cycle=1142.50ms  total mem=2539117kb  avg mem/cycle=846372kb
state + derive + 2 effects:  med=318.43ms  mean=307.05ms  min=265.33ms  max=346.29ms  sd=27.94ms  heap=131198kb  total=6448.08ms  avg/cycle=2149.36ms  total mem=1967184kb  avg mem/cycle=655728kb
batch + derive            :  med=42.88ms  mean=39.81ms  min=31.26ms  max=44.60ms  sd=5.27ms  heap=29kb  total=836.04ms  avg/cycle=278.68ms  total mem=577kb  avg mem/cycle=192kb
batch + derive + 2 effects:  med=43.38ms  mean=40.23ms  min=31.83ms  max=45.02ms  sd=5.17ms  heap=34kb  total=844.82ms  avg/cycle=281.61ms  total mem=683kb  avg mem/cycle=228kb

--- Targeted benchmarks ---

state creation            :  med=21.33ms  mean=21.07ms  min=17.31ms  max=24.45ms  sd=1.69ms  heap=15668kb  total=442.44ms  avg/cycle=147.48ms  total mem=329028kb  avg mem/cycle=109676kb
state read (no effect)    :  med=16.56ms  mean=16.57ms  min=15.72ms  max=18.21ms  sd=0.49ms  heap=7kb  total=348.06ms  avg/cycle=116.02ms  total mem=145kb  avg mem/cycle=48kb
state write 1 sub         :  med=13.09ms  mean=13.30ms  min=12.13ms  max=15.47ms  sd=0.91ms  heap=16132kb  total=279.28ms  avg/cycle=93.09ms  total mem=330011kb  avg mem/cycle=110004kb
state write 100 subs      :  med=86.63ms  mean=86.80ms  min=84.64ms  max=89.82ms  sd=1.50ms  heap=80081kb  total=1822.85ms  avg/cycle=607.62ms  total mem=1680108kb  avg mem/cycle=560036kb
effect triggers           :  med=7.51ms  mean=8.01ms  min=7.07ms  max=9.76ms  sd=0.94ms  heap=10259kb  total=168.11ms  avg/cycle=56.04ms  total mem=208287kb  avg mem/cycle=69429kb
array push/pop (hookless) :  med=51.88ms  mean=52.22ms  min=50.78ms  max=56.40ms  sd=1.24ms  heap=47644kb  total=1096.54ms  avg/cycle=365.51ms  total mem=994427kb  avg mem/cycle=331476kb
array push/pop (hooks)    :  med=54.59ms  mean=54.74ms  min=52.29ms  max=59.22ms  sd=1.75ms  heap=48478kb  total=1149.61ms  avg/cycle=383.20ms  total mem=1024543kb  avg mem/cycle=341514kb
many dependencies         :  med=2.02ms  mean=2.13ms  min=1.49ms  max=3.67ms  sd=0.52ms  heap=5945kb  total=44.64ms  avg/cycle=14.88ms  total mem=133284kb  avg mem/cycle=44428kb
derive chain depth 10     :  med=2.52ms  mean=2.67ms  min=1.57ms  max=4.43ms  sd=0.98ms  heap=3750kb  total=56.04ms  avg/cycle=18.68ms  total mem=81709kb  avg mem/cycle=27236kb
100 states individual     :  med=25.64ms  mean=25.56ms  min=24.36ms  max=26.64ms  sd=0.55ms  heap=6922kb  total=536.69ms  avg/cycle=178.90ms  total mem=144044kb  avg mem/cycle=48015kb
100 states batched        :  med=1.92ms  mean=1.98ms  min=1.30ms  max=2.74ms  sd=0.48ms  heap=8690kb  total=41.68ms  avg/cycle=13.89ms  total mem=163438kb  avg mem/cycle=54479kb
100 subs disjoint props   :  med=2.32ms  mean=2.25ms  min=1.40ms  max=3.53ms  sd=0.65ms  heap=2970kb  total=47.15ms  avg/cycle=15.72ms  total mem=51214kb  avg mem/cycle=17071kb

--- Non-extensible targets (subscriber set lives in the WeakMap fallback) ---

sealed write 1 sub        :  med=14.74ms  mean=14.87ms  min=13.86ms  max=16.61ms  sd=0.69ms  heap=15985kb  total=312.35ms  avg/cycle=104.12ms  total mem=337283kb  avg mem/cycle=112428kb
state no subs after seal  :  med=40.98ms  mean=41.36ms  min=39.05ms  max=51.42ms  sd=2.39ms  heap=21kb  total=868.60ms  avg/cycle=289.53ms  total mem=355kb  avg mem/cycle=118kb

--- Blind spots (creation shapes, nested read, equal and undefined writes) ---

state creation (array)    :  med=20.89ms  mean=21.36ms  min=19.26ms  max=25.69ms  sd=1.40ms  heap=18012kb  total=448.51ms  avg/cycle=149.50ms  total mem=378258kb  avg mem/cycle=126086kb
state creation (sealed)   :  med=22.23ms  mean=22.21ms  min=19.21ms  max=24.31ms  sd=1.52ms  heap=6297kb  total=466.34ms  avg/cycle=155.45ms  total mem=132255kb  avg mem/cycle=44085kb
state read nested         :  med=38.91ms  mean=39.03ms  min=37.37ms  max=40.70ms  sd=0.74ms  heap=8kb  total=819.56ms  avg/cycle=273.19ms  total mem=162kb  avg mem/cycle=54kb
state write equal value   :  med=18.38ms  mean=18.36ms  min=17.49ms  max=19.13ms  sd=0.39ms  heap=7kb  total=385.55ms  avg/cycle=128.52ms  total mem=145kb  avg mem/cycle=48kb
array push/pop (undefined):  med=49.77ms  mean=49.77ms  min=48.58ms  max=54.12ms  sd=1.17ms  heap=35088kb  total=1045.12ms  avg/cycle=348.37ms  total mem=736858kb  avg mem/cycle=245619kb

Total: 22.7s  Avg/cycle: 7.6s  Total mem: 11233514kb  Avg mem/cycle: 3744505kb
```

#### base `77fd93e`, run 3 (triplet 3)

```

> @nerdalytics/beacon@2002.0.0 benchmark
> node --expose-gc scripts/benchmark.ts -R 3

=== Beacon Benchmark (1,000,000 iterations, 3 cycles × 7 samples = 21 total) ===

Cycle 1/3...
Cycle 2/3...
Cycle 3/3...
classic loop              :  med=1.75ms  mean=1.72ms  min=1.46ms  max=1.91ms  sd=0.12ms  heap=11kb  total=36.05ms  avg/cycle=12.02ms  total mem=238kb  avg mem/cycle=79kb
state no subs             :  med=38.51ms  mean=35.14ms  min=25.35ms  max=44.01ms  sd=6.72ms  heap=10kb  total=737.91ms  avg/cycle=245.97ms  total mem=303kb  avg mem/cycle=101kb
state + derive            :  med=168.40ms  mean=160.78ms  min=138.14ms  max=175.46ms  sd=14.39ms  heap=178995kb  total=3376.48ms  avg/cycle=1125.49ms  total mem=2541621kb  avg mem/cycle=847207kb
state + derive + 2 effects:  med=317.19ms  mean=301.86ms  min=260.55ms  max=325.76ms  sd=26.08ms  heap=131178kb  total=6339.02ms  avg/cycle=2113.01ms  total mem=1964472kb  avg mem/cycle=654824kb
batch + derive            :  med=42.92ms  mean=39.90ms  min=31.68ms  max=45.57ms  sd=5.15ms  heap=24kb  total=837.96ms  avg/cycle=279.32ms  total mem=557kb  avg mem/cycle=186kb
batch + derive + 2 effects:  med=42.60ms  mean=39.73ms  min=31.80ms  max=44.54ms  sd=5.17ms  heap=34kb  total=834.28ms  avg/cycle=278.09ms  total mem=683kb  avg mem/cycle=228kb

--- Targeted benchmarks ---

state creation            :  med=27.55ms  mean=25.56ms  min=17.13ms  max=32.17ms  sd=4.73ms  heap=15668kb  total=536.75ms  avg/cycle=178.92ms  total mem=329034kb  avg mem/cycle=109678kb
state read (no effect)    :  med=16.53ms  mean=16.52ms  min=15.46ms  max=17.31ms  sd=0.49ms  heap=7kb  total=346.83ms  avg/cycle=115.61ms  total mem=146kb  avg mem/cycle=49kb
state write 1 sub         :  med=12.98ms  mean=13.05ms  min=11.68ms  max=14.96ms  sd=0.83ms  heap=16109kb  total=274.14ms  avg/cycle=91.38ms  total mem=328078kb  avg mem/cycle=109359kb
state write 100 subs      :  med=87.07ms  mean=86.70ms  min=84.31ms  max=91.05ms  sd=1.72ms  heap=80122kb  total=1820.67ms  avg/cycle=606.89ms  total mem=1680462kb  avg mem/cycle=560154kb
effect triggers           :  med=7.50ms  mean=7.85ms  min=5.24ms  max=9.54ms  sd=1.03ms  heap=10218kb  total=164.94ms  avg/cycle=54.98ms  total mem=204882kb  avg mem/cycle=68294kb
array push/pop (hookless) :  med=51.40ms  mean=51.40ms  min=49.54ms  max=53.84ms  sd=1.13ms  heap=47636kb  total=1079.47ms  avg/cycle=359.82ms  total mem=993622kb  avg mem/cycle=331207kb
array push/pop (hooks)    :  med=53.23ms  mean=53.40ms  min=52.02ms  max=55.58ms  sd=1.01ms  heap=48510kb  total=1121.37ms  avg/cycle=373.79ms  total mem=1024772kb  avg mem/cycle=341591kb
many dependencies         :  med=1.91ms  mean=2.08ms  min=1.37ms  max=3.84ms  sd=0.52ms  heap=5955kb  total=43.68ms  avg/cycle=14.56ms  total mem=134230kb  avg mem/cycle=44743kb
derive chain depth 10     :  med=2.40ms  mean=2.58ms  min=1.54ms  max=4.20ms  sd=0.99ms  heap=3750kb  total=54.09ms  avg/cycle=18.03ms  total mem=79882kb  avg mem/cycle=26627kb
100 states individual     :  med=24.80ms  mean=24.80ms  min=23.73ms  max=25.94ms  sd=0.68ms  heap=6834kb  total=520.76ms  avg/cycle=173.59ms  total mem=140211kb  avg mem/cycle=46737kb
100 states batched        :  med=1.77ms  mean=1.90ms  min=1.26ms  max=2.82ms  sd=0.43ms  heap=7545kb  total=39.83ms  avg/cycle=13.28ms  total mem=163253kb  avg mem/cycle=54418kb
100 subs disjoint props   :  med=2.27ms  mean=2.20ms  min=1.37ms  max=3.67ms  sd=0.75ms  heap=2589kb  total=46.30ms  avg/cycle=15.43ms  total mem=48601kb  avg mem/cycle=16200kb

--- Non-extensible targets (subscriber set lives in the WeakMap fallback) ---

sealed write 1 sub        :  med=14.41ms  mean=14.48ms  min=13.64ms  max=16.40ms  sd=0.70ms  heap=15992kb  total=304.17ms  avg/cycle=101.39ms  total mem=337819kb  avg mem/cycle=112606kb
state no subs after seal  :  med=40.38ms  mean=40.19ms  min=36.27ms  max=45.01ms  sd=1.87ms  heap=21kb  total=844.01ms  avg/cycle=281.34ms  total mem=370kb  avg mem/cycle=123kb

--- Blind spots (creation shapes, nested read, equal and undefined writes) ---

state creation (array)    :  med=27.85ms  mean=26.06ms  min=16.82ms  max=35.81ms  sd=5.73ms  heap=18012kb  total=547.17ms  avg/cycle=182.39ms  total mem=378277kb  avg mem/cycle=126092kb
state creation (sealed)   :  med=21.06ms  mean=21.61ms  min=18.82ms  max=27.19ms  sd=2.22ms  heap=6298kb  total=453.71ms  avg/cycle=151.24ms  total mem=132265kb  avg mem/cycle=44088kb
state read nested         :  med=37.96ms  mean=38.04ms  min=36.52ms  max=39.51ms  sd=0.67ms  heap=8kb  total=798.85ms  avg/cycle=266.28ms  total mem=162kb  avg mem/cycle=54kb
state write equal value   :  med=18.14ms  mean=18.05ms  min=16.58ms  max=19.14ms  sd=0.68ms  heap=7kb  total=379.03ms  avg/cycle=126.34ms  total mem=145kb  avg mem/cycle=48kb
array push/pop (undefined):  med=49.17ms  mean=49.39ms  min=48.78ms  max=50.63ms  sd=0.54ms  heap=35083kb  total=1037.09ms  avg/cycle=345.70ms  total mem=736782kb  avg mem/cycle=245594kb

Total: 22.6s  Avg/cycle: 7.5s  Total mem: 11220867kb  Avg mem/cycle: 3740289kb
```

#### final `bb2659c`, run 1 (triplet 1)

```

> @nerdalytics/beacon@2002.0.0 benchmark
> node --expose-gc scripts/benchmark.ts -R 3

=== Beacon Benchmark (1,000,000 iterations, 3 cycles × 7 samples = 21 total) ===

Cycle 1/3...
Cycle 2/3...
Cycle 3/3...
classic loop              :  med=1.78ms  mean=1.76ms  min=1.52ms  max=2.11ms  sd=0.14ms  heap=11kb  total=36.98ms  avg/cycle=12.33ms  total mem=238kb  avg mem/cycle=79kb
state no subs             :  med=38.99ms  mean=35.45ms  min=26.11ms  max=40.73ms  sd=5.89ms  heap=10kb  total=744.50ms  avg/cycle=248.17ms  total mem=288kb  avg mem/cycle=96kb
state + derive            :  med=169.64ms  mean=162.00ms  min=140.77ms  max=175.45ms  sd=13.66ms  heap=68836kb  total=3401.98ms  avg/cycle=1133.99ms  total mem=1048487kb  avg mem/cycle=349496kb
state + derive + 2 effects:  med=321.64ms  mean=309.93ms  min=274.83ms  max=330.08ms  sd=20.32ms  heap=63827kb  total=6508.54ms  avg/cycle=2169.51ms  total mem=1013354kb  avg mem/cycle=337785kb
batch + derive            :  med=42.46ms  mean=39.93ms  min=32.11ms  max=47.15ms  sd=4.90ms  heap=19kb  total=838.54ms  avg/cycle=279.51ms  total mem=252kb  avg mem/cycle=84kb
batch + derive + 2 effects:  med=42.71ms  mean=39.72ms  min=31.58ms  max=46.05ms  sd=5.38ms  heap=24kb  total=834.10ms  avg/cycle=278.03ms  total mem=626kb  avg mem/cycle=209kb

--- Targeted benchmarks ---

state creation            :  med=9.87ms  mean=9.89ms  min=9.53ms  max=10.33ms  sd=0.22ms  heap=15680kb  total=207.63ms  avg/cycle=69.21ms  total mem=329323kb  avg mem/cycle=109774kb
state read (no effect)    :  med=16.75ms  mean=16.80ms  min=16.14ms  max=17.54ms  sd=0.33ms  heap=7kb  total=352.71ms  avg/cycle=117.57ms  total mem=146kb  avg mem/cycle=49kb
state write 1 sub         :  med=12.81ms  mean=12.92ms  min=11.64ms  max=15.44ms  sd=0.93ms  heap=16105kb  total=271.37ms  avg/cycle=90.46ms  total mem=328828kb  avg mem/cycle=109609kb
state write 100 subs      :  med=87.07ms  mean=87.00ms  min=82.95ms  max=93.04ms  sd=2.37ms  heap=80082kb  total=1827.07ms  avg/cycle=609.02ms  total mem=1362222kb  avg mem/cycle=454074kb
effect triggers           :  med=7.49ms  mean=7.62ms  min=6.12ms  max=9.41ms  sd=0.89ms  heap=10255kb  total=160.10ms  avg/cycle=53.37ms  total mem=203437kb  avg mem/cycle=67812kb
array push/pop (hookless) :  med=23.64ms  mean=23.94ms  min=23.22ms  max=26.45ms  sd=0.85ms  heap=48101kb  total=502.65ms  avg/cycle=167.55ms  total mem=930158kb  avg mem/cycle=310053kb
array push/pop (hooks)    :  med=25.40ms  mean=25.62ms  min=24.91ms  max=27.61ms  sd=0.76ms  heap=47963kb  total=538.08ms  avg/cycle=179.36ms  total mem=931146kb  avg mem/cycle=310382kb
many dependencies         :  med=1.97ms  mean=2.00ms  min=1.42ms  max=2.96ms  sd=0.37ms  heap=5951kb  total=42.07ms  avg/cycle=14.02ms  total mem=134009kb  avg mem/cycle=44670kb
derive chain depth 10     :  med=2.34ms  mean=2.57ms  min=1.60ms  max=4.56ms  sd=0.91ms  heap=3749kb  total=53.94ms  avg/cycle=17.98ms  total mem=81658kb  avg mem/cycle=27219kb
100 states individual     :  med=25.61ms  mean=25.71ms  min=24.44ms  max=27.63ms  sd=0.78ms  heap=6205kb  total=539.83ms  avg/cycle=179.94ms  total mem=135419kb  avg mem/cycle=45140kb
100 states batched        :  med=1.74ms  mean=1.84ms  min=1.33ms  max=2.96ms  sd=0.35ms  heap=5905kb  total=38.72ms  avg/cycle=12.91ms  total mem=135094kb  avg mem/cycle=45031kb
100 subs disjoint props   :  med=2.23ms  mean=2.13ms  min=1.40ms  max=3.54ms  sd=0.65ms  heap=2587kb  total=44.78ms  avg/cycle=14.93ms  total mem=47940kb  avg mem/cycle=15980kb

--- Non-extensible targets (subscriber set lives in the WeakMap fallback) ---

sealed write 1 sub        :  med=14.37ms  mean=14.47ms  min=13.34ms  max=15.87ms  sd=0.70ms  heap=15851kb  total=303.94ms  avg/cycle=101.31ms  total mem=312038kb  avg mem/cycle=104013kb
state no subs after seal  :  med=40.28ms  mean=40.69ms  min=39.36ms  max=42.97ms  sd=1.03ms  heap=22kb  total=854.48ms  avg/cycle=284.83ms  total mem=383kb  avg mem/cycle=128kb

--- Blind spots (creation shapes, nested read, equal and undefined writes) ---

state creation (array)    :  med=18.96ms  mean=19.05ms  min=18.52ms  max=19.69ms  sd=0.31ms  heap=3239kb  total=400.14ms  avg/cycle=133.38ms  total mem=67986kb  avg mem/cycle=22662kb
state creation (sealed)   :  med=19.39ms  mean=19.57ms  min=17.98ms  max=22.48ms  sd=1.23ms  heap=6303kb  total=411.06ms  avg/cycle=137.02ms  total mem=132393kb  avg mem/cycle=44131kb
state read nested         :  med=35.24ms  mean=35.10ms  min=34.30ms  max=35.75ms  sd=0.41ms  heap=8kb  total=737.10ms  avg/cycle=245.70ms  total mem=176kb  avg mem/cycle=59kb
state write equal value   :  med=18.07ms  mean=17.81ms  min=16.20ms  max=20.59ms  sd=1.04ms  heap=7kb  total=374.03ms  avg/cycle=124.68ms  total mem=145kb  avg mem/cycle=48kb
array push/pop (undefined):  med=23.69ms  mean=23.89ms  min=22.98ms  max=26.48ms  sd=0.90ms  heap=48438kb  total=501.63ms  avg/cycle=167.21ms  total mem=1062555kb  avg mem/cycle=354185kb

Total: 20.5s  Avg/cycle: 6.8s  Total mem: 8258301kb  Avg mem/cycle: 2752767kb
```

#### final `bb2659c`, run 2 (triplet 2)

```

> @nerdalytics/beacon@2002.0.0 benchmark
> node --expose-gc scripts/benchmark.ts -R 3

=== Beacon Benchmark (1,000,000 iterations, 3 cycles × 7 samples = 21 total) ===

Cycle 1/3...
Cycle 2/3...
Cycle 3/3...
classic loop              :  med=1.75ms  mean=1.74ms  min=1.55ms  max=1.89ms  sd=0.09ms  heap=11kb  total=36.44ms  avg/cycle=12.15ms  total mem=238kb  avg mem/cycle=79kb
state no subs             :  med=37.85ms  mean=35.52ms  min=25.79ms  max=43.43ms  sd=6.43ms  heap=9kb  total=745.91ms  avg/cycle=248.64ms  total mem=289kb  avg mem/cycle=96kb
state + derive            :  med=168.59ms  mean=161.42ms  min=132.33ms  max=174.94ms  sd=14.47ms  heap=68795kb  total=3389.86ms  avg/cycle=1129.95ms  total mem=1043617kb  avg mem/cycle=347872kb
state + derive + 2 effects:  med=315.78ms  mean=304.55ms  min=270.44ms  max=331.09ms  sd=21.58ms  heap=63731kb  total=6395.49ms  avg/cycle=2131.83ms  total mem=1010073kb  avg mem/cycle=336691kb
batch + derive            :  med=42.74ms  mean=39.69ms  min=31.50ms  max=45.10ms  sd=5.04ms  heap=19kb  total=833.46ms  avg/cycle=277.82ms  total mem=308kb  avg mem/cycle=103kb
batch + derive + 2 effects:  med=43.24ms  mean=39.63ms  min=31.63ms  max=43.96ms  sd=5.23ms  heap=24kb  total=832.29ms  avg/cycle=277.43ms  total mem=624kb  avg mem/cycle=208kb

--- Targeted benchmarks ---

state creation            :  med=10.02ms  mean=9.92ms  min=9.48ms  max=10.39ms  sd=0.28ms  heap=15682kb  total=208.35ms  avg/cycle=69.45ms  total mem=329344kb  avg mem/cycle=109781kb
state read (no effect)    :  med=16.51ms  mean=16.42ms  min=15.37ms  max=17.48ms  sd=0.59ms  heap=7kb  total=344.87ms  avg/cycle=114.96ms  total mem=146kb  avg mem/cycle=49kb
state write 1 sub         :  med=12.82ms  mean=13.07ms  min=11.65ms  max=15.28ms  sd=0.88ms  heap=16173kb  total=274.55ms  avg/cycle=91.52ms  total mem=329894kb  avg mem/cycle=109965kb
state write 100 subs      :  med=85.72ms  mean=85.14ms  min=80.70ms  max=90.08ms  sd=2.81ms  heap=80071kb  total=1787.87ms  avg/cycle=595.96ms  total mem=1362386kb  avg mem/cycle=454129kb
effect triggers           :  med=7.34ms  mean=7.42ms  min=6.65ms  max=9.44ms  sd=0.68ms  heap=10315kb  total=155.87ms  avg/cycle=51.96ms  total mem=206297kb  avg mem/cycle=68766kb
array push/pop (hookless) :  med=23.54ms  mean=23.65ms  min=22.88ms  max=25.58ms  sd=0.64ms  heap=48356kb  total=496.57ms  avg/cycle=165.52ms  total mem=930817kb  avg mem/cycle=310272kb
array push/pop (hooks)    :  med=25.24ms  mean=25.45ms  min=24.14ms  max=27.53ms  sd=0.83ms  heap=47991kb  total=534.54ms  avg/cycle=178.18ms  total mem=930606kb  avg mem/cycle=310202kb
many dependencies         :  med=1.93ms  mean=1.95ms  min=1.41ms  max=2.80ms  sd=0.36ms  heap=5947kb  total=41.00ms  avg/cycle=13.67ms  total mem=133963kb  avg mem/cycle=44654kb
derive chain depth 10     :  med=2.23ms  mean=2.61ms  min=1.58ms  max=4.39ms  sd=1.05ms  heap=3750kb  total=54.91ms  avg/cycle=18.30ms  total mem=82552kb  avg mem/cycle=27517kb
100 states individual     :  med=25.21ms  mean=25.40ms  min=24.39ms  max=26.73ms  sd=0.70ms  heap=6928kb  total=533.37ms  avg/cycle=177.79ms  total mem=142102kb  avg mem/cycle=47367kb
100 states batched        :  med=1.58ms  mean=1.71ms  min=1.30ms  max=2.67ms  sd=0.32ms  heap=5896kb  total=36.00ms  avg/cycle=12.00ms  total mem=135107kb  avg mem/cycle=45036kb
100 subs disjoint props   :  med=2.10ms  mean=2.13ms  min=1.43ms  max=3.58ms  sd=0.66ms  heap=2588kb  total=44.64ms  avg/cycle=14.88ms  total mem=48032kb  avg mem/cycle=16011kb

--- Non-extensible targets (subscriber set lives in the WeakMap fallback) ---

sealed write 1 sub        :  med=14.22ms  mean=14.35ms  min=13.47ms  max=15.75ms  sd=0.67ms  heap=16031kb  total=301.43ms  avg/cycle=100.48ms  total mem=327552kb  avg mem/cycle=109184kb
state no subs after seal  :  med=40.84ms  mean=40.34ms  min=36.77ms  max=43.10ms  sd=1.99ms  heap=22kb  total=847.19ms  avg/cycle=282.40ms  total mem=382kb  avg mem/cycle=127kb

--- Blind spots (creation shapes, nested read, equal and undefined writes) ---

state creation (array)    :  med=18.93ms  mean=19.09ms  min=18.49ms  max=20.15ms  sd=0.43ms  heap=3239kb  total=400.83ms  avg/cycle=133.61ms  total mem=67992kb  avg mem/cycle=22664kb
state creation (sealed)   :  med=12.42ms  mean=12.54ms  min=9.21ms  max=16.45ms  sd=1.66ms  heap=6303kb  total=263.36ms  avg/cycle=87.79ms  total mem=132384kb  avg mem/cycle=44128kb
state read nested         :  med=35.34ms  mean=35.37ms  min=34.30ms  max=36.61ms  sd=0.55ms  heap=8kb  total=742.73ms  avg/cycle=247.58ms  total mem=176kb  avg mem/cycle=59kb
state write equal value   :  med=17.95ms  mean=17.69ms  min=16.07ms  max=18.98ms  sd=0.99ms  heap=7kb  total=371.53ms  avg/cycle=123.84ms  total mem=145kb  avg mem/cycle=48kb
array push/pop (undefined):  med=23.42ms  mean=23.82ms  min=22.80ms  max=25.89ms  sd=0.90ms  heap=48432kb  total=500.32ms  avg/cycle=166.77ms  total mem=1062801kb  avg mem/cycle=354267kb

Total: 20.2s  Avg/cycle: 6.7s  Total mem: 8277827kb  Avg mem/cycle: 2759276kb
```

#### final `bb2659c`, run 3 (triplet 3)

```

> @nerdalytics/beacon@2002.0.0 benchmark
> node --expose-gc scripts/benchmark.ts -R 3

=== Beacon Benchmark (1,000,000 iterations, 3 cycles × 7 samples = 21 total) ===

Cycle 1/3...
Cycle 2/3...
Cycle 3/3...
classic loop              :  med=1.80ms  mean=1.79ms  min=1.63ms  max=2.00ms  sd=0.12ms  heap=11kb  total=37.55ms  avg/cycle=12.52ms  total mem=238kb  avg mem/cycle=79kb
state no subs             :  med=37.55ms  mean=35.38ms  min=26.47ms  max=41.88ms  sd=6.02ms  heap=10kb  total=742.98ms  avg/cycle=247.66ms  total mem=288kb  avg mem/cycle=96kb
state + derive            :  med=169.99ms  mean=162.82ms  min=141.11ms  max=179.19ms  sd=13.93ms  heap=68870kb  total=3419.22ms  avg/cycle=1139.74ms  total mem=1042913kb  avg mem/cycle=347638kb
state + derive + 2 effects:  med=320.69ms  mean=309.50ms  min=272.87ms  max=336.12ms  sd=23.39ms  heap=63825kb  total=6499.52ms  avg/cycle=2166.51ms  total mem=1032351kb  avg mem/cycle=344117kb
batch + derive            :  med=43.01ms  mean=40.12ms  min=31.55ms  max=44.30ms  sd=4.67ms  heap=19kb  total=842.57ms  avg/cycle=280.86ms  total mem=257kb  avg mem/cycle=86kb
batch + derive + 2 effects:  med=43.03ms  mean=40.54ms  min=32.46ms  max=47.51ms  sd=5.23ms  heap=24kb  total=851.24ms  avg/cycle=283.75ms  total mem=626kb  avg mem/cycle=209kb

--- Targeted benchmarks ---

state creation            :  med=9.98ms  mean=9.96ms  min=9.51ms  max=10.56ms  sd=0.30ms  heap=15682kb  total=209.17ms  avg/cycle=69.72ms  total mem=329357kb  avg mem/cycle=109786kb
state read (no effect)    :  med=16.62ms  mean=16.63ms  min=15.62ms  max=17.56ms  sd=0.44ms  heap=7kb  total=349.21ms  avg/cycle=116.40ms  total mem=145kb  avg mem/cycle=48kb
state write 1 sub         :  med=12.86ms  mean=13.02ms  min=11.84ms  max=14.68ms  sd=0.77ms  heap=16174kb  total=273.32ms  avg/cycle=91.11ms  total mem=328602kb  avg mem/cycle=109534kb
state write 100 subs      :  med=86.64ms  mean=86.56ms  min=82.51ms  max=90.95ms  sd=1.98ms  heap=80056kb  total=1817.84ms  avg/cycle=605.95ms  total mem=1362559kb  avg mem/cycle=454186kb
effect triggers           :  med=7.41ms  mean=7.59ms  min=6.72ms  max=9.43ms  sd=0.69ms  heap=10356kb  total=159.42ms  avg/cycle=53.14ms  total mem=206322kb  avg mem/cycle=68774kb
array push/pop (hookless) :  med=23.44ms  mean=23.63ms  min=22.54ms  max=25.23ms  sd=0.69ms  heap=48399kb  total=496.14ms  avg/cycle=165.38ms  total mem=930543kb  avg mem/cycle=310181kb
array push/pop (hooks)    :  med=25.45ms  mean=25.67ms  min=24.57ms  max=28.13ms  sd=0.78ms  heap=48026kb  total=539.11ms  avg/cycle=179.70ms  total mem=934084kb  avg mem/cycle=311361kb
many dependencies         :  med=2.02ms  mean=2.03ms  min=1.54ms  max=3.03ms  sd=0.37ms  heap=5945kb  total=42.71ms  avg/cycle=14.24ms  total mem=132317kb  avg mem/cycle=44106kb
derive chain depth 10     :  med=2.21ms  mean=2.62ms  min=1.59ms  max=4.51ms  sd=0.97ms  heap=3702kb  total=55.03ms  avg/cycle=18.34ms  total mem=79251kb  avg mem/cycle=26417kb
100 states individual     :  med=26.18ms  mean=26.12ms  min=24.47ms  max=28.47ms  sd=0.87ms  heap=7051kb  total=548.47ms  avg/cycle=182.82ms  total mem=146611kb  avg mem/cycle=48870kb
100 states batched        :  med=1.75ms  mean=1.83ms  min=1.36ms  max=2.72ms  sd=0.35ms  heap=5900kb  total=38.53ms  avg/cycle=12.84ms  total mem=135414kb  avg mem/cycle=45138kb
100 subs disjoint props   :  med=2.30ms  mean=2.16ms  min=1.38ms  max=3.86ms  sd=0.70ms  heap=2588kb  total=45.32ms  avg/cycle=15.11ms  total mem=48195kb  avg mem/cycle=16065kb

--- Non-extensible targets (subscriber set lives in the WeakMap fallback) ---

sealed write 1 sub        :  med=14.59ms  mean=14.59ms  min=13.67ms  max=16.32ms  sd=0.72ms  heap=15909kb  total=306.44ms  avg/cycle=102.15ms  total mem=329658kb  avg mem/cycle=109886kb
state no subs after seal  :  med=39.97ms  mean=39.92ms  min=36.82ms  max=42.67ms  sd=1.69ms  heap=8kb  total=838.38ms  avg/cycle=279.46ms  total mem=400kb  avg mem/cycle=133kb

--- Blind spots (creation shapes, nested read, equal and undefined writes) ---

state creation (array)    :  med=19.30ms  mean=19.29ms  min=18.82ms  max=19.82ms  sd=0.32ms  heap=3237kb  total=405.09ms  avg/cycle=135.03ms  total mem=67938kb  avg mem/cycle=22646kb
state creation (sealed)   :  med=19.12ms  mean=19.16ms  min=14.93ms  max=22.28ms  sd=1.84ms  heap=6303kb  total=402.40ms  avg/cycle=134.13ms  total mem=132379kb  avg mem/cycle=44126kb
state read nested         :  med=35.48ms  mean=35.69ms  min=34.03ms  max=38.22ms  sd=0.99ms  heap=8kb  total=749.47ms  avg/cycle=249.82ms  total mem=176kb  avg mem/cycle=59kb
state write equal value   :  med=16.62ms  mean=17.38ms  min=16.11ms  max=19.69ms  sd=1.29ms  heap=7kb  total=365.03ms  avg/cycle=121.68ms  total mem=145kb  avg mem/cycle=48kb
array push/pop (undefined):  med=23.93ms  mean=23.98ms  min=22.63ms  max=26.45ms  sd=0.86ms  heap=48579kb  total=503.58ms  avg/cycle=167.86ms  total mem=1064760kb  avg mem/cycle=354920kb

Total: 20.5s  Avg/cycle: 6.8s  Total mem: 8305530kb  Avg mem/cycle: 2768510kb
```
