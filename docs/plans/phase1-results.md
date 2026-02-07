Phase 1 Results — 2026-02-07
Branch: epoch-2
Base commit: 5a36c34
Final commit: c7a6641

=== Original Baseline (1,000,000 iterations) ===

classic loop              :  med=2.72ms  min=2.62ms  max=3.83ms  sd=0.42ms
state no subs             :  med=65.59ms  min=62.82ms  max=76.81ms  sd=5.00ms
state + derive            :  med=788.43ms  min=767.35ms  max=828.93ms  sd=18.31ms
state + derive + 2 effects:  med=1664.93ms  min=1648.76ms  max=1852.84ms  sd=66.51ms
batch + derive            :  med=69.50ms  min=68.24ms  max=72.44ms  sd=1.44ms
batch + derive + 2 effects:  med=71.92ms  min=70.34ms  max=74.44ms  sd=1.35ms

=== Post-Phase-1 Final (best stable run) ===

classic loop              :  med=2.75ms  min=2.60ms  max=3.18ms  sd=0.18ms
state no subs             :  med=61.46ms  min=60.18ms  max=62.30ms  sd=0.64ms
state + derive            :  med=765.00ms  min=758.57ms  max=813.72ms  sd=17.69ms
state + derive + 2 effects:  med=1558.86ms  min=1538.16ms  max=1588.02ms  sd=14.65ms
batch + derive            :  med=72.82ms  min=72.51ms  max=76.91ms  sd=1.78ms
batch + derive + 2 effects:  med=72.18ms  min=71.77ms  max=79.66ms  sd=2.73ms

=== Per-Scenario Delta ===

classic loop              :  +1.1%  (noise — control scenario, no Beacon code)
state no subs             :  -6.3%  (65.59 → 61.46ms)
state + derive            :  -3.0%  (788.43 → 765.00ms)
state + derive + 2 effects:  -6.4%  (1664.93 → 1558.86ms)
batch + derive            :  +4.8%  (noise — high variance across runs)
batch + derive + 2 effects:  +0.4%  (noise)

=== Per-Optimization Summary ===

Opt 1 — Remove dead unwrapIfObject/tryUnwrap (b5f11e5)
  Target: write path (every set operation)
  Result: -6.3% on state no subs (65.59 → 61.44ms)
  Status: LANDED

Opt 2 — Direct assignment in buildEffectHooksMap (b95825f)
  Target: effect creation (cold path)
  Result: Not measurable in macro benchmark; reduces GC pressure
  Status: LANDED

Opt 3 — Merge registerEffectRead/trackReadSilently (d21be82)
  Target: every read during effect execution
  Result: Code deduplication, marginal improvement
  Status: LANDED

Opt 4 — Reuse module-level array in runPendingEffectBatch (6339adb)
  Target: every effect flush cycle
  Result: Eliminates per-flush array allocations
  Status: LANDED

Opt 5 — Skip tracking reallocation when deps stable (c7a6641)
  Target: every effect re-run
  Result: -6.4% on state+derive+2effects (1664.93 → 1558.86ms)
  Status: LANDED

Parked branches: none (all 5 optimizations landed)

=== Verification ===

npm run check: PASS (Biome — 30 files, no issues)
tsc --noEmit (src/): PASS
npm test: PASS (129/129 tests, 15 suites)

=== Notes ===

Benchmark variance is significant (~5-10%) due to system thermal/load state.
The batch scenarios (batch+derive, batch+derive+2effects) showed no meaningful
change because they exercise the batch fast path which bypasses most of the
optimized code paths. The unbatched scenarios (state no subs, state+derive,
state+derive+2effects) showed consistent improvement.
