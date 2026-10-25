# 02: Drop the unread HOOKS slot on objects and the frozen hooks cache

**Area:** state

**Blocked by:** 01

**What to build:** Creating state with hooks on a non-array target no longer defines the internal hooks symbol on it, and a hooked non-extensible target is no longer written into a cache nobody reads. Only an array target keeps the slot, holding the direct-array context its `push` and `pop` wrappers read; the slot type says so. Hooks keep firing through the handler closures on every kind of target, direct `push` and `pop` on hooked arrays behave as before, and a non-extensible target still gets its Proxy registered in the fallback cache. Every document that described the removed storage says what the code now does, and the hooks roadmap closes item C1 as shipped. The final commit is measured against ticket 01's baseline.

- [x] A new test asserts that the raw target of a hooked plain object owns exactly one own symbol, the raw target of a hooked array owns two, and the raw target of a hookless object owns one; the object case fails before the change and passes after
- [x] The source has no WeakMap that is written and never read: the frozen hooks cache and its writer are gone, the slot type admits only the direct-array context or nothing, and the non-extensible and define-threw paths still make `state()` register the Proxy in the fallback Proxy cache
- [x] The existing tests for hooks on a frozen object, for direct `push` and `pop` on hooked arrays, and the frozen-and-sealed property tests pass unchanged, and the full suite meets the configured coverage thresholds
- [x] The source comment on the direct-array context class and the header comment of the frozen-and-sealed property test no longer say that a hooks object shares the slot or that the cache is written but never read
- [x] The internals guide in the source folder drops the row for the deleted WeakMap and the row for its writer, and its rows for the slot builder, the symbol definer, the Proxy-properties function and the direct wrappers describe the slot as array-only
- [x] The hooks roadmap moves item C1 to `shipped`, with the evidence column pointing at the test from the first criterion
- [x] `npm run check` and `npm run build` pass on the final commit; the commit message follows the project's format with type `perf` and scope `state`
- [x] The ticket report contains the full benchmark output from the final commit on the same machine and Node version as ticket 01, and no case's median is more than 1% above its ticket 01 median; the hooked creation case is at or below its baseline

## Report

Commit `198e195`, `perf(state): drop the hooks slot on objects and the frozen hooks cache`, made by the ticket's implementer in worktree `.claude/worktrees/agent-a185ac3f1c4a26607` on branch `worktree-agent-a185ac3f1c4a26607`, started at BASE `3be0a77`. The commit was first made as `73c6e7d` and amended for message length after review round 1; the tree is identical (`git diff --stat 73c6e7d 198e195` is empty). `git diff --stat 3be0a77 198e195`:

```
 HOOKS_TODO.md                        |  2 +-
 src/AGENTS.md                        | 12 +++++-------
 src/hooks/AGENTS.md                  |  3 +--
 src/index.ts                         | 21 +++++++--------------
 tests/AGENTS.md                      |  2 +-
 tests/array-push-pop.test.ts         |  2 +-
 tests/property-frozen-sealed.test.ts |  4 ++--
 tests/state-hooks.test.ts            | 15 +++++++++++++++
 8 files changed, 33 insertions(+), 28 deletions(-)
```

Criterion 1 red-then-green, as the implementer reported: the new test `defines the hooks symbol on an array target only` in `tests/state-hooks.test.ts` failed against the unchanged source with `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: 2 !== 1` on the hooked object case, and passed after the source change. Review round 1 reproduced the failure against `3be0a77` in a scratch tree.

Checks on the final tree, as the implementer reported and `do-transcript-facts` corroborated (each ran after the last file change, status ok, no sandbox denials): `npm run check` exit 0 ("Checked 64 files, No fixes applied, Found 2 infos", the infos are pre-existing biome.json schema notices); `npm run build` exit 0; `npm test` exit 0, 308 passing; `npm run test:coverage` exit 0, `all files | 100.00 | 100.00 | 100.00`. A grep for `frozenHooksCache` and `storeHooksForFrozenTarget` outside `openspec/changes/archive`, `.do/` and this change's folder found no hits. The four prose sites added under Q82 (a) are in the diff.

