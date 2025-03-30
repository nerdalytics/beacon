# Beacon Performance Documentation Tools

This directory contains tools for maintaining performance documentation for the Beacon library.

## Update Performance Documentation

The `update-performance-docs.ts` script automates the process of updating performance benchmarks and generating the `PERFORMANCE.md` file.

### Features

- Runs performance tests multiple times and applies statistical methods
- Stores historical performance data in a JSON file
- Generates a markdown file with current metrics and trends
- Tracks performance over time to identify improvements or regressions

### Usage

Run the script with:

```bash
npm run test:perf:update-docs
```

### Configuration Options

At the top of the `update-performance-docs.ts` file, you can configure:

```typescript
// Performance test run configuration
const TEST_RUNS = 5;                  // Number of times to run each test
const STATISTIC_METHOD = 'median';    // Options: 'median', 'average', 'max'
const WARM_UP_RUNS = 1;               // Number of warm-up runs before collecting data
```

- **TEST_RUNS**: Number of test runs to perform and collect data from
- **STATISTIC_METHOD**: 
  - `median`: Use the middle value (best for most performance metrics)
  - `average`: Calculate the mean value
  - `max`: Use the highest value (best for showcasing peak performance)
- **WARM_UP_RUNS**: Number of test runs to perform before collecting data (to warm up the JIT)

### How It Works

1. **Running Tests:** The script executes performance tests multiple times using the `npm run test:perf` command
2. **Warm-up Phase:** Initial runs are discarded to allow JIT optimization to stabilize
3. **Data Collection:** Multiple test runs are performed and their results collected
4. **Statistical Processing:** Results are combined using median, average, or max to get reliable values
5. **Tracking History:** Results are stored in `performance-history.json` (up to 10 most recent runs)
6. **Generating Markdown:** The `PERFORMANCE.md` file is updated with the latest metrics and trends
7. **Trend Analysis:** Changes between runs are highlighted with trend indicators:
   - 🟢 ↑ Significant improvement (>10%)
   - 🟩 ↗ Slight improvement (2-10%)
   - ⬜ → No significant change (±2%)
   - 🟧 ↘ Slight regression (-2 to -10%)
   - 🟥 ↓ Significant regression (>10%)

### Output Format

The generated `PERFORMANCE.md` file includes:

- Measurement methodology information
- Core metrics (signal creation, reading, writing, etc.)
- Advanced metrics (dependency handling, cyclic behaviors)
- Comparative metrics (batching vs. non-batching)
- Performance history (up to 10 most recent runs)
- Trend analysis between consecutive runs

### Maintenance

When adding new performance tests:

1. Update the `parseTestOutput` function in `update-performance-docs.ts` to capture new metrics
2. Add regular expressions to match the output of your new test
3. Update the `metricInfo` map in `processTestResults` function to categorize the new metric
4. The new metrics will be automatically included in the PERFORMANCE.md file

## Pre-commit Usage

For teams wanting to track performance consistently, consider adding this to your pre-commit hooks or CI pipeline.

<!-- Links collection -->

[1]: ../PERFORMANCE.md
[2]: ../README.md