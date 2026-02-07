Phase 1 Baseline — 2026-02-07
Branch: epoch-2
Commit: 5a36c34

=== Beacon Benchmark (1,000,000 iterations) ===

classic loop              :  med=2.72ms  min=2.62ms  max=3.83ms  sd=0.42ms
state no subs             :  med=65.59ms  min=62.82ms  max=76.81ms  sd=5.00ms
state + derive            :  med=788.43ms  min=767.35ms  max=828.93ms  sd=18.31ms
state + derive + 2 effects:  med=1664.93ms  min=1648.76ms  max=1852.84ms  sd=66.51ms
batch + derive            :  med=69.50ms  min=68.24ms  max=72.44ms  sd=1.44ms
batch + derive + 2 effects:  med=71.92ms  min=70.34ms  max=74.44ms  sd=1.35ms

Verification: npm run check PASS, tsc --noEmit (src/) PASS, npm test PASS (129/129)