Benchmark, criterion 8. Node v24.21.0, Apple M4 Pro (arm64), the same machine as ticket 01. Three runs of the final tree exist: two by the implementer back to back on `73c6e7d`, and one by the steering session on `198e195` immediately after a fresh run of the baseline commit `3be0a77` in the main checkout. Medians in ms:

| Case | 01 baseline | Run 1 | Run 2 | Fresh baseline | Run 3 | Run 3 vs fresh |
|------|------------|-------|-------|----------------|-------|----------------|
| classic loop | 1.78 | 1.70 | 1.81 | 1.72 | 1.72 | 0.0% |
| state no subs | 39.65 | 38.24 | 39.68 | 40.10 | 38.06 | -5.1% |
| state + derive | 170.56 | 169.85 | 169.05 | 169.87 | 169.58 | -0.2% |
| state + derive + 2 effects | 315.15 | 322.93 | 315.57 | 317.14 | 321.25 | +1.3% |
| batch + derive | 42.98 | 42.71 | 42.55 | 43.16 | 42.74 | -1.0% |
| batch + derive + 2 effects | 42.50 | 43.08 | 43.16 | 42.67 | 42.87 | +0.5% |
| state creation | 9.80 | 9.99 | 9.82 | 9.83 | 9.91 | +0.8% |
| state read (no effect) | 16.64 | 16.60 | 16.42 | 16.74 | 16.66 | -0.5% |
| state write 1 sub | 12.70 | 12.82 | 12.84 | 12.70 | 12.75 | +0.4% |
| state write 100 subs | 84.60 | 83.60 | 85.03 | 85.01 | 85.11 | +0.1% |
| effect triggers | 7.30 | 7.47 | 7.22 | 7.23 | 7.33 | +1.4% |
| array push/pop (hookless) | 23.45 | 23.29 | 23.43 | 23.50 | 23.65 | +0.6% |
| array push/pop (hooks) | 25.37 | 25.44 | 25.42 | 25.02 | 25.08 | +0.2% |
| many dependencies | 1.90 | 1.91 | 1.92 | 1.81 | 1.91 | +5.5% |
| derive chain depth 10 | 2.28 | 2.24 | 2.27 | 2.41 | 2.58 | +7.1% |
| 100 states individual | 25.25 | 25.32 | 25.56 | 25.15 | 25.64 | +1.9% |
| 100 states batched | 1.80 | 1.74 | 1.73 | 1.65 | 1.72 | +4.2% |
| 100 subs disjoint props | 2.13 | 2.19 | 2.02 | 2.15 | 2.08 | -3.3% |
| sealed write 1 sub | 14.25 | 14.49 | 14.71 | 14.28 | 14.34 | +0.4% |
| state no subs after seal | 40.71 | 39.54 | 40.40 | 40.79 | 39.54 | -3.1% |
| state creation (array) | 19.18 | 18.89 | 18.98 | 19.15 | 19.16 | +0.1% |
| state creation (sealed) | 12.36 | 11.51 | 12.18 | 12.09 | 12.06 | -0.2% |
| state creation (hooks) | 21.49 | 13.24 | 13.24 | 21.40 | 13.32 | -37.8% |
| state read nested | 35.95 | 35.98 | 35.33 | 35.45 | 35.50 | +0.1% |
| state write equal value | 18.20 | 16.58 | 18.07 | 18.40 | 16.81 | -8.6% |
| array push/pop (undefined) | 23.68 | 23.58 | 23.65 | 23.56 | 23.52 | -0.2% |
| Total | 20.6s | 20.7s | 20.5s | 20.7s | 20.5s | |

The hooked creation case is 38% below its baseline in every run. No case is more than 1% above its baseline in all three runs; every case that is over 1% in one run is within 1% or below baseline in another, and each such case has a standard deviation in the output larger than its delta. The gate ruling is recorded in the ledger and repeated at the end of this report.

Run 1 by the implementer on `73c6e7d`, complete stdout:

