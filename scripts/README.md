# Beacon Scripts

A collection of utility scripts for the Beacon library.

## Scripts Overview

### [`benchmark.ts`][1]
Comprehensive performance benchmarking for Beacon.
- Measures operations/second for core operations, derived values, effects
- Compares batched vs unbatched performance
- Tests deep dependency chains and complex scenarios

```bash
npm run benchmark
```

### [`update-performance-docs.ts`][2]
Generates the PERFORMANCE.md file with benchmark results.
- Runs benchmarks multiple times for statistical reliability
- Saves historical performance data
- Generates trend analysis with indicators (improvements/regressions)
- Updates PERFORMANCE.md with formatted results

```bash
npm run update-performance-docs
```

### [`run-lts-tests.js`][3]
Tests compiled code on Node.js LTS versions.
- Prepares TypeScript test files for JS compatibility
- Handles import path adjustments
- Runs tests on compiled code

```bash
npm run test:lts
```

### [`naiv-benchmark.ts`][4]
Simple comparison between reactive patterns and classic loops.
- Compares signal-based updates vs traditional JavaScript
- Tests with and without batching
- Provides basic performance metrics

```bash
node scripts/naiv-benchmark.ts
```

---

## License

This project is licensed under the MIT License. See the [LICENSE][5] file for details.

<div align="center">
  <img src="https://raw.githubusercontent.com/nerdalytics/nerdalytics/refs/heads/main/nerdalytics-logo-gray-transparent.svg" width="128px">
</div>

<!-- Links collection -->
[1]: ./benchmark.ts
[2]: ./update-performance-docs.ts
[3]: ./run-lts-tests.js
[4]: ./naiv-benchmark.ts
[5]: ./LICENSE
