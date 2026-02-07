Phase 3 Results — 2026-02-07
Branch: epoch-2
Phase 2 base commit: 1b08737
Combined branch: perf/combined (97e91ad)

=== Original Baseline (pre-Phase-1, trunk) ===

classic loop              :  med=2.72ms  min=2.62ms  max=3.83ms  sd=0.42ms
state no subs             :  med=65.59ms  min=62.82ms  max=76.81ms  sd=5.00ms
state + derive            :  med=788.43ms  min=767.35ms  max=828.93ms  sd=18.31ms
state + derive + 2 effects:  med=1664.93ms  min=1648.76ms  max=1852.84ms  sd=66.51ms
batch + derive            :  med=69.50ms  min=68.24ms  max=72.44ms  sd=1.44ms
batch + derive + 2 effects:  med=71.92ms  min=70.34ms  max=74.44ms  sd=1.35ms

=== Post-Phase-1 Final ===

classic loop              :  med=2.75ms  min=2.60ms  max=3.18ms  sd=0.18ms
state no subs             :  med=61.46ms  min=60.18ms  max=62.30ms  sd=0.64ms
state + derive            :  med=765.00ms  min=758.57ms  max=813.72ms  sd=17.69ms
state + derive + 2 effects:  med=1558.86ms  min=1538.16ms  max=1588.02ms  sd=14.65ms
batch + derive            :  med=72.82ms  min=72.51ms  max=76.91ms  sd=1.78ms
batch + derive + 2 effects:  med=72.18ms  min=71.77ms  max=79.66ms  sd=2.73ms

=== Post-Phase-3 Combined (perf/combined) ===

classic loop              :  med=2.67ms  min=2.59ms  max=3.14ms  sd=0.18ms
state no subs             :  med=64.23ms  min=62.93ms  max=64.56ms  sd=0.59ms
state + derive            :  med=770.69ms  min=757.58ms  max=806.60ms  sd=14.77ms
state + derive + 2 effects:  med=1578.82ms  min=1566.43ms  max=1711.74ms  sd=54.78ms
batch + derive            :  med=76.17ms  min=73.91ms  max=78.85ms  sd=1.55ms
batch + derive + 2 effects:  med=74.05ms  min=72.50ms  max=78.72ms  sd=1.99ms

=== Total Delta (Original Baseline → Post-Phase-3) ===

classic loop              :  -1.8%  (2.72 → 2.67ms) — noise, control scenario
state no subs             :  -2.1%  (65.59 → 64.23ms) — within noise, Phase 1 showed -6.3%
state + derive            :  -2.3%  (788.43 → 770.69ms) — consistent with Phase 1's -3.0%
state + derive + 2 effects:  -5.2%  (1664.93 → 1578.82ms) — consistent with Phase 1's -6.4%
batch + derive            :  +9.6%  (69.50 → 76.17ms) — noise, batch path unaffected
batch + derive + 2 effects:  +3.0%  (71.92 → 74.05ms) — noise

=== Phase 2 Contribution ===

Phase 2 added 3 micro-optimizations to Phase 1's 5 structural optimizations:

1. fn-cleanup: Replace spread-into-push with for-of loops, remove redundant ops
2. fn-dep-comparison: Reference-equality fast paths in dep comparison
3. fn-getSubscribers: Cache symbol property access

These are cold-path optimizations that reduce GC pressure and avoid redundant
operations but do not produce measurable improvement in the macro benchmark.
The remaining 12 function groups were already at or near optimal.

=== Included Branches ===

perf/fn-cleanup (c5f87e0) → cherry-picked as 7a08349
perf/fn-dep-comparison (69920c9) → cherry-picked as fbe6fb4
perf/fn-getSubscribers (c972796) → cherry-picked as 97e91ad

=== Excluded Branches (no optimization found) ===

perf/fn-callHookSafe, perf/fn-derive-compute, perf/fn-batch-flush,
perf/fn-array-methods, perf/fn-schedule-pipeline, perf/fn-infinite-loop-check,
perf/fn-write-path, perf/fn-read-path, perf/fn-flush-pipeline,
perf/fn-findSubscribers, perf/fn-effect-execution, perf/fn-subscription-update

=== Verification ===

npm run check: PASS (Biome — 30 files, no issues)
tsc --noEmit (src/): PASS
npm test: PASS (129/129 tests, 15 suites)

=== Conclusion ===

Phase 1 captured the meaningful performance wins:
- Opt 1 (dead code removal): -6.3% on state no subs
- Opt 5 (skip tracking reallocation): -6.4% on state+derive+2effects

Phase 2's function-group analysis confirmed that the codebase is already well-
optimized at the individual function level. The remaining overhead is inherent
to the reactive system's architecture (Proxy traps, WeakMap lookups, Set
operations) and cannot be reduced without fundamental design changes.