```
> @nerdalytics/beacon@2002.0.0 benchmark
> node --expose-gc scripts/benchmark.ts -R 3

=== Beacon Benchmark (1,000,000 iterations, 3 cycles × 7 samples = 21 total) ===

Cycle 1/3...
Cycle 2/3...
Cycle 3/3...
classic loop              :  med=1.70ms  mean=1.71ms  min=1.51ms  max=1.87ms  sd=0.11ms  heap=11kb  total=35.83ms  avg/cycle=11.94ms  total mem=238kb  avg mem/cycle=79kb
state no subs             :  med=38.24ms  mean=35.26ms  min=25.68ms  max=41.80ms  sd=6.47ms  heap=10kb  total=740.49ms  avg/cycle=246.83ms  total mem=288kb  avg mem/cycle=96kb
state + derive            :  med=169.85ms  mean=163.40ms  min=144.65ms  max=175.67ms  sd=12.19ms  heap=68856kb  total=3431.44ms  avg/cycle=1143.81ms  total mem=1056093kb  avg mem/cycle=352031kb
state + derive + 2 effects:  med=322.93ms  mean=314.40ms  min=280.85ms  max=337.34ms  sd=19.70ms  heap=63836kb  total=6602.34ms  avg/cycle=2200.78ms  total mem=1018316kb  avg mem/cycle=339439kb
batch + derive            :  med=42.71ms  mean=39.90ms  min=31.72ms  max=45.32ms  sd=4.89ms  heap=19kb  total=837.88ms  avg/cycle=279.29ms  total mem=508kb  avg mem/cycle=169kb
batch + derive + 2 effects:  med=43.08ms  mean=39.97ms  min=30.77ms  max=45.30ms  sd=5.25ms  heap=24kb  total=839.44ms  avg/cycle=279.81ms  total mem=613kb  avg mem/cycle=204kb

--- Targeted benchmarks ---

state creation            :  med=9.99ms  mean=10.03ms  min=9.76ms  max=10.46ms  sd=0.20ms  heap=15681kb  total=210.72ms  avg/cycle=70.24ms  total mem=329307kb  avg mem/cycle=109769kb
state read (no effect)    :  med=16.60ms  mean=16.75ms  min=15.86ms  max=19.16ms  sd=0.66ms  heap=7kb  total=351.79ms  avg/cycle=117.26ms  total mem=145kb  avg mem/cycle=48kb
state write 1 sub         :  med=12.82ms  mean=13.48ms  min=11.83ms  max=16.46ms  sd=1.32ms  heap=16003kb  total=283.06ms  avg/cycle=94.35ms  total mem=327291kb  avg mem/cycle=109097kb
state write 100 subs      :  med=83.60ms  mean=83.83ms  min=80.23ms  max=87.07ms  sd=1.58ms  heap=80083kb  total=1760.44ms  avg/cycle=586.81ms  total mem=1362940kb  avg mem/cycle=454313kb
effect triggers           :  med=7.47ms  mean=7.66ms  min=6.48ms  max=10.35ms  sd=0.94ms  heap=10113kb  total=160.81ms  avg/cycle=53.60ms  total mem=203997kb  avg mem/cycle=67999kb
array push/pop (hookless) :  med=23.29ms  mean=23.42ms  min=22.42ms  max=25.17ms  sd=0.65ms  heap=48105kb  total=491.91ms  avg/cycle=163.97ms  total mem=927270kb  avg mem/cycle=309090kb
array push/pop (hooks)    :  med=25.44ms  mean=25.69ms  min=24.34ms  max=27.80ms  sd=0.96ms  heap=47842kb  total=539.41ms  avg/cycle=179.80ms  total mem=928841kb  avg mem/cycle=309614kb
many dependencies         :  med=1.91ms  mean=1.95ms  min=1.41ms  max=2.77ms  sd=0.36ms  heap=5950kb  total=40.95ms  avg/cycle=13.65ms  total mem=134065kb  avg mem/cycle=44688kb
derive chain depth 10     :  med=2.24ms  mean=2.51ms  min=1.61ms  max=4.28ms  sd=0.96ms  heap=3744kb  total=52.65ms  avg/cycle=17.55ms  total mem=79555kb  avg mem/cycle=26518kb
100 states individual     :  med=25.32ms  mean=25.38ms  min=24.25ms  max=26.72ms  sd=0.51ms  heap=6761kb  total=532.89ms  avg/cycle=177.63ms  total mem=137619kb  avg mem/cycle=45873kb
100 states batched        :  med=1.74ms  mean=1.84ms  min=1.31ms  max=2.79ms  sd=0.34ms  heap=5912kb  total=38.55ms  avg/cycle=12.85ms  total mem=136665kb  avg mem/cycle=45555kb
100 subs disjoint props   :  med=2.19ms  mean=2.07ms  min=1.39ms  max=3.37ms  sd=0.65ms  heap=2561kb  total=43.45ms  avg/cycle=14.48ms  total mem=45941kb  avg mem/cycle=15314kb

--- Non-extensible targets (subscriber set lives in the WeakMap fallback) ---

sealed write 1 sub        :  med=14.49ms  mean=14.61ms  min=13.73ms  max=16.11ms  sd=0.72ms  heap=15991kb  total=306.82ms  avg/cycle=102.27ms  total mem=332243kb  avg mem/cycle=110748kb
state no subs after seal  :  med=39.54ms  mean=39.92ms  min=36.72ms  max=43.09ms  sd=1.87ms  heap=8kb  total=838.33ms  avg/cycle=279.44ms  total mem=400kb  avg mem/cycle=133kb

--- Blind spots (creation shapes, nested read, equal and undefined writes) ---

state creation (array)    :  med=18.89ms  mean=18.88ms  min=18.37ms  max=19.34ms  sd=0.28ms  heap=3229kb  total=396.48ms  avg/cycle=132.16ms  total mem=67852kb  avg mem/cycle=22617kb
state creation (sealed)   :  med=11.51ms  mean=11.32ms  min=8.36ms  max=15.00ms  sd=1.59ms  heap=6303kb  total=237.71ms  avg/cycle=79.24ms  total mem=132339kb  avg mem/cycle=44113kb
state creation (hooks)    :  med=13.24ms  mean=13.28ms  min=12.76ms  max=13.87ms  sd=0.28ms  heap=4074kb  total=278.90ms  avg/cycle=92.97ms  total mem=85586kb  avg mem/cycle=28529kb
state read nested         :  med=35.98ms  mean=35.92ms  min=34.89ms  max=36.89ms  sd=0.57ms  heap=8kb  total=754.23ms  avg/cycle=251.41ms  total mem=173kb  avg mem/cycle=58kb
state write equal value   :  med=16.58ms  mean=17.03ms  min=16.01ms  max=18.70ms  sd=0.84ms  heap=7kb  total=357.71ms  avg/cycle=119.24ms  total mem=145kb  avg mem/cycle=48kb
array push/pop (undefined):  med=23.58ms  mean=23.90ms  min=23.02ms  max=26.74ms  sd=0.97ms  heap=48438kb  total=501.92ms  avg/cycle=167.31ms  total mem=1062674kb  avg mem/cycle=354225kb

Total: 20.7s  Avg/cycle: 6.9s  Total mem: 8371105kb  Avg mem/cycle: 2790368kb
```

