Phase 2 Rankings — 2026-02-07
Branch: epoch-2
Phase 2 base commit: 1b08737

=== Branches with Commits (ranked by optimization type) ===

1. perf/fn-cleanup (c5f87e0)
   Changes: Replace spread-into-push with for-of loops, remove redundant deps.clear()
   Delta: ~0% (cold-path — reduces GC pressure from spread args)
   Rationale: Eliminates per-call argument array allocation in cleanup chains

2. perf/fn-dep-comparison (69920c9)
   Changes: Reference-equality fast paths in setContainsAll, propsMatch, depsMatch
   Delta: ~0% (identity paths rarely trigger in benchmark — new Sets per re-run)
   Rationale: Benefits real workloads where deps stabilize across re-runs

3. perf/fn-getSubscribers (c972796)
   Changes: Cache target[SUBSCRIBERS] symbol access to avoid double read
   Delta: ~0% (cold-path micro — subscriberCache handles hot path)
   Rationale: Minor cleanup, avoids one redundant symbol property access

=== Branches Analyzed — No Optimization Found ===

perf/fn-callHookSafe: Already minimal (5 lines: guard + try-catch)
perf/fn-derive-compute: Cold-path compute functions, already minimal wrappers
perf/fn-batch-flush: Already uses optimized iteration patterns
perf/fn-array-methods: Guard order optimal, caching already in place
perf/fn-schedule-pipeline: All WeakMap lookups necessary on hot path
perf/fn-infinite-loop-check: Already optimized in Phase 1
perf/fn-write-path: All operations necessary (loop check, compare, schedule)
perf/fn-read-path: 3 thin functions, already at minimum
perf/fn-flush-pipeline: Already optimized in Phase 1 (reusable effectQueue)
perf/fn-findSubscribers: Already minimal (symbol access + WeakMap fallback)
perf/fn-effect-execution: Already optimized in Phase 1 (temp tracking)
perf/fn-subscription-update: Already minimal set iteration

=== Summary ===

Phase 2 found 3 micro-optimizations across 15 function groups. The remaining
12 groups were already at or near optimal after Phase 1's structural changes.
All 3 optimizations target cold paths or edge cases — none produce measurable
improvement in the 1M-iteration macro benchmark.