Run 2 by the implementer on `73c6e7d`, back to back with run 1, complete stdout:

```
> @nerdalytics/beacon@2002.0.0 benchmark
> node --expose-gc scripts/benchmark.ts -R 3

=== Beacon Benchmark (1,000,000 iterations, 3 cycles × 7 samples = 21 total) ===

Cycle 1/3...
Cycle 2/3...
Cycle 3/3...
classic loop              :  med=1.81ms  mean=1.79ms  min=1.56ms  max=2.08ms  sd=0.13ms  heap=11kb  total=37.50ms  avg/cycle=12.50ms  total mem=238kb  avg mem/cycle=79kb
state no subs             :  med=39.68ms  mean=36.15ms  min=26.08ms  max=43.24ms  sd=6.84ms  heap=10kb  total=759.21ms  avg/cycle=253.07ms  total mem=267kb  avg mem/cycle=89kb
state + derive            :  med=169.05ms  mean=160.96ms  min=130.72ms  max=175.94ms  sd=14.60ms  heap=68835kb  total=3380.14ms  avg/cycle=1126.71ms  total mem=1041890kb  avg mem/cycle=347297kb
state + derive + 2 effects:  med=315.57ms  mean=304.53ms  min=266.26ms  max=325.04ms  sd=20.52ms  heap=63844kb  total=6395.23ms  avg/cycle=2131.74ms  total mem=1027264kb  avg mem/cycle=342421kb
batch + derive            :  med=42.55ms  mean=40.13ms  min=31.90ms  max=45.50ms  sd=4.92ms  heap=19kb  total=842.72ms  avg/cycle=280.91ms  total mem=553kb  avg mem/cycle=184kb
batch + derive + 2 effects:  med=43.16ms  mean=39.84ms  min=31.64ms  max=44.50ms  sd=5.13ms  heap=24kb  total=836.65ms  avg/cycle=278.88ms  total mem=613kb  avg mem/cycle=204kb

--- Targeted benchmarks ---

state creation            :  med=9.82ms  mean=9.91ms  min=9.35ms  max=10.85ms  sd=0.33ms  heap=15680kb  total=208.18ms  avg/cycle=69.39ms  total mem=329285kb  avg mem/cycle=109762kb
state read (no effect)    :  med=16.42ms  mean=16.44ms  min=15.97ms  max=16.92ms  sd=0.25ms  heap=7kb  total=345.27ms  avg/cycle=115.09ms  total mem=145kb  avg mem/cycle=48kb
state write 1 sub         :  med=12.84ms  mean=13.05ms  min=11.81ms  max=15.58ms  sd=0.96ms  heap=16159kb  total=273.99ms  avg/cycle=91.33ms  total mem=329045kb  avg mem/cycle=109682kb
state write 100 subs      :  med=85.03ms  mean=85.00ms  min=82.31ms  max=88.31ms  sd=1.31ms  heap=80057kb  total=1784.94ms  avg/cycle=594.98ms  total mem=1362484kb  avg mem/cycle=454161kb
effect triggers           :  med=7.22ms  mean=7.39ms  min=6.51ms  max=9.13ms  sd=0.63ms  heap=10272kb  total=155.14ms  avg/cycle=51.71ms  total mem=205448kb  avg mem/cycle=68483kb
array push/pop (hookless) :  med=23.43ms  mean=23.59ms  min=22.53ms  max=25.38ms  sd=0.73ms  heap=48306kb  total=495.49ms  avg/cycle=165.16ms  total mem=928706kb  avg mem/cycle=309569kb
array push/pop (hooks)    :  med=25.42ms  mean=25.47ms  min=24.32ms  max=28.29ms  sd=0.90ms  heap=47880kb  total=534.97ms  avg/cycle=178.32ms  total mem=929842kb  avg mem/cycle=309947kb
many dependencies         :  med=1.92ms  mean=1.92ms  min=1.40ms  max=2.90ms  sd=0.37ms  heap=5947kb  total=40.39ms  avg/cycle=13.46ms  total mem=132894kb  avg mem/cycle=44298kb
derive chain depth 10     :  med=2.27ms  mean=2.54ms  min=1.66ms  max=4.36ms  sd=0.93ms  heap=3749kb  total=53.33ms  avg/cycle=17.78ms  total mem=82784kb  avg mem/cycle=27595kb
100 states individual     :  med=25.56ms  mean=25.70ms  min=24.53ms  max=27.25ms  sd=0.69ms  heap=6872kb  total=539.64ms  avg/cycle=179.88ms  total mem=140891kb  avg mem/cycle=46964kb
100 states batched        :  med=1.73ms  mean=1.78ms  min=1.29ms  max=2.66ms  sd=0.36ms  heap=5902kb  total=37.30ms  avg/cycle=12.43ms  total mem=132818kb  avg mem/cycle=44273kb
100 subs disjoint props   :  med=2.02ms  mean=2.07ms  min=1.36ms  max=3.71ms  sd=0.71ms  heap=1941kb  total=43.49ms  avg/cycle=14.50ms  total mem=44973kb  avg mem/cycle=14991kb

--- Non-extensible targets (subscriber set lives in the WeakMap fallback) ---

sealed write 1 sub        :  med=14.71ms  mean=14.85ms  min=13.80ms  max=16.95ms  sd=0.77ms  heap=16002kb  total=311.76ms  avg/cycle=103.92ms  total mem=326668kb  avg mem/cycle=108889kb
state no subs after seal  :  med=40.40ms  mean=40.71ms  min=38.72ms  max=44.49ms  sd=1.31ms  heap=22kb  total=854.99ms  avg/cycle=285.00ms  total mem=383kb  avg mem/cycle=128kb

--- Blind spots (creation shapes, nested read, equal and undefined writes) ---

state creation (array)    :  med=18.98ms  mean=18.91ms  min=18.40ms  max=20.08ms  sd=0.37ms  heap=3234kb  total=397.19ms  avg/cycle=132.40ms  total mem=297203kb  avg mem/cycle=99068kb
state creation (sealed)   :  med=12.18ms  mean=12.17ms  min=9.11ms  max=14.16ms  sd=1.27ms  heap=6302kb  total=255.55ms  avg/cycle=85.18ms  total mem=132331kb  avg mem/cycle=44110kb
state creation (hooks)    :  med=13.24ms  mean=13.29ms  min=12.90ms  max=13.97ms  sd=0.25ms  heap=4073kb  total=279.00ms  avg/cycle=93.00ms  total mem=85540kb  avg mem/cycle=28513kb
state read nested         :  med=35.33ms  mean=35.39ms  min=34.34ms  max=36.21ms  sd=0.43ms  heap=8kb  total=743.29ms  avg/cycle=247.76ms  total mem=173kb  avg mem/cycle=58kb
state write equal value   :  med=18.07ms  mean=17.72ms  min=15.96ms  max=19.48ms  sd=1.05ms  heap=7kb  total=372.15ms  avg/cycle=124.05ms  total mem=145kb  avg mem/cycle=48kb
array push/pop (undefined):  med=23.65ms  mean=23.89ms  min=23.05ms  max=27.09ms  sd=0.97ms  heap=48463kb  total=501.76ms  avg/cycle=167.25ms  total mem=1062532kb  avg mem/cycle=354177kb

Total: 20.5s  Avg/cycle: 6.8s  Total mem: 8595114kb  Avg mem/cycle: 2865038kb
```

Run 3 by the steering session on `198e195` (the same tree), case and total lines, immediately after a fresh run of `3be0a77` in the main checkout whose case lines are the "Fresh baseline" column above:

```
classic loop              :  med=1.72ms  mean=1.72ms  min=1.48ms  max=1.96ms  sd=0.12ms  heap=11kb  total=36.12ms  avg/cycle=12.04ms  total mem=238kb  avg mem/cycle=79kb
state no subs             :  med=38.06ms  mean=34.76ms  min=25.61ms  max=40.12ms  sd=6.01ms  heap=10kb  total=729.99ms  avg/cycle=243.33ms  total mem=310kb  avg mem/cycle=103kb
state + derive            :  med=169.58ms  mean=161.52ms  min=139.02ms  max=176.05ms  sd=13.89ms  heap=68526kb  total=3391.83ms  avg/cycle=1130.61ms  total mem=1021223kb  avg mem/cycle=340408kb
state + derive + 2 effects:  med=321.25ms  mean=308.40ms  min=267.57ms  max=339.92ms  sd=24.49ms  heap=62665kb  total=6476.50ms  avg/cycle=2158.83ms  total mem=1044630kb  avg mem/cycle=348210kb
batch + derive            :  med=42.74ms  mean=40.07ms  min=31.68ms  max=44.58ms  sd=4.74ms  heap=19kb  total=841.40ms  avg/cycle=280.47ms  total mem=510kb  avg mem/cycle=170kb
batch + derive + 2 effects:  med=42.87ms  mean=39.77ms  min=31.06ms  max=45.23ms  sd=5.23ms  heap=24kb  total=835.27ms  avg/cycle=278.42ms  total mem=613kb  avg mem/cycle=204kb
state creation            :  med=9.91ms  mean=9.90ms  min=9.52ms  max=10.24ms  sd=0.18ms  heap=15681kb  total=207.92ms  avg/cycle=69.31ms  total mem=329303kb  avg mem/cycle=109768kb
state read (no effect)    :  med=16.66ms  mean=16.69ms  min=16.02ms  max=18.24ms  sd=0.50ms  heap=7kb  total=350.58ms  avg/cycle=116.86ms  total mem=146kb  avg mem/cycle=49kb
state write 1 sub         :  med=12.75ms  mean=12.98ms  min=11.58ms  max=14.98ms  sd=0.86ms  heap=16193kb  total=272.56ms  avg/cycle=90.85ms  total mem=329365kb  avg mem/cycle=109788kb
state write 100 subs      :  med=85.11ms  mean=84.66ms  min=80.45ms  max=87.66ms  sd=1.67ms  heap=80078kb  total=1777.77ms  avg/cycle=592.59ms  total mem=1359488kb  avg mem/cycle=453163kb
effect triggers           :  med=7.33ms  mean=7.49ms  min=6.49ms  max=9.43ms  sd=0.79ms  heap=10329kb  total=157.21ms  avg/cycle=52.40ms  total mem=207261kb  avg mem/cycle=69087kb
array push/pop (hookless) :  med=23.65ms  mean=23.95ms  min=23.12ms  max=26.72ms  sd=0.80ms  heap=48278kb  total=502.96ms  avg/cycle=167.65ms  total mem=929122kb  avg mem/cycle=309707kb
array push/pop (hooks)    :  med=25.08ms  mean=25.33ms  min=24.40ms  max=27.66ms  sd=0.80ms  heap=47877kb  total=531.90ms  avg/cycle=177.30ms  total mem=929396kb  avg mem/cycle=309799kb
many dependencies         :  med=1.91ms  mean=1.94ms  min=1.39ms  max=2.87ms  sd=0.40ms  heap=5947kb  total=40.79ms  avg/cycle=13.60ms  total mem=132885kb  avg mem/cycle=44295kb
derive chain depth 10     :  med=2.58ms  mean=2.73ms  min=1.56ms  max=4.58ms  sd=1.00ms  heap=3749kb  total=57.27ms  avg/cycle=19.09ms  total mem=85756kb  avg mem/cycle=28585kb
100 states individual     :  med=25.64ms  mean=25.62ms  min=24.44ms  max=28.28ms  sd=0.81ms  heap=6699kb  total=538.12ms  avg/cycle=179.37ms  total mem=137377kb  avg mem/cycle=45792kb
100 states batched        :  med=1.72ms  mean=1.84ms  min=1.31ms  max=2.79ms  sd=0.32ms  heap=5900kb  total=38.58ms  avg/cycle=12.86ms  total mem=136990kb  avg mem/cycle=45663kb
100 subs disjoint props   :  med=2.08ms  mean=2.10ms  min=1.43ms  max=3.68ms  sd=0.71ms  heap=2563kb  total=44.08ms  avg/cycle=14.69ms  total mem=46034kb  avg mem/cycle=15345kb
sealed write 1 sub        :  med=14.34ms  mean=14.45ms  min=13.56ms  max=16.45ms  sd=0.74ms  heap=16022kb  total=303.43ms  avg/cycle=101.14ms  total mem=329829kb  avg mem/cycle=109943kb
state no subs after seal  :  med=39.54ms  mean=39.59ms  min=37.13ms  max=42.01ms  sd=1.51ms  heap=8kb  total=831.42ms  avg/cycle=277.14ms  total mem=400kb  avg mem/cycle=133kb
state creation (array)    :  med=19.16ms  mean=19.12ms  min=18.53ms  max=19.78ms  sd=0.31ms  heap=3234kb  total=401.56ms  avg/cycle=133.85ms  total mem=297210kb  avg mem/cycle=99070kb
state creation (sealed)   :  med=12.06ms  mean=11.93ms  min=8.63ms  max=14.14ms  sd=1.54ms  heap=6302kb  total=250.52ms  avg/cycle=83.51ms  total mem=132355kb  avg mem/cycle=44118kb
state creation (hooks)    :  med=13.32ms  mean=13.36ms  min=12.90ms  max=13.75ms  sd=0.23ms  heap=4073kb  total=280.63ms  avg/cycle=93.54ms  total mem=85549kb  avg mem/cycle=28516kb
state read nested         :  med=35.50ms  mean=35.41ms  min=33.60ms  max=37.41ms  sd=0.88ms  heap=8kb  total=743.52ms  avg/cycle=247.84ms  total mem=173kb  avg mem/cycle=58kb
state write equal value   :  med=16.81ms  mean=17.37ms  min=16.15ms  max=19.87ms  sd=1.07ms  heap=7kb  total=364.81ms  avg/cycle=121.60ms  total mem=145kb  avg mem/cycle=48kb
array push/pop (undefined):  med=23.52ms  mean=23.86ms  min=22.69ms  max=26.40ms  sd=0.95ms  heap=48441kb  total=501.09ms  avg/cycle=167.03ms  total mem=1063046kb  avg mem/cycle=354349kb
Total: 20.5s  Avg/cycle: 6.8s  Total mem: 8599354kb  Avg mem/cycle: 2866451kb
```

### Gate ruling (Q84)

The maintainer ruled on Q84 that each case has a 1% ceiling on slowdowns and no limit on speedups. The 3-cycle runs above cannot resolve 1% on the small cases (identical code differs by more than 1% between runs on them), so the gate was re-measured at 10 cycles with `node --expose-gc scripts/benchmark.ts -R 10`, in the order baseline (A1), final (B1), final (B2), baseline (A2), medians in ms, final against the baseline run nearest in time:

```
case                            A1      B1      B2      A2   B1/A1   B2/A2
classic loop                   1.66    1.66    1.71    1.68    +0.0%   +1.8%
state no subs                 40.47   41.12   41.39   41.23    +1.6%   +0.4%
state + derive               174.79  175.22  176.77  175.50    +0.2%   +0.7%
state + derive + 2 effects   325.70  330.09  327.29  324.74    +1.3%   +0.8%
batch + derive                43.48   43.15   43.18   43.43    -0.8%   -0.6%
batch + derive + 2 effects    43.08   43.20   43.20   43.26    +0.3%   -0.1%
state creation                 9.82    9.96   10.02    9.91    +1.4%   +1.1%
state read (no effect)        16.70   16.68   16.73   16.62    -0.1%   +0.7%
state write 1 sub             13.02   12.98   13.26   13.17    -0.3%   +0.7%
state write 100 subs          85.61   86.14   85.83   85.28    +0.6%   +0.6%
effect triggers                7.41    7.42    7.66    7.52    +0.1%   +1.9%
array push/pop (hookless)     23.46   23.46   23.68   23.66    +0.0%   +0.1%
array push/pop (hooks)        25.09   25.60   25.62   25.35    +2.0%   +1.1%
many dependencies              1.80    1.80    1.80    1.88    +0.0%   -4.3%
derive chain depth 10          2.40    2.47    1.93    2.36    +2.9%  -18.2%
100 states individual         25.45   25.51   25.50   25.55    +0.2%   -0.2%
100 states batched             1.71    1.70    1.67    1.70    -0.6%   -1.8%
100 subs disjoint props        2.25    2.25    2.12    2.19    +0.0%   -3.2%
sealed write 1 sub            14.44   14.56   14.84   14.54    +0.8%   +2.1%
state no subs after seal      40.67   41.60   41.62   41.19    +2.3%   +1.0%
state creation (array)        18.86   18.78   18.92   19.05    -0.4%   -0.7%
state creation (sealed)       18.41   17.35   17.41   17.88    -5.8%   -2.6%
state creation (hooks)        21.53   13.37   13.39   21.69   -37.9%  -38.3%
state read nested             35.88   35.69   35.77   35.69    -0.5%   +0.2%
state write equal value       18.20   18.40   18.39   18.55    +1.1%   -0.9%
array push/pop (undefined)    23.42   23.86   23.82   23.60    +1.9%   +0.9%
Total                         71.8s   71.7s   71.7s   72.2s
```

Two cases were over 1% in both pairings, `state creation` and `array push/pop (hooks)`, and neither path is touched by the diff. A targeted probe with the same loop bodies, 8 alternating processes per commit, 15 samples each with GC between samples, median of per-process medians:

| Case | Baseline `3be0a77` | Final `198e195` | Change |
|------|--------------------|-----------------|--------|
| state creation | 10.134ms | 10.075ms | -0.59% |
| array push/pop (hooks) | 24.326ms | 24.236ms | -0.37% |

The baseline's own eight processes spread from 10.00ms to 10.26ms on creation (2.6%), wider than any difference between the commits. Under the Q84 rule no case shows a slowdown above 1% that survives a measurement able to resolve 1%, and the hooked creation case is 38% faster in every run. Gate met; ruling logged in `.do/ledger/drop-unread-hooks-slot-on-objects.md`.
